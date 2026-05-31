// ─── MICHT Decants — Sistema de Usuarios ──────────────────────────────────────
//
// SQL REQUERIDO EN SUPABASE (ejecutar en SQL Editor):
//
// -- 1. Tabla de perfiles de usuario
// CREATE TABLE perfiles_usuarios (
//   id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
//   nombre_completo         TEXT NOT NULL,
//   dni                     TEXT NOT NULL,
//   telefono                TEXT NOT NULL,
//   primer_descuento_usado  BOOLEAN DEFAULT false,
//   created_at              TIMESTAMPTZ DEFAULT NOW()
// );
// ALTER TABLE perfiles_usuarios ADD CONSTRAINT perfiles_usuarios_dni_key UNIQUE (dni);
//
// -- 2. Habilitar RLS
// ALTER TABLE perfiles_usuarios ENABLE ROW LEVEL SECURITY;
//
// -- 3. Políticas: solo el propio usuario puede leer/escribir su perfil
// CREATE POLICY "owner_select" ON perfiles_usuarios FOR SELECT TO authenticated USING (auth.uid() = id);
// CREATE POLICY "owner_insert" ON perfiles_usuarios FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
// CREATE POLICY "owner_update" ON perfiles_usuarios FOR UPDATE TO authenticated USING (auth.uid() = id);
//
// -- 4. Función segura para verificar DNI sin exponer datos
// CREATE OR REPLACE FUNCTION check_dni_exists(p_dni TEXT)
// RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
// BEGIN
//   RETURN EXISTS (SELECT 1 FROM perfiles_usuarios WHERE dni = p_dni);
// END;
// $$;
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── Módulo principal de autenticación ───────────────────────────────────────

const UserAuth = {
  _pendingProfile: null,
  _currentUser:    null,
  _currentProfile: null,
  _isRegistering:  false,

  async init() {
    if (!authClient) return;

    // Restaurar sesión existente
    const { data: { session } } = await authClient.auth.getSession();
    if (session?.user) {
      this._currentUser = session.user;
      await this._loadProfile();
    }

    // Manejar redirección desde link de verificación de email
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      await authClient.auth.getSession();
    }

    // Escuchar cambios de sesión
    authClient.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        this._currentUser = session.user;
        await this._loadProfile();

        if (!this._currentProfile && this._pendingProfile) {
          await this._insertProfile(session.user.id);
        }
        // No actualizar la UI durante el registro — el signOut() lo hará
        if (!this._isRegistering) {
          this._updateHeaderUI();
        }
      } else if (event === 'SIGNED_OUT') {
        this._currentUser    = null;
        this._currentProfile = null;
        if (!this._isRegistering) {
          this._updateHeaderUI();
        }
      }
    });

    this._updateHeaderUI();
  },

  // ─── Helper: promesa con timeout ──────────────────────────────────────────
  _withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
    ]);
  },

  // ─── Registro ──────────────────────────────────────────────────────────────
  async register({ nombre, dni, telefono, email, password }) {
    if (!authClient) return { error: 'Sin conexión al servidor. Intenta más tarde.' };

    // Verificar DNI duplicado — con timeout para que no se cuelgue
    try {
      const { data: exists, error: fnErr } = await this._withTimeout(
        authClient.rpc('check_dni_exists', { p_dni: dni.trim() }), 6000
      );
      if (!fnErr && exists) {
        return { error: 'Este DNI ya tiene una cuenta registrada. Inicia sesión.' };
      }
    } catch (_) { /* función no existe o timeout — continuar */ }

    this._pendingProfile = { nombre: nombre.trim(), dni: dni.trim(), telefono: telefono.trim() };
    this._isRegistering  = true;

    let data, error;
    try {
      ({ data, error } = await this._withTimeout(
        authClient.auth.signUp({ email: email.trim().toLowerCase(), password }),
        12000
      ));
    } catch (err) {
      this._pendingProfile = null;
      this._isRegistering  = false;
      return { error: err.message === 'timeout'
        ? 'La conexión tardó demasiado. Verifica tu internet e inténtalo de nuevo.'
        : 'Error de conexión. Inténtalo de nuevo.' };
    }

    if (error) {
      this._pendingProfile = null;
      this._isRegistering  = false;
      if (error.message?.includes('already registered') || error.message?.includes('User already registered')) {
        return { error: 'Este correo ya tiene una cuenta. Inicia sesión.' };
      }
      if (error.message?.includes('disabled') || error.message?.includes('not enabled')) {
        return { error: 'El registro con correo no está activado. Contacta al administrador.' };
      }
      return { error: error.message || 'Error al registrar. Intenta de nuevo.' };
    }

    // Insertar perfil mientras hay sesión activa (RLS lo requiere)
    const user = data?.session?.user || data?.user;
    if (user) {
      this._currentUser = user;
      try { await this._withTimeout(this._insertProfile(user.id), 8000); } catch (_) {}
    }

    // Cerrar sesión para que el usuario inicie sesión manualmente
    try { await this._withTimeout(authClient.auth.signOut(), 5000); } catch (_) {}
    this._isRegistering  = false;
    this._currentUser    = null;
    this._currentProfile = null;
    this._pendingProfile = null;
    this._updateHeaderUI();

    return { success: true };
  },

  // ─── Login ────────────────────────────────────────────────────────────────
  async login({ email, password }) {
    if (!authClient) return { error: 'Sin conexión al servidor.' };

    const { data, error } = await authClient.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password: password
    });

    if (error) {
      if (error.message?.includes('Invalid login credentials') || error.message?.includes('invalid_credentials')) {
        return { error: 'Correo o contraseña incorrectos. Verifica tus datos.' };
      }
      if (error.message?.includes('Email not confirmed')) {
        return { error: 'Tu correo no está confirmado. Contacta al administrador.' };
      }
      return { error: error.message || 'Error al ingresar. Intenta de nuevo.' };
    }

    return { success: true };
  },

  // ─── Recuperar contraseña ─────────────────────────────────────────────────
  async resetPassword(email) {
    if (!authClient) return { error: 'Sin conexión al servidor.' };
    const { error } = await authClient.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin + '/?reset=true'
    });
    if (error) return { error: 'Error al enviar correo. Verifica que el correo sea correcto.' };
    return { success: true };
  },

  // ─── Cerrar sesión ────────────────────────────────────────────────────────
  async logout() {
    if (!authClient) return;
    await authClient.auth.signOut();
    this._currentUser    = null;
    this._currentProfile = null;
    this._updateHeaderUI();
  },

  // ─── Insertar perfil tras verificación exitosa ────────────────────────────
  async _insertProfile(userId) {
    if (!authClient || !this._pendingProfile) return;

    const { nombre, dni, telefono } = this._pendingProfile;
    const { error } = await authClient
      .from('perfiles_usuarios')
      .insert({
        id:                     userId,
        nombre_completo:        nombre,
        dni:                    dni,
        telefono:               telefono,
        primer_descuento_usado: false
      });

    if (error) {
      if (error.code === '23505') {
        // DNI duplicado — ocurrió una condición de carrera
        await authClient.auth.signOut();
        this._currentUser    = null;
        this._currentProfile = null;
        showAuthToast('Este DNI ya tiene una cuenta. Inicia sesión.', 'error');
      }
      // Intentar cargar perfil existente de todas formas
      await this._loadProfile();
    } else {
      await this._loadProfile();
    }

    this._pendingProfile = null;
  },

  // ─── Cargar perfil desde Supabase ─────────────────────────────────────────
  async _loadProfile() {
    if (!authClient || !this._currentUser) return;

    const { data, error } = await authClient
      .from('perfiles_usuarios')
      .select('*')
      .eq('id', this._currentUser.id)
      .maybeSingle();

    if (!error && data) this._currentProfile = data;
  },

  // ─── Marcar descuento de primera compra como usado ────────────────────────
  async markDiscountUsed() {
    if (!authClient || !this._currentUser || !this._currentProfile) return;
    if (this._currentProfile.primer_descuento_usado) return;

    const { error } = await authClient
      .from('perfiles_usuarios')
      .update({ primer_descuento_usado: true })
      .eq('id', this._currentUser.id);

    if (!error) this._currentProfile.primer_descuento_usado = true;
  },

  // ─── Getters ──────────────────────────────────────────────────────────────
  isLoggedIn()      { return !!this._currentUser && !!this._currentProfile; },
  getProfile()      { return this._currentProfile; },
  hasFirstDiscount() {
    return this.isLoggedIn() && this._currentProfile && !this._currentProfile.primer_descuento_usado;
  },
  getDiscountedTotal(base) {
    return this.hasFirstDiscount() ? parseFloat((base * 0.90).toFixed(2)) : base;
  },

  // ─── Actualizar UI del header ─────────────────────────────────────────────
  _updateHeaderUI() {
    const loggedIn  = this.isLoggedIn();
    const firstName = loggedIn
      ? (this._currentProfile?.nombre_completo || '').split(' ')[0]
      : '';

    // Desktop
    const el = {
      loginBtn:    document.getElementById('headerLoginBtn'),
      regBtn:      document.getElementById('headerRegisterBtn'),
      userDisplay: document.getElementById('headerUserDisplay'),
      userName:    document.getElementById('headerUserName')
    };

    if (el.loginBtn) {
      el.loginBtn.style.display    = loggedIn ? 'none' : '';
      el.regBtn.style.display      = loggedIn ? 'none' : '';
      el.userDisplay.style.display = loggedIn ? 'flex' : 'none';
      if (el.userName && firstName) el.userName.textContent = firstName;
    }

    // Descuento badge en header
    const discBadge = document.getElementById('headerDiscountBadge');
    if (discBadge) discBadge.style.display = (loggedIn && this.hasFirstDiscount()) ? 'inline-flex' : 'none';

    // Mobile
    const mob = {
      loginBtn:    document.getElementById('mobileLoginBtn'),
      regBtn:      document.getElementById('mobileRegisterBtn'),
      userDisplay: document.getElementById('mobileUserDisplay'),
      userName:    document.getElementById('mobileUserName')
    };

    if (mob.loginBtn) {
      mob.loginBtn.style.display    = loggedIn ? 'none' : '';
      mob.regBtn.style.display      = loggedIn ? 'none' : '';
      mob.userDisplay.style.display = loggedIn ? 'flex' : 'none';
      if (mob.userName && firstName) mob.userName.textContent = firstName;
    }

    // Banner promocional
    this._updatePromoBanner();
  },

  _updatePromoBanner() {
    const banner  = document.getElementById('promoBanner');
    const text    = document.getElementById('promoBannerText');
    const cta     = document.getElementById('promoBannerCta');
    if (!banner) return;

    // No mostrar si el usuario ya cerró el banner esta sesión
    if (sessionStorage.getItem('promoBannerDismissed')) {
      banner.style.display = 'none';
      return;
    }

    const loggedIn    = this.isLoggedIn();
    const hasDiscount = this.hasFirstDiscount();

    if (!loggedIn) {
      // No logueado → invitar a registrarse
      if (text)  text.innerHTML  = 'Regístrate y obtén <strong>10% OFF</strong> en tu primera compra';
      if (cta) { cta.textContent = 'Crear cuenta gratis'; cta.dataset.action = 'register'; }
      banner.style.display = '';
    } else if (hasDiscount) {
      // Logueado con descuento disponible → recordarle
      if (text)  text.innerHTML  = '¡Tienes <strong>10% OFF</strong> disponible en tu primera compra!';
      if (cta) { cta.textContent = 'Ver catálogo'; cta.dataset.action = 'catalog'; }
      banner.style.display = '';
    } else {
      // Logueado y descuento ya usado → ocultar
      banner.style.display = 'none';
    }
  }
};

// ─── Historial de compras del usuario ────────────────────────────────────────

async function openHistoryModal() {
  const overlay = document.getElementById('historyOverlay');
  const content = document.getElementById('historyContent');
  if (!overlay || !content) return;

  overlay.style.display = 'flex';
  content.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text2)">Cargando…</p>';

  const profile = UserAuth.getProfile();
  if (!profile?.dni || !authClient) {
    content.innerHTML = '<p class="history-empty">No se pudo cargar el historial.</p>';
    return;
  }

  const { data: orders, error } = await authClient
    .from('pedidos')
    .select('*')
    .eq('customer_dni', profile.dni)
    .order('created_at', { ascending: false });

  if (error) {
    content.innerHTML = '<p class="history-empty">Error al cargar el historial. Intenta de nuevo.</p>';
    return;
  }

  if (!orders || !orders.length) {
    content.innerHTML = `
      <div class="history-empty-state">
        <div class="history-empty-icon">🛍️</div>
        <p class="history-empty-title">¡Ups! Aún no tienes compras</p>
        <p class="history-empty-sub">Cuando hagas tu primer pedido,<br>aparecerá aquí tu historial.</p>
        <button class="history-empty-cta" id="historyGoShopBtn">Ver catálogo</button>
      </div>`;
    document.getElementById('historyGoShopBtn')?.addEventListener('click', () => {
      closeHistoryModal();
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    });
    return;
  }

  const STATUS_LABELS = {
    pendiente: 'Pendiente', pagado: 'Pagado',
    cancelado: 'Cancelado', enviado: 'Enviado', entregado: 'Entregado'
  };

  content.innerHTML = orders.map(order => {
    const status   = order.status || 'pendiente';
    const safeStatus = status.replace(/[^a-z]/g, '');
    const date     = new Date(order.created_at).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    const _esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const items = (order.items || [])
      .map(i => `${_esc(i.productName)} ${_esc(i.size)} ×${parseInt(i.quantity) || 1}`)
      .join(' · ');
    const delivery = order.delivery_type === 'envio' ? '📦 Envío' : '🏪 Recojo';

    return `
      <div class="history-order-card">
        <div class="history-order-header">
          <span class="history-order-id">${order.id}</span>
          <span class="status-badge status-${safeStatus}">${STATUS_LABELS[status] || status}</span>
          <span class="history-order-date">${date}</span>
        </div>
        <div class="history-order-items">${items || '—'}</div>
        <div class="history-order-total">
          ${delivery} &nbsp;·&nbsp; Total: <strong>S/ ${parseFloat(order.total || 0).toFixed(2)}</strong>
        </div>
      </div>`;
  }).join('');
}

function closeHistoryModal() {
  const overlay = document.getElementById('historyOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ─── Cambio de contraseña ─────────────────────────────────────────────────────

async function _handleChangePassword(newPass, newPass2, errEl, btn, onSuccess) {
  if (!errEl || !btn) return;
  errEl.style.color = '';
  errEl.textContent = '';

  if (!newPass || newPass.length < 8) {
    errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return;
  }
  if (newPass !== newPass2) {
    errEl.textContent = 'Las contraseñas no coinciden.'; return;
  }
  if (!authClient) {
    errEl.textContent = 'Sin conexión. Inténtalo de nuevo.'; return;
  }

  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  const { error } = await authClient.auth.updateUser({ password: newPass });

  btn.disabled    = false;
  btn.textContent = 'Guardar contraseña';

  if (error) {
    errEl.textContent = 'Error al cambiar. Inténtalo de nuevo.';
  } else {
    errEl.style.color = 'var(--gold)';
    errEl.textContent = '¡Contraseña actualizada!';
    showAuthToast('Contraseña cambiada correctamente.', 'success');
    if (typeof onSuccess === 'function') setTimeout(onSuccess, 1500);
  }
}

// ─── Toast de notificación ────────────────────────────────────────────────────

function showAuthToast(msg, type = 'info') {
  let t = document.getElementById('authToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'authToast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `auth-toast auth-toast-${type}`;
  t.classList.add('show');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('show'), 4500);
}

// ─── Manejo de modales de auth ────────────────────────────────────────────────

const AuthModals = {
  _forgotMode: false,

  _overlay()   { return document.getElementById('authModalOverlay');  },
  _loginModal(){ return document.getElementById('authLoginModal');     },
  _regModal()  { return document.getElementById('authRegisterModal'); },

  _hideAll() {
    [this._loginModal(), this._regModal()].forEach(m => m && m.classList.remove('show'));
  },

  openLogin() {
    this._forgotMode = false;
    this._overlay()?.classList.add('show');
    this._hideAll();
    this._loginModal()?.classList.add('show');
    this._switchForgot(false);
    setTimeout(() => document.getElementById('authLoginEmail')?.focus(), 100);
  },

  openRegister() {
    this._overlay()?.classList.add('show');
    this._hideAll();
    this._regModal()?.classList.add('show');
    setTimeout(() => document.getElementById('authRegNombre')?.focus(), 100);
  },

  closeAll() {
    this._overlay()?.classList.remove('show');
    this._hideAll();
    ['authLoginErr','authRegErr','authForgotErr'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  },

  _switchForgot(on) {
    this._forgotMode = on;
    const loginFields  = document.getElementById('authLoginFields');
    const forgotFields = document.getElementById('authForgotFields');
    const loginTitle   = document.getElementById('authLoginTitle');
    if (loginFields)  loginFields.style.display  = on ? 'none' : '';
    if (forgotFields) forgotFields.style.display = on ? '' : 'none';
    if (loginTitle)   loginTitle.textContent      = on ? 'Recuperar contraseña' : 'Iniciar sesión';
  },

  // ─── Submit login ─────────────────────────────────────────────────────────
  async submitLogin(e) {
    e.preventDefault();
    const errEl = document.getElementById('authLoginErr');
    const btn   = document.getElementById('authLoginBtn');

    if (this._forgotMode) {
      await this.submitForgot();
      return;
    }

    const email = document.getElementById('authLoginEmail')?.value?.trim();
    const pass  = document.getElementById('authLoginPass')?.value;

    if (!email || !pass) { errEl.textContent = 'Completa todos los campos.'; return; }

    btn.disabled = true;
    btn.textContent = 'Ingresando…';
    errEl.textContent = '';

    const result = await UserAuth.login({ email, password: pass });

    btn.disabled = false;
    btn.textContent = 'Ingresar';

    if (result.error) {
      errEl.textContent = result.error;
      return;
    }

    this.closeAll();
    const nombre = UserAuth.getProfile()?.nombre_completo?.split(' ')[0] || '';
    showAuthToast(`¡Bienvenido${nombre ? ', ' + nombre : ''}!`, 'success');
  },

  // ─── Submit registro ──────────────────────────────────────────────────────
  async submitRegister(e) {
    e.preventDefault();
    const errEl = document.getElementById('authRegErr');
    const btn   = document.getElementById('authRegBtn');

    const nombre   = document.getElementById('authRegNombre')?.value   || '';
    const dni      = document.getElementById('authRegDni')?.value      || '';
    const telefono = document.getElementById('authRegTelefono')?.value || '';
    const email    = document.getElementById('authRegEmail')?.value    || '';
    const pass     = document.getElementById('authRegPass')?.value     || '';
    const pass2    = document.getElementById('authRegPass2')?.value    || '';

    errEl.textContent = '';

    // Validaciones cliente
    if (!nombre.trim() || !dni.trim() || !telefono.trim() || !email.trim() || !pass || !pass2) {
      errEl.textContent = 'Completa todos los campos obligatorios.'; return;
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/.test(nombre.trim())) {
      errEl.textContent = 'El nombre solo debe contener letras, sin números.'; return;
    }
    if (nombre.trim().split(/\s+/).filter(Boolean).length < 2) {
      errEl.textContent = 'Escribe tu nombre y apellido (al menos 2 palabras).'; return;
    }
    if (!/^\d{8}$/.test(dni.trim())) {
      errEl.textContent = 'El DNI debe tener exactamente 8 dígitos numéricos.'; return;
    }
    if (!/^9\d{8}$/.test(telefono.trim())) {
      errEl.textContent = 'Celular inválido — debe tener 9 dígitos y comenzar con 9.'; return;
    }
    if (/^(\d)\1{8}$/.test(telefono.trim())) {
      errEl.textContent = 'Número de celular inválido — no pueden ser todos iguales.'; return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      errEl.textContent = 'Correo electrónico inválido.'; return;
    }
    if (pass.length < 8) {
      errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return;
    }
    if (pass !== pass2) {
      errEl.textContent = 'Las contraseñas no coinciden.'; return;
    }

    btn.disabled = true;
    btn.textContent = 'Creando cuenta…';
    errEl.textContent = '';

    let result;
    try {
      result = await UserAuth.register({ nombre, dni, telefono, email, password: pass });
    } catch (err) {
      result = { error: 'Error de conexión. Verifica tu internet e inténtalo de nuevo.' };
    }

    btn.disabled = false;
    btn.textContent = 'Crear Cuenta';

    if (result.error) { errEl.textContent = result.error; return; }

    // Cuenta creada → mostrar éxito y abrir login
    this.closeAll();
    showAuthToast('¡Genial! Tu cuenta fue registrada. Ahora inicia sesión.', 'success');
    setTimeout(() => this.openLogin(), 2200);
  },

  // ─── Submit recuperar contraseña ──────────────────────────────────────────
  async submitForgot() {
    const errEl = document.getElementById('authForgotErr');
    const btn   = document.getElementById('authLoginBtn');
    const email = document.getElementById('authForgotEmail')?.value?.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errEl.textContent = 'Ingresa un correo electrónico válido.'; return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando…';
    errEl.textContent = '';

    const result = await UserAuth.resetPassword(email);

    btn.disabled = false;
    btn.textContent = 'Enviar';

    if (result.error) { errEl.textContent = result.error; return; }

    errEl.style.color = 'var(--gold)';
    errEl.textContent = 'Correo enviado. Revisa tu bandeja de entrada.';
    setTimeout(() => { errEl.style.color = ''; this._switchForgot(false); }, 3500);
  }
};

// ─── Inicialización al cargar el DOM ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await UserAuth.init();

  // ── Botones login/registro header desktop ────────────────────────────────
  document.getElementById('headerLoginBtn')?.addEventListener('click', () => AuthModals.openLogin());
  document.getElementById('headerRegisterBtn')?.addEventListener('click', () => AuthModals.openRegister());

  // ── Dropdown del usuario (desktop) ───────────────────────────────────────
  const hudTrigger  = document.getElementById('headerUserTrigger');
  const hudDropdown = document.getElementById('headerUserDropdown');

  function openHud() {
    hudDropdown?.classList.add('open');
    hudTrigger?.setAttribute('aria-expanded', 'true');
  }
  function closeHud() {
    hudDropdown?.classList.remove('open');
    hudTrigger?.setAttribute('aria-expanded', 'false');
    // Cerrar también el panel de contraseña
    document.getElementById('headerPassPanel')?.classList.remove('open');
    document.getElementById('headerChangePassBtn')?.setAttribute('aria-expanded', 'false');
  }

  hudTrigger?.addEventListener('click', e => {
    e.stopPropagation();
    hudDropdown?.classList.contains('open') ? closeHud() : openHud();
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', e => {
    if (!e.target.closest('.hud-wrapper')) closeHud();
  });

  // Mis compras (desktop)
  document.getElementById('headerHistoryBtn')?.addEventListener('click', () => {
    closeHud();
    openHistoryModal();
  });

  // Cambiar contraseña toggle (desktop)
  document.getElementById('headerChangePassBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    const panel = document.getElementById('headerPassPanel');
    const btn   = document.getElementById('headerChangePassBtn');
    const open  = panel?.classList.toggle('open');
    btn?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) document.getElementById('hudNewPass')?.focus();
  });

  // Guardar contraseña (desktop)
  document.getElementById('hudSavePassBtn')?.addEventListener('click', () =>
    _handleChangePassword(
      document.getElementById('hudNewPass')?.value,
      document.getElementById('hudNewPass2')?.value,
      document.getElementById('hudPassErr'),
      document.getElementById('hudSavePassBtn'),
      () => {
        document.getElementById('hudNewPass').value  = '';
        document.getElementById('hudNewPass2').value = '';
        setTimeout(closeHud, 1800);
      }
    )
  );

  // Cerrar sesión (desktop)
  document.getElementById('headerLogoutBtn')?.addEventListener('click', async () => {
    closeHud();
    await UserAuth.logout();
    showAuthToast('Sesión cerrada.', 'info');
  });

  // ── Menú móvil ────────────────────────────────────────────────────────────
  const closeMobileMenu = () => {
    document.getElementById('mobileMenu')?.classList.remove('open');
    document.body.style.overflow = '';
  };

  document.getElementById('mobileLoginBtn')?.addEventListener('click', () => {
    closeMobileMenu(); AuthModals.openLogin();
  });
  document.getElementById('mobileRegisterBtn')?.addEventListener('click', () => {
    closeMobileMenu(); AuthModals.openRegister();
  });

  // Mis compras (móvil)
  document.getElementById('mobileHistoryBtn')?.addEventListener('click', () => {
    closeMobileMenu(); openHistoryModal();
  });

  // Cambiar contraseña (móvil)
  document.getElementById('mobileChangePassBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('mobilePassPanel');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) document.getElementById('mobNewPass')?.focus();
  });

  document.getElementById('mobSavePassBtn')?.addEventListener('click', () =>
    _handleChangePassword(
      document.getElementById('mobNewPass')?.value,
      document.getElementById('mobNewPass2')?.value,
      document.getElementById('mobPassErr'),
      document.getElementById('mobSavePassBtn'),
      () => {
        document.getElementById('mobNewPass').value  = '';
        document.getElementById('mobNewPass2').value = '';
        document.getElementById('mobilePassPanel').style.display = 'none';
      }
    )
  );

  // Cerrar sesión (móvil)
  document.getElementById('mobileLogoutBtn')?.addEventListener('click', async () => {
    closeMobileMenu();
    await UserAuth.logout();
    showAuthToast('Sesión cerrada.', 'info');
  });

  // ── Modales auth ──────────────────────────────────────────────────────────
  document.getElementById('authModalOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'authModalOverlay') AuthModals.closeAll();
  });
  document.querySelectorAll('.auth-modal-close').forEach(btn =>
    btn.addEventListener('click', () => AuthModals.closeAll())
  );
  document.getElementById('authLoginForm')?.addEventListener('submit',    e => AuthModals.submitLogin(e));
  document.getElementById('authRegisterForm')?.addEventListener('submit', e => AuthModals.submitRegister(e));
  document.getElementById('authSwitchToRegister')?.addEventListener('click', () => AuthModals.openRegister());
  document.getElementById('authSwitchToLogin')?.addEventListener('click',    () => AuthModals.openLogin());
  document.getElementById('authForgotLink')?.addEventListener('click', e => {
    e.preventDefault();
    AuthModals._switchForgot(true);
    setTimeout(() => document.getElementById('authForgotEmail')?.focus(), 100);
  });
  document.getElementById('authBackToLogin')?.addEventListener('click', e => {
    e.preventDefault(); AuthModals._switchForgot(false);
  });

  // ── Banner promocional ────────────────────────────────────────────────────
  document.getElementById('promoBannerCta')?.addEventListener('click', () => {
    const action = document.getElementById('promoBannerCta')?.dataset.action;
    if (action === 'register') AuthModals.openRegister();
    else document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('promoBannerClose')?.addEventListener('click', () => {
    sessionStorage.setItem('promoBannerDismissed', '1');
    const banner = document.getElementById('promoBanner');
    if (banner) banner.style.display = 'none';
  });

  // ── Modal historial ───────────────────────────────────────────────────────
  document.getElementById('historyCloseBtn')?.addEventListener('click', closeHistoryModal);
  document.getElementById('historyOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'historyOverlay') closeHistoryModal();
  });

  // ── Toggle contraseñas en formularios ─────────────────────────────────────
  document.querySelectorAll('.auth-toggle-pass').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isPass = input.type === 'password';
      input.type   = isPass ? 'text' : 'password';
      btn.innerHTML = isPass
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    });
  });
});
