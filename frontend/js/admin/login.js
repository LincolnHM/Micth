document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!SUPABASE_READY) {
      showNoDbScreen();
      return;
    }

    const sessionResult = await withTimeout(db.auth.getSession(), 12000, 'la sesión de admin');
    const session = sessionResult?.data?.session;
    if (!session) { showLoginScreen(); return; }

    // Ruta rápida: el JWT ya tiene app_metadata si el token se renovó después
    // de ejecutar el SQL. Si no lo tiene, se verifica con getUser() (más lento).
    if (isAdminUser(session.user)) {
      await showDashboard();
    } else {
      // Token viejo — verificar con datos frescos del servidor
      const userResult = await withTimeout(db.auth.getUser(), 12000, 'la verificación del usuario');
      const user = userResult?.data?.user;
      const userErr = userResult?.error;
      if (userErr || !isAdminUser(user)) {
        await db.auth.signOut();
        showLoginScreen();
        const errEl = document.getElementById('loginError');
        if (errEl) { errEl.textContent = 'Acceso denegado. Esta cuenta no tiene permisos de administrador.'; errEl.style.display = 'block'; }
      } else {
        await showDashboard();
      }
    }
  } catch (err) {
    console.error('[MICHT] Error inicializando admin:', err);
    showLoginScreen();
    const errEl = document.getElementById('loginError');
    if (errEl) {
      errEl.textContent = 'No se pudo cargar el acceso al admin. Recarga la página e inténtalo otra vez.';
      errEl.style.display = 'block';
    }
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await db.auth.signOut();
    showLoginScreen();
  });
});

// ─── Auth screens ─────────────────────────────────────────────────────────────

function showLoginScreen() {
  document.getElementById('loginSection').style.display    = 'flex';
  document.getElementById('dashboardSection').style.display = 'none';
  const form      = document.getElementById('loginForm');
  const set       = document.getElementById('setPasswordForm');
  const emailWrap = document.getElementById('loginEmailWrap');
  // Solo Supabase Auth — siempre pide correo + contraseña
  form.style.display = 'block';
  set.style.display  = 'none';
  if (emailWrap) emailWrap.style.display = 'block';
  form.onsubmit = handleLogin;
}

function showNoDbScreen() {
  document.getElementById('loginSection').style.display     = 'flex';
  document.getElementById('dashboardSection').style.display = 'none';
  const box = document.createElement('div');
  box.style.cssText = 'text-align:center;padding:2rem;color:var(--text2);max-width:360px;margin:auto';
  box.innerHTML = `
    <div style="font-size:2.5rem;margin-bottom:1rem">⚠️</div>
    <h2 style="color:var(--gold);margin-bottom:.5rem">Sin conexión</h2>
    <p style="font-size:.9rem;line-height:1.6">
      No se pudo conectar con la base de datos.<br>
      Verifica tu conexión a internet y recarga la página.
    </p>
    <button onclick="location.reload()" style="margin-top:1.5rem;padding:.6rem 1.5rem;background:var(--gold);color:#111;border:none;border-radius:6px;font-weight:700;cursor:pointer">
      Recargar
    </button>
  `;
  document.getElementById('loginSection').innerHTML = '';
  document.getElementById('loginSection').appendChild(box);
}

let _dashboardReady = false;

async function showDashboard() {
  document.getElementById('loginSection').style.display    = 'none';
  document.getElementById('dashboardSection').style.display = 'block';

  if (!_dashboardReady) {
    _dashboardReady = true;
    setupAdminEvents();
    setupOrderEvents();
    setupUsersEvents();
    setupAccountingEvents();
    setupPreciosEvents();
    setupComboEvents();
    setupNav();
    setupSidebarControls();
  }

  renderAdminProducts().catch(err => {
    console.error('[MICHT] Error cargando perfumes:', err);
    setAdminErrorState('adminProductList', 'No se pudieron cargar los perfumes', 'La carga falló o tardó demasiado. Vuelve a intentar desde el panel.');
  });
  renderOrdersSection().catch(err => {
    console.error('[MICHT] Error cargando pedidos:', err);
    setAdminErrorState('ordersTableBody', 'No se pudieron cargar los pedidos', 'La tabla no pudo completarse. Recarga el panel para intentar de nuevo.');
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const email = (document.getElementById('loginEmail')?.value || '').trim();
  const pw    = document.getElementById('loginPassword').value;
  const err   = document.getElementById('loginError');
  err.style.display = 'none';

  if (!email) { err.textContent = 'Ingresa tu correo electrónico.'; err.style.display = 'block'; return; }
  if (!pw)    { err.textContent = 'Ingresa tu contraseña.'; err.style.display = 'block'; return; }

  const btn = e.target.querySelector('button[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Verificando…'; }

  const { data: loginData, error } = await db.auth.signInWithPassword({ email, password: pw });

  if (btn) { btn.disabled = false; btn.textContent = 'Ingresar'; }

  if (error) {
    err.textContent = 'Correo o contraseña incorrectos.';
    err.style.display = 'block';
    return;
  }

  // signInWithPassword devuelve el user con app_metadata del servidor (siempre fresco)
  if (!isAdminUser(loginData?.user)) {
    await db.auth.signOut();
    err.textContent = 'Esta cuenta no tiene permisos de administrador.';
    err.style.display = 'block';
    return;
  }

  await showDashboard();
}
