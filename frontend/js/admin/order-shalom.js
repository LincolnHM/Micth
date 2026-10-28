// ─── Envío Shalom: N° de orden, código y clave ────────────────────────────────
// Cuando despachas un pedido por Shalom, anotas aquí los datos que te da Shalom
// (los escribes tú). Cuando el cliente ya pagó todo, el panel arma el mensaje y
// se lo mandas por WhatsApp al número que te pasó.
//
// Van en su propia tabla (pedidos_shalom) que solo el admin puede leer: la tabla
// pedidos también la lee el cliente dueño del pedido («Mis compras»), y con el
// código y la clave cualquiera recoge el paquete.
// SQL: backend/supabase/sql/2026-10-27-envios-shalom.sql

const SHALOM_SQL_HINT = 'Para guardar los datos de Shalom falta un paso en Supabase: pega el archivo backend/supabase/sql/2026-10-27-envios-shalom.sql en SQL Editor y dale Run.';

const _shalomTxt = v => String(v ?? '').trim().slice(0, 40);
const _shalomMissingTable = err => !!err &&
  (err.code === '42P01' || err.code === 'PGRST205' || /schema cache/i.test(err.message || ''));

const ShalomShipments = {
  _cache: new Map(),   // id del pedido → { number, code, password, notifiedAt }

  _fromDB(r) {
    return {
      number:     _shalomTxt(r.numero_orden),
      code:       _shalomTxt(r.codigo),
      password:   _shalomTxt(r.clave),
      notifiedAt: r.avisado_at || null
    };
  },

  get(id) { return this._cache.get(id) || null; },

  // Todos de una vez (para la lista de pedidos). Si falla, la lista sigue igual.
  async loadAll() {
    if (!db) return this._cache;
    const { data, error } = await db.from('pedidos_shalom')
      .select('pedido_id, numero_orden, codigo, clave, avisado_at').limit(1000);
    if (error) {
      if (!_shalomMissingTable(error)) console.warn('[MICHT] No se pudieron leer los datos de Shalom:', error.code, error.message);
      return this._cache;
    }
    this._cache = new Map(data.map(r => [r.pedido_id, this._fromDB(r)]));
    return this._cache;
  },

  async load(id) {
    if (!db) return this.get(id);
    const { data, error } = await db.from('pedidos_shalom')
      .select('pedido_id, numero_orden, codigo, clave, avisado_at').eq('pedido_id', id).maybeSingle();
    if (error) return this.get(id);
    if (data) this._cache.set(id, this._fromDB(data));
    else this._cache.delete(id);
    return this.get(id);
  },

  _error(err) {
    if (_shalomMissingTable(err)) return new Error(SHALOM_SQL_HINT);
    if (err.code === '23503') return new Error('Este pedido todavía no se subió a Supabase. Recarga la lista e inténtalo de nuevo.');
    return new Error('No se pudieron guardar los datos de Shalom: ' + (err.message || err.code));
  },

  // Guarda N° de orden, código y clave. Si cambian después de avisar al cliente,
  // el aviso se borra: lo que tiene el cliente ya no sirve. notified: se le está
  // mandando ahora (va en la misma petición).
  async save(id, { number, code, password }, { notified = false } = {}) {
    if (!db) throw new Error('Sin conexión a la base de datos.');
    const next = { number: _shalomTxt(number), code: _shalomTxt(code), password: _shalomTxt(password) };
    const prev = this.get(id);
    if (!prev && !next.number && !next.code && !next.password) return null;
    const changed = !prev || prev.number !== next.number || prev.code !== next.code || prev.password !== next.password;
    if (!changed && !notified) return prev;
    const now = new Date().toISOString();
    const row = {
      pedido_id: id, numero_orden: next.number, codigo: next.code, clave: next.password,
      avisado_at: notified ? now : changed ? null : prev.notifiedAt, updated_at: now
    };
    const { data, error } = await db.from('pedidos_shalom').upsert(row, { onConflict: 'pedido_id' })
      .select('pedido_id, numero_orden, codigo, clave, avisado_at').maybeSingle();
    if (error) throw this._error(error);
    if (!data) throw new Error('No se pudieron guardar los datos de Shalom (tu sesión de admin venció). Cierra sesión y vuelve a entrar.');
    this._cache.set(id, this._fromDB(data));
    return this.get(id);
  }
};

// ─── Tu número de cliente admin ───────────────────────────────────────────────
// Es el número de tu cuenta de cliente en la web, con la que haces los pedidos de
// quienes no se registran: esos pedidos salen con tu número, no con el del cliente.
// Se guarda en tu cuenta de admin (sirve en todos tus dispositivos) y en este navegador.
const ClienteAdmin = {
  _KEY: 'micht_cliente_admin_tel',

  get() { try { return localStorage.getItem(this._KEY) || ''; } catch { return ''; } },

  async sync() {
    try {
      const { data } = await db.auth.getSession();
      const v = data?.session?.user?.user_metadata?.cliente_admin_telefono;
      if (typeof v === 'string') localStorage.setItem(this._KEY, v);
    } catch {}
    return this.get();
  },

  async set(phone) {
    try { localStorage.setItem(this._KEY, phone); } catch {}
    const { error } = await db.auth.updateUser({ data: { cliente_admin_telefono: phone } });
    if (error) throw new Error('Se guardó solo en este dispositivo: ' + (error.message || error.code));
  },

  is(phone) {
    const mine = peruMobile(this.get());
    return !!mine && peruMobile(phone) === mine;
  }
};

// "+51 987 654 321", "51987654321" o "987 654 321" → "987654321"; si no es un celular → ''
function peruMobile(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('51')) d = d.slice(2);
  return /^9\d{8}$/.test(d) ? d : '';
}

// El pedido no tiene el número real del cliente (vacío o el de tu cuenta de cliente admin)
const orderNeedsClientPhone = o => !peruMobile(o.customerPhone) || ClienteAdmin.is(o.customerPhone);

const orderFullyPaid = o => ['pagado', 'enviado', 'entregado'].includes(o.status) && orderBalance(o) <= 0;

// Lo que falta para poder mandarle al cliente sus datos de Shalom ([] = listo)
function shalomMissing(order, data, phone) {
  if (order.status === 'cancelado') return ['el pedido está cancelado'];
  const miss = [];
  if (!orderFullyPaid(order)) {
    const owes = orderBalance(order);
    miss.push(orderPaidAmount(order) > 0 && owes > 0 ? `que pague lo que falta (${money(owes)})` : 'que el cliente pague');
  }
  if (!data?.number)   miss.push('el N° de orden');
  if (!data?.code)     miss.push('el código');
  if (!data?.password) miss.push('la clave');
  if (!peruMobile(phone))       miss.push('el número del cliente');
  else if (ClienteAdmin.is(phone)) miss.push('el número del cliente (ahora está tu número de cliente admin)');
  return miss;
}

function shalomMessage(order, data) {
  const first = (order.customerName || '').trim().split(/\s+/)[0] || '';
  const where = [order.shalomOffice, [order.department, order.province].filter(Boolean).join(' / ')].filter(Boolean).join(' — ');
  const lines = [
    `Hola${first ? ' ' + first : ''} 👋`,
    '¡Tu pedido de MICHT Perfumes ya fue enviado por Shalom! 📦',
    '',
    'Datos para recoger tu paquete:'
  ];
  if (where) lines.push(`• Agencia: ${where}`);
  lines.push(
    `• N° de orden: ${data.number}`,
    `• Código: ${data.code}`,
    `• Clave: ${data.password}`,
    '',
    'Presenta estos datos y tu DNI en la agencia. El flete se paga al recoger.',
    '¡Gracias por tu compra! 💜'
  );
  return lines.join('\n');
}

const shalomWhatsappUrl = (phone, text) => `https://wa.me/51${peruMobile(phone)}?text=${encodeURIComponent(text)}`;

// Botón de la lista de pedidos (solo pedidos de envío)
function shalomRowButtonHtml(order) {
  if (order.deliveryType !== 'envio' || order.status === 'cancelado') return '';
  const data = ShalomShipments.get(order.id);
  const miss = shalomMissing(order, data, order.customerPhone);
  const [cls, label, title] =
      data?.notifiedAt ? ['is-sent',  '✓ Clave enviada', 'Ya le mandaste sus datos de Shalom por WhatsApp']
    : !miss.length     ? ['is-ready', '📲 Enviar clave',  'Listo para mandarle sus datos de Shalom por WhatsApp']
    :                    ['',         '📦 Datos Shalom',  'Falta: ' + miss.join(', ')];
  return `<button class="btn-order-shalom ${cls}" data-id="${escapeAttr(order.id)}" title="${escapeAttr(title)}">${label}</button>`;
}

// ─── Ventana «Envío Shalom» ───────────────────────────────────────────────────
async function openShalomDialog(orderId, { onDone = null } = {}) {
  let order, data;
  try {
    [order, data] = await withTimeout(
      Promise.all([CloudOrders.getById(orderId), ShalomShipments.load(orderId), ClienteAdmin.sync()]),
      12000, 'el pedido');
  } catch { order = null; }
  if (!order) { alert('⚠ No se pudo cargar el pedido. Revisa tu conexión e inténtalo de nuevo.'); return; }

  const id = order.id;
  const startPhone = peruMobile(order.customerPhone) || peruMobile(ClienteAdmin.get()) || order.customerPhone || '';
  const notified = data?.notifiedAt
    ? new Date(data.notifiedAt).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';
  const where = [order.shalomOffice, [order.department, order.province].filter(Boolean).join(' / ')].filter(Boolean).join(' — ');
  const field = (key, label, value, ph) => `
      <div class="shdlg-field">
        <label for="shdlg-${key}">${label}</label>
        <input id="shdlg-${key}" type="text" maxlength="40" autocomplete="off" spellcheck="false" value="${escapeAttr(value || '')}" placeholder="${ph}">
      </div>`;

  const overlay = document.createElement('div');
  overlay.className = 'paydlg-overlay';
  overlay.innerHTML = `
    <div class="paydlg shdlg" role="dialog" aria-modal="true" aria-labelledby="shdlgTitle">
      <div class="paydlg-head">
        <h3 id="shdlgTitle">📦 Envío Shalom</h3>
        <button type="button" class="paydlg-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="paydlg-body">
        <div class="paydlg-order">
          <div>
            <span class="order-id">${sanitize(id)}</span>
            <div class="paydlg-customer">${sanitize(order.customerName || '—')}</div>
          </div>
          ${deliveryBadgeHtml(order)}
        </div>
        ${where ? `<p class="shdlg-where">📍 ${sanitize(where)}</p>` : ''}

        <p class="paydlg-question">Datos de la orden Shalom<small>Los que te dio Shalom al despachar el paquete.</small></p>
        <div class="shdlg-grid">
          ${field('number',   'N° de orden', data?.number,   'Ej: 12345678')}
          ${field('code',     'Código',      data?.code,     'Ej: AB12')}
          ${field('password', 'Clave',       data?.password, 'Ej: 4821')}
        </div>

        <div class="shdlg-field">
          <label for="shdlg-phone">WhatsApp del cliente</label>
          <input id="shdlg-phone" type="tel" inputmode="tel" maxlength="20" autocomplete="off" value="${escapeAttr(startPhone)}" placeholder="9XXXXXXXX">
          <small class="shdlg-phone-note"></small>
        </div>

        <div class="paydlg-result" aria-live="polite"></div>
        <div class="shdlg-preview" hidden>
          <span>Mensaje que se enviará</span>
          <pre></pre>
        </div>

        <details class="shdlg-admin">
          <summary>👤 Tu número de cliente admin: <b class="shdlg-admin-val"></b></summary>
          <p>Es el número de tu cuenta de cliente en la web. Los pedidos que haces con esa cuenta salen con ese número; el panel lo reconoce y te pide el del cliente.</p>
          <div class="shdlg-admin-row">
            <input type="tel" inputmode="tel" maxlength="20" autocomplete="off" placeholder="9XXXXXXXX" aria-label="Tu número de cliente admin">
            <button type="button" class="paydlg-fill shdlg-admin-save">Guardar</button>
          </div>
        </details>
      </div>
      <div class="paydlg-foot">
        <button type="button" class="btn-cancel shdlg-save">Guardar</button>
        <button type="button" class="btn-save paydlg-save shdlg-send" disabled>📲 Enviar por WhatsApp</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const $ = sel => overlay.querySelector(sel);
  const inNumber = $('#shdlg-number'), inCode = $('#shdlg-code'), inPass = $('#shdlg-password');
  const inPhone  = $('#shdlg-phone'),  phoneNote = $('.shdlg-phone-note');
  const result   = $('.paydlg-result'), preview = $('.shdlg-preview');
  const saveBtn  = $('.shdlg-save'),    sendBtn = $('.shdlg-send');
  const adminVal = $('.shdlg-admin-val'), adminIn = $('.shdlg-admin-row input');

  const form = () => ({ number: _shalomTxt(inNumber.value), code: _shalomTxt(inCode.value), password: _shalomTxt(inPass.value) });
  const _dataChanged = d => !data || d.number !== data.number || d.code !== data.code || d.password !== data.password;

  const recalc = () => {
    const d     = form();
    const phone = inPhone.value.trim();
    const mine  = peruMobile(ClienteAdmin.get());
    adminVal.textContent = mine || 'sin poner';
    if (!adminIn.matches(':focus')) adminIn.value = mine;

    phoneNote.className = 'shdlg-phone-note';
    if (phone && !peruMobile(phone)) {
      phoneNote.textContent = 'Número no válido: debe ser un celular de 9 dígitos que empiece con 9.';
      phoneNote.classList.add('bad');
    } else if (ClienteAdmin.is(phone)) {
      phoneNote.textContent = 'Este es tu número de cliente admin. Cámbialo por el número que te pasó el cliente.';
      phoneNote.classList.add('warn');
    } else if (!phone) {
      phoneNote.textContent = 'El pedido no tiene número. Escribe el que te pasó el cliente.';
      phoneNote.classList.add('warn');
    } else phoneNote.textContent = '';

    const miss = shalomMissing(order, d, phone);
    if (!miss.length) {
      result.className = 'paydlg-result ok';
      result.textContent = notified && !_dataChanged(d)
        ? `✓ Todo listo. Ya se lo mandaste el ${notified}; puedes reenviarlo.`
        : '✓ Todo listo: el cliente ya pagó. Puedes mandarle sus datos por WhatsApp.';
    } else {
      const unpaid = !orderFullyPaid(order);
      result.className = 'paydlg-result ' + (unpaid ? 'warn' : 'muted');
      result.textContent = (unpaid ? 'El WhatsApp se habilita cuando el cliente pague todo. ' : '') + 'Falta: ' + miss.join(', ') + '.';
    }
    sendBtn.disabled = miss.length > 0;
    sendBtn.textContent = notified && !_dataChanged(d) ? '📲 Reenviar por WhatsApp' : '📲 Enviar por WhatsApp';
    saveBtn.disabled = !!phone && !peruMobile(phone);

    const complete = d.number && d.code && d.password;
    preview.hidden = !complete;
    if (complete) preview.querySelector('pre').textContent = shalomMessage(order, d);
  };

  [inNumber, inCode, inPass, inPhone].forEach(inp => inp.addEventListener('input', recalc));

  // Guarda los datos de Shalom y, si cambió, el número del cliente en el pedido
  // (a la vez: al mandar, las dos peticiones salen antes de abrir WhatsApp)
  const savePhone = async () => {
    const phone = peruMobile(inPhone.value);
    if (!phone || phone === peruMobile(order.customerPhone)) return;
    await CloudOrders.update(id, { customerPhone: phone });
    order = { ...order, customerPhone: phone };
  };
  const persist = (opts = {}) => Promise.all([ShalomShipments.save(id, form(), opts), savePhone()])
    .then(([saved]) => { data = saved; });
  const busy = on => { saveBtn.disabled = sendBtn.disabled = on; };
  const refresh = () => { renderOrdersSection().catch(console.error); if (onDone) onDone(); };

  saveBtn.addEventListener('click', async () => {
    busy(true);
    saveBtn.textContent = 'Guardando…';
    try {
      await withTimeout(persist(), 15000, 'los datos de Shalom');
      close();
      refresh();
      showToast('Datos de Shalom guardados ✓');
    } catch (err) {
      alert('⚠ ' + (err.message || 'No se pudieron guardar los datos.'));
      saveBtn.textContent = 'Guardar';
      recalc();
    }
  });

  sendBtn.addEventListener('click', async () => {
    if (sendBtn.disabled) return;
    const url = shalomWhatsappUrl(inPhone.value, shalomMessage(order, form()));
    // El guardado arranca primero (en el celular la página pasa al fondo al abrir
    // WhatsApp) y WhatsApp se abre aquí mismo, sin esperar: si no, el navegador
    // bloquea la ventana nueva por no venir directo del toque.
    const saving = persist({ notified: true });
    const win = window.open(url, '_blank');
    if (win) { try { win.opener = null; } catch (_) {} }
    busy(true);
    try {
      await withTimeout(saving, 15000, 'los datos de Shalom');
      close();
      refresh();
      showToast('Datos de Shalom guardados ✓ · WhatsApp abierto');
    } catch (err) {
      alert('⚠ WhatsApp se abrió, pero ' + (err.message || 'no se pudieron guardar los datos.'));
      recalc();
    }
    if (!win) window.location.href = url;
  });

  $('.shdlg-admin-save').addEventListener('click', async () => {
    const raw = adminIn.value.trim();
    const v = peruMobile(raw);
    if (raw && !v) { alert('Número no válido: debe ser un celular de 9 dígitos que empiece con 9.'); return; }
    // Si el campo del cliente tenía tu número anterior, pasa a tener el nuevo
    const hadOld = !inPhone.value.trim() || ClienteAdmin.is(inPhone.value);
    try {
      await ClienteAdmin.set(v);
      showToast(v ? 'Número de cliente admin guardado ✓' : 'Número de cliente admin borrado');
    } catch (err) {
      alert('⚠ ' + err.message);
    }
    if (hadOld && !peruMobile(order.customerPhone)) inPhone.value = v;
    $('.shdlg-admin').open = false;
    recalc();
    renderOrdersSection().catch(console.error);
  });

  const close = () => {
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 220);
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $('.paydlg-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  recalc();
  if (!('ontouchstart' in window)) (data?.number ? inPhone : inNumber).focus();
}
