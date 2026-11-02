// ═══════════════════════════════════════════════════════════════════════════════
// ─── TRABAJADORES (vista del admin) ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Una tarjeta por trabajadora (vendedora): lo que vendió en el periodo, su meta del
// mes, el dinero que tiene por entregarte, ventas por día, lo que más vende, cómo
// le pagan y sus últimas ventas. Desde aquí también se agrega una trabajadora, se
// edita, se le cambia la contraseña o se pausa su acceso.
//
// Necesita backend/supabase/sql/2026-11-02-vendedoras.sql. Con
// 2026-11-03-trabajadores.sql además se ven correo, último ingreso, teléfono y
// meta, y se puede agregar / cambiar contraseña sin ir al SQL Editor.

let _wkPeriod = 'mes';
let _wkFull   = true;        // false = falta 2026-11-03-trabajadores.sql (datos y botones limitados)

const _WK_PERIODS = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes', pasado: 'Mes pasado', todo: 'Todo' };

function _wkRange(period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'hoy')    return [today, null];
  if (period === 'semana') { const d = new Date(today); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [d, null]; }
  if (period === 'mes')    return [new Date(now.getFullYear(), now.getMonth(), 1), null];
  if (period === 'pasado') return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
  return [new Date(2000, 0, 1), null];
}

function _wkAgo(d) {
  if (!d) return 'Nunca';
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 2)    return 'Hace un momento';
  if (min < 60)   return `Hace ${min} min`;
  if (min < 1440) return `Hace ${Math.round(min / 60)} h`;
  const days = Math.round(min / 1440);
  if (days === 1) return 'Ayer';
  if (days < 7)   return `Hace ${days} días`;
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const _wkDay   = d => new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
const _wkUnits = o => flattenOrderItems(o.items).reduce((s, i) => s + (parseInt(i.quantity) || 1), 0);
const _wkWa    = phone => {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length === 9 && d.startsWith('9') ? '51' + d : d;
};

// Contraseña fácil de dictar: Micht + 4 números + 2 letras
function _wkNewPassword() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  const nums = Array.from(b.slice(0, 4), x => x % 10).join('');
  const letters = Array.from(b.slice(4), x => 'abcdefghjkmnpqrstuvwxyz'[x % 23]).join('');
  return `Micht${nums}${letters}`;
}

async function _wkLoadWorkers() {
  const r = await db.rpc('admin_trabajadores');
  if (!r.error) {
    _wkFull = true;
    return (r.data || []).map(w => ({
      id: w.user_id, name: w.nombre, active: w.activa, phone: w.telefono || '',
      meta: parseFloat(w.meta_mensual) || 0, createdAt: w.created_at, email: w.correo || '', lastLogin: w.ultimo_ingreso
    }));
  }
  // Sin 2026-11-03-trabajadores.sql: lo básico desde la tabla
  _wkFull = false;
  const { data, error } = await db.from('vendedoras').select('*').order('nombre');
  if (error) throw error;
  return (data || []).map(w => ({
    id: w.user_id, name: w.nombre, active: w.activa, phone: w.telefono || '',
    meta: parseFloat(w.meta_mensual) || 0, createdAt: w.created_at, email: '', lastLogin: null
  }));
}

function _wkStats(w, orders) {
  const [from, to] = _wkRange(_wkPeriod);
  const inRange = d => { const t = new Date(d); return t >= from && (!to || t < to); };
  const mine    = orders.filter(o => o.vendedoraId === w.id);
  const valid   = mine.filter(o => o.status !== 'cancelado');
  const period  = valid.filter(o => inRange(o.date));
  const sold    = period.reduce((s, o) => s + o.total, 0);

  // Meta: siempre el mes en curso
  const now = new Date();
  const monthSold = valid.filter(o => { const t = new Date(o.date); return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth(); })
    .reduce((s, o) => s + o.total, 0);

  // Dinero que tiene ella y su última entrega
  const pending = valid.filter(o => !o.rendidoAt);
  const lastAt  = mine.map(o => o.rendidoAt).filter(Boolean).sort().pop() || null;
  const lastAmt = lastAt ? valid.filter(o => o.rendidoAt === lastAt).reduce((s, o) => s + orderPaidAmount(o), 0) : 0;

  // Ventas por día (del periodo; en "Todo", los últimos 30 días)
  const dayFrom = _wkPeriod === 'todo' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29) : from;
  const dayTo   = to || new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const days = [];
  for (let d = new Date(dayFrom); d < dayTo && days.length < 31; d.setDate(d.getDate() + 1)) {
    const key = d.toLocaleDateString('en-CA');
    days.push({ key, label: d.getDate(), total: 0 });
  }
  const byKey = new Map(days.map(x => [x.key, x]));
  valid.forEach(o => { const k = new Date(o.date).toLocaleDateString('en-CA'); if (byKey.has(k)) byKey.get(k).total += o.total; });

  // Lo que más vende (los perfumes de un combo cuentan uno por uno)
  const top = new Map();
  period.forEach(o => flattenOrderItems(o.items).forEach(i => {
    const name = `${i.brand || ''} ${i.productName || i.name || ''}`.trim();
    if (!name) return;
    top.set(name, (top.get(name) || 0) + (parseInt(i.quantity) || 1));
  }));

  // Cómo le pagan
  const methods = {};
  period.forEach(o => orderPayments(o).forEach(p => { methods[p.method || 'otro'] = (methods[p.method || 'otro'] || 0) + p.amount; }));

  return {
    sold, count: period.length, units: period.reduce((s, o) => s + _wkUnits(o), 0),
    avg: period.length ? sold / period.length : 0,
    voided: mine.filter(o => o.anuladoVendedoraAt && inRange(o.anuladoVendedoraAt)).length,
    monthSold, pending, owes: pending.reduce((s, o) => s + orderPaidAmount(o), 0),
    lastAt, lastAmt, days,
    top: [...top].sort((a, b) => b[1] - a[1]).slice(0, 5),
    methods, recent: mine.slice(0, 6),
  };
}

function _wkCardHtml(w, s) {
  const pct = w.meta > 0 ? Math.min(100, Math.round(s.monthSold / w.meta * 100)) : 0;
  const maxDay = Math.max(1, ...s.days.map(d => d.total));
  const monthName = new Date().toLocaleDateString('es-PE', { month: 'long' });
  const wa = w.phone ? _wkWa(w.phone) : '';
  return `
  <article class="wk-card ${w.active ? '' : 'is-off'}" data-id="${escapeAttr(w.id)}">
    <header class="wk-head">
      <div class="wk-avatar" aria-hidden="true">${sanitize((w.name || '?').charAt(0).toUpperCase())}</div>
      <div class="wk-id">
        <h3>${sanitize(w.name)} <span class="wk-status ${w.active ? 'on' : 'off'}">${w.active ? 'Activa' : 'Pausada'}</span></h3>
        <p>${w.email ? sanitize(w.email) : ''}${w.email && w.phone ? ' · ' : ''}${w.phone ? `<a href="https://wa.me/${escapeAttr(wa)}" target="_blank" rel="noopener noreferrer">📱 ${sanitize(w.phone)}</a>` : ''}</p>
        <p class="wk-sub">${_wkFull ? `Último ingreso: <b>${_wkAgo(w.lastLogin)}</b> · ` : ''}Desde ${w.createdAt ? new Date(w.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}</p>
      </div>
      <div class="wk-actions">
        <button type="button" class="wk-btn" data-act="edit">Editar</button>
        ${_wkFull ? '<button type="button" class="wk-btn" data-act="pass">Contraseña</button>' : ''}
        <button type="button" class="wk-btn ${w.active ? 'warn' : ''}" data-act="toggle">${w.active ? 'Pausar' : 'Reactivar'}</button>
      </div>
    </header>

    <div class="wk-kpis">
      <div><span>Vendido</span><b>${money(s.sold)}</b></div>
      <div><span>Pedidos</span><b>${s.count}</b></div>
      <div><span>Productos</span><b>${s.units}</b></div>
      <div><span>Ticket promedio</span><b>${money(s.avg)}</b></div>
    </div>
    ${s.voided ? `<p class="sa-note">⚠ Anuló ${s.voided} ${s.voided === 1 ? 'venta' : 'ventas'} en este periodo (revísalas en Pedidos → Cancelado).</p>` : ''}

    <div class="wk-row">
      <div class="wk-goal">
        ${w.meta > 0 ? `
          <span>Meta de ${sanitize(monthName)}</span>
          <b>${money(s.monthSold)} <small>de ${money(w.meta)}</small></b>
          <div class="wk-bar ${pct >= 100 ? 'done' : ''}"><span style="width:${pct}%"></span></div>
          <small>${pct >= 100 ? '🎉 ¡Meta cumplida!' : `${pct}% · faltan ${money(Math.max(0, w.meta - s.monthSold))}`}</small>`
        : `<span>Meta del mes</span><small>Sin meta.</small>
           <button type="button" class="wk-link" data-act="edit">+ Ponerle una meta</button>`}
      </div>
      <div class="sa-owe ${s.owes > 0 ? '' : 'is-zero'}">
        <span>Tiene por entregarte</span>
        <b>${money(s.owes)}</b>
        ${s.owes > 0 ? `<button type="button" class="btn-order-collect" data-act="receive">Recibí dinero</button>` : '<small>Al día ✓</small>'}
        <small class="wk-last">${s.lastAt ? `Última entrega: ${_wkDay(s.lastAt)} · ${money(s.lastAmt)}` : 'Aún no te entregó dinero'}${s.pending.length ? ` · ${s.pending.length} ${s.pending.length === 1 ? 'venta pendiente' : 'ventas pendientes'}` : ''}</small>
      </div>
    </div>

    <div class="wk-cols">
      <section>
        <h4>Ventas por día</h4>
        ${s.days.length > 1 ? `<div class="wk-chart" role="img" aria-label="Ventas por día">
          ${s.days.map(d => `<div class="wk-col" title="${d.key}: ${money(d.total)}"><i style="height:${Math.round(d.total / maxDay * 100)}%"></i><small>${d.label}</small></div>`).join('')}
        </div>` : `<p class="wk-empty">${money(s.sold)} hoy</p>`}
      </section>
      <section>
        <h4>Lo que más vende</h4>
        ${s.top.length ? `<ol class="wk-top">${s.top.map(([n, q]) => `<li><span>${sanitize(n)}</span><b>${q}</b></li>`).join('')}</ol>` : '<p class="wk-empty">Sin ventas en este periodo.</p>'}
      </section>
    </div>

    ${Object.keys(s.methods).length ? `<div class="wk-methods">${Object.entries(s.methods).map(([m, v]) =>
      `<span>${PAYMENT_METHODS[m]?.icon || '💵'} ${PAYMENT_METHODS[m]?.label || 'Otro'} <b>${money(v)}</b></span>`).join('')}</div>` : ''}

    <section class="wk-recent">
      <h4>Últimas ventas</h4>
      ${s.recent.length ? s.recent.map(o => `
        <button type="button" class="wk-order" data-order="${escapeAttr(o.id)}">
          <span>${_wkDay(o.date)} · ${sanitize(o.customerName || '—')}</span>
          <small>${o.anuladoVendedoraAt ? 'Anulada' : o.status === 'cancelado' ? 'Cancelada' : o.rendidoAt ? '✓ Entregado' : '💰 Por entregar'}</small>
          <b>${money(o.total)}</b>
        </button>`).join('') : '<p class="wk-empty">Todavía no registra ventas.</p>'}
      ${s.recent.length ? '<button type="button" class="wk-link" data-act="orders">Ver todas sus ventas en Pedidos →</button>' : ''}
    </section>
  </article>`;
}

async function renderWorkersSection() {
  const box = document.getElementById('workersContent');
  if (!box || !db) return;
  box.innerHTML = '<p class="wk-empty">Cargando trabajadoras…</p>';

  let workers;
  try {
    workers = await _wkLoadWorkers();
  } catch (err) {
    box.innerHTML = `<div class="wk-notice">Para usar esta sección corre en Supabase → SQL Editor el archivo
      <code>backend/supabase/sql/2026-11-02-vendedoras.sql</code> y luego <code>2026-11-03-trabajadores.sql</code>.</div>`;
    document.getElementById('addWorkerBtn').hidden = true;
    return;
  }
  document.getElementById('addWorkerBtn').hidden = !_wkFull;

  const orders = await CloudOrders.getAll().catch(() => []);
  const stats = new Map(workers.map(w => [w.id, _wkStats(w, orders)]));
  const team = [...stats.values()];

  box.innerHTML = `
    ${_wkFull ? '' : `<div class="wk-notice">Para ver correo, último ingreso, teléfono y meta, y para agregar trabajadoras o cambiar contraseñas desde aquí, corre <code>backend/supabase/sql/2026-11-03-trabajadores.sql</code> en Supabase → SQL Editor.</div>`}
    <div class="seller-chips wk-periods">
      ${Object.entries(_WK_PERIODS).map(([k, v]) => `<button type="button" data-period="${k}" class="${k === _wkPeriod ? 'active' : ''}">${v}</button>`).join('')}
    </div>
    ${workers.length > 1 ? `
    <div class="wk-team">
      <div><span>Vendido por el equipo</span><b>${money(team.reduce((s, x) => s + x.sold, 0))}</b></div>
      <div><span>Pedidos</span><b>${team.reduce((s, x) => s + x.count, 0)}</b></div>
      <div><span>Por entregarte</span><b>${money(team.reduce((s, x) => s + x.owes, 0))}</b></div>
    </div>` : ''}
    ${workers.length ? `<div class="wk-grid">${workers.map(w => _wkCardHtml(w, stats.get(w.id))).join('')}</div>`
      : `<div class="wk-empty-box">
           <p>Todavía no tienes trabajadoras.</p>
           ${_wkFull ? '<button type="button" class="btn-add" id="addWorkerEmpty">+ Agregar trabajadora</button>' : ''}
         </div>`}`;

  box.querySelectorAll('[data-period]').forEach(b => b.addEventListener('click', () => {
    _wkPeriod = b.dataset.period;
    renderWorkersSection().catch(console.error);
  }));
  box.querySelector('#addWorkerEmpty')?.addEventListener('click', _wkOpenAdd);
  box.querySelectorAll('.wk-card').forEach(card => {
    const w = workers.find(x => x.id === card.dataset.id);
    const s = stats.get(w.id);
    card.addEventListener('click', e => {
      const order = e.target.closest('[data-order]');
      if (order) { openOrderDetail(order.dataset.order).catch(console.error); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'edit')    _wkOpenEdit(w);
      if (act === 'pass')    _wkOpenPassword(w);
      if (act === 'toggle')  _wkToggle(w);
      if (act === 'receive') _saOpenReceive({ name: w.name, pending: s.pending, owes: s.owes }, renderWorkersSection);
      if (act === 'orders') {
        orderSellerFilter = w.id;
        document.querySelector('.admin-nav-btn[data-section="orders"]')?.click();
      }
    });
  });
}

// ── Ventanitas ───────────────────────────────────────────────────────────────

function _wkModal(title, bodyHtml, okLabel, onOk) {
  const overlay = document.createElement('div');
  overlay.className = 'sa-overlay';
  overlay.innerHTML = `
    <form class="sa-modal wk-form" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}" novalidate>
      <h3>${sanitize(title)}</h3>
      ${bodyHtml}
      <p class="wk-error" hidden></p>
      <div class="sa-modal-foot">
        <button type="button" class="btn-cancel" data-act="cancel">Cancelar</button>
        <button type="submit" class="btn-save">${sanitize(okLabel)}</button>
      </div>
    </form>`;
  document.body.appendChild(overlay);
  const form = overlay.querySelector('form');
  const errEl = overlay.querySelector('.wk-error');
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', close);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.hidden = true;
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const keepOpen = await onOk(form, close);
      if (!keepOpen) close();
    } catch (err) {
      errEl.textContent = '⚠ ' + (err.message || err);
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
  form.querySelector('input')?.focus();
  return overlay;
}

const _wkPassField = (label, value) => `
  <label class="wk-field"><span>${label}</span>
    <div class="wk-pass-row">
      <input type="text" name="password" value="${escapeAttr(value)}" minlength="8" maxlength="72" autocomplete="off" spellcheck="false">
      <button type="button" class="wk-btn" data-gen>Otra</button>
    </div>
    <small>Mínimo 8 caracteres. Anótala: se la tienes que pasar.</small>
  </label>`;

function _wkBindGen(overlay) {
  overlay.querySelector('[data-gen]')?.addEventListener('click', () => {
    overlay.querySelector('input[name=password]').value = _wkNewPassword();
  });
}

// Después de crear la cuenta o cambiar la clave: los datos listos para pasárselos
function _wkShowAccess(name, email, password, phone) {
  const text = `Hola ${name}, tu acceso al panel de MICHT Decants:\n🌐 michtdecants.com/admin/\n📧 ${email}\n🔑 ${password}`;
  const wa = phone ? `https://wa.me/${_wkWa(phone)}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  const ov = _wkModal('Acceso listo ✓', `
    <p class="sa-note" style="color:var(--text2)">Pásale estos datos a ${sanitize(name)}:</p>
    <pre class="wk-access">${sanitize(text).replace(/\n/g, '<br>')}</pre>
    <a class="btn-add wk-wa" href="${escapeAttr(wa)}" target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>`,
    'Listo', async () => false);
  ov.querySelector('[data-act="cancel"]')?.remove();
}

function _wkOpenAdd() {
  const ov = _wkModal('Agregar trabajadora', `
    <label class="wk-field"><span>Nombre *</span><input type="text" name="name" maxlength="60" required></label>
    <label class="wk-field"><span>Correo con el que va a entrar *</span><input type="email" name="email" inputmode="email" autocapitalize="off" spellcheck="false" required></label>
    ${_wkPassField('Contraseña *', _wkNewPassword())}
    <label class="wk-field"><span>Celular (opcional)</span><input type="tel" name="phone" inputmode="tel" maxlength="20"></label>`,
    'Crear acceso', async form => {
      const f = Object.fromEntries(new FormData(form));
      const email = String(f.email || '').replace(/\s+/g, '').toLowerCase();
      if (String(f.name || '').trim().length < 2) throw new Error('Escribe su nombre.');
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) throw new Error('Revisa el correo (ej. nombre@gmail.com).');
      if (String(f.password || '').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      const { error } = await db.rpc('admin_crear_trabajadora', {
        p_email: email, p_password: f.password, p_nombre: String(f.name).trim(), p_telefono: String(f.phone || '').trim() || null
      });
      if (error) throw new Error(error.message || error.code);
      showToast(`✓ ${String(f.name).trim()} ya tiene acceso`);
      renderWorkersSection().catch(console.error);
      _wkShowAccess(String(f.name).trim(), email, f.password, f.phone);
      return false;
    });
  _wkBindGen(ov);
}

function _wkOpenEdit(w) {
  _wkModal(`Editar a ${w.name}`, `
    <label class="wk-field"><span>Nombre</span><input type="text" name="name" maxlength="60" value="${escapeAttr(w.name)}"></label>
    <label class="wk-field"><span>Celular</span><input type="tel" name="phone" inputmode="tel" maxlength="20" value="${escapeAttr(w.phone)}"></label>
    <label class="wk-field"><span>Meta de ventas del mes (S/)</span><input type="number" name="meta" min="0" step="50" inputmode="decimal" value="${w.meta || ''}" placeholder="Ej: 1500">
      <small>Ella la ve en "Mis ventas" con su avance. Déjalo vacío para no poner meta.</small></label>`,
    'Guardar', async form => {
      const f = Object.fromEntries(new FormData(form));
      const name = String(f.name || '').trim();
      if (name.length < 2) throw new Error('Escribe su nombre.');
      const meta = Math.max(0, parseFloat(f.meta) || 0);
      const { error } = await db.from('vendedoras')
        .update({ nombre: name, telefono: String(f.phone || '').trim() || null, meta_mensual: meta })
        .eq('user_id', w.id);
      if (error) {
        if (/telefono|meta_mensual/.test(error.message || '')) throw new Error('Falta correr 2026-11-03-trabajadores.sql en Supabase para guardar celular y meta.');
        throw new Error(error.message || error.code);
      }
      showToast('✓ Datos guardados');
      renderWorkersSection().catch(console.error);
    });
}

function _wkOpenPassword(w) {
  const ov = _wkModal(`Nueva contraseña para ${w.name}`, _wkPassField('Contraseña nueva', _wkNewPassword()),
    'Cambiar contraseña', async form => {
      const pass = String(new FormData(form).get('password') || '');
      if (pass.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      const { error } = await db.rpc('admin_clave_trabajadora', { p_user_id: w.id, p_password: pass });
      if (error) throw new Error(error.message || error.code);
      showToast('✓ Contraseña cambiada');
      _wkShowAccess(w.name, w.email, pass, w.phone);
    });
  _wkBindGen(ov);
}

function _wkToggle(w) {
  const msg = w.active
    ? `¿Pausar el acceso de ${w.name}?\n\nNo podrá entrar ni registrar ventas hasta que la reactives. Sus ventas quedan guardadas.`
    : `¿Reactivar el acceso de ${w.name}?`;
  showConfirmModal(msg, async () => {
    const { error } = await db.from('vendedoras').update({ activa: !w.active }).eq('user_id', w.id);
    if (error) { alert('⚠ ' + (error.message || error.code)); return; }
    showToast(w.active ? `${w.name} quedó pausada` : `${w.name} puede volver a entrar`);
    renderWorkersSection().catch(console.error);
  }, () => {});
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addWorkerBtn')?.addEventListener('click', _wkOpenAdd);
});
