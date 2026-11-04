// ═══════════════════════════════════════════════════════════════════════════════
// ─── CLUB MICHT (vista del admin) ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Tarjetas Golden y Black de los clientes: quién tiene el regalo listo, a quién
// le falta 1 (con su mensaje de WhatsApp), dar o quitar huellitas a mano y el
// historial de cada uno. Las huellitas las pone sola la base al marcar un pedido
// como pagado (backend/supabase/sql/2026-11-04-club-micht.sql).

const _CA_SLOTS = 9;
const _CA_TIERS = {
  golden: { name: 'Golden', short: '5 ml árabe',             min: 'S/ 15' },
  black:  { name: 'Black',  short: '5 ml árabe o diseñador', min: 'S/ 60' }
};
let _caFilter = 'con';      // 'con' (con huellitas) · 'todos'
let _caSearch = '';
let _caLimit  = 40;

async function renderClubSection() {
  const box = document.getElementById('clubAdminContent');
  if (!box || !db) return;
  box.innerHTML = '<p class="wk-empty">Cargando el Club…</p>';

  const [resumen, perfiles, orders] = await Promise.all([
    Promise.resolve(db.rpc('club_admin_resumen')).catch(e => ({ error: e })),
    Promise.resolve(db.from('perfiles_usuarios').select('id, nombre_completo, dni, telefono, created_at')).catch(e => ({ error: e })),
    CloudOrders.getAll().catch(() => [])
  ]);
  if (resumen.error) {
    box.innerHTML = `<div class="ca-setup">
      <h3>🐾 Activa el Club MICHT</h3>
      <p>Para que funcionen las tarjetas, corre una vez en Supabase → SQL Editor el archivo
      <code>backend/supabase/sql/2026-11-04-club-micht.sql</code>.</p>
      <small>${sanitize(resumen.error.message || '')}</small></div>`;
    return;
  }
  const byId = new Map((resumen.data || []).map(r => [r.cliente_id, r]));
  const people = (perfiles.data || []).map(p => _caMember(p, byId.get(p.id), orders));
  // Cuentas con huellitas cuyo perfil ya no está
  byId.forEach((r, id) => { if (!people.some(m => m.id === id)) people.push(_caMember({ id, nombre_completo: 'Cliente sin perfil' }, r, orders)); });

  const withStamps = people.filter(m => m.golden.saldo || m.black.saldo || m.golden.canjes || m.black.canjes || m.golden.enCamino || m.black.enCamino);
  const ready      = people.filter(m => m.golden.listo || m.black.listo);
  const near       = people.filter(m => !m.golden.listo && !m.black.listo && (m.golden.faltan === 1 || m.black.faltan === 1));
  const transit    = people.filter(m => m.golden.enCamino || m.black.enCamino);
  const delivered  = people.reduce((s, m) => s + m.golden.canjes + m.black.canjes, 0);
  const monthKey   = new Date().toISOString().slice(0, 7);
  const monthPaid  = orders.filter(o => o.clubCliente && !o.clubRegalo && isPaidStatus(o.status) && o.status !== 'separado'
                                    && o.total >= 15 && (o.date || '').slice(0, 7) === monthKey).length;

  const q = _caSearch.toLowerCase();
  let list = (_caFilter === 'con' ? withStamps : people)
    .filter(m => !q || `${m.name} ${m.dni} ${m.phone}`.toLowerCase().includes(q))
    .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));
  const total = list.length;
  list = list.slice(0, _caLimit);

  const alerts = [...ready.map(m => ({ m, kind: 'ready' })), ...near.map(m => ({ m, kind: 'near' }))];

  box.innerHTML = `
    <div class="ca-stats">
      <div class="ca-stat"><b>${withStamps.length}</b><span>Clientes con huellitas</span></div>
      <div class="ca-stat is-gold"><b>${ready.length}</b><span>Regalos listos</span></div>
      <div class="ca-stat"><b>${near.length}</b><span>A 1 del regalo</span></div>
      <div class="ca-stat"><b>${transit.length}</b><span>Regalos por entregar</span></div>
      <div class="ca-stat"><b>${delivered}</b><span>Regalos entregados</span></div>
      <div class="ca-stat"><b>${monthPaid}</b><span>Pedidos del Club este mes</span></div>
    </div>

    ${alerts.length ? `
    <section class="ca-block">
      <h3>📣 Para avisar por WhatsApp</h3>
      <div class="ca-alerts">
        ${alerts.map(({ m, kind }) => {
          const tier = kind === 'ready' ? (m.black.listo ? 'black' : 'golden') : (m.black.faltan === 1 ? 'black' : 'golden');
          return `<div class="ca-alert ca-alert--${tier}">
            <div><strong>${sanitize(m.name)}</strong>
              <small>${kind === 'ready' ? `🎁 Regalo ${_CA_TIERS[tier].name} listo` : `🐾 Le falta 1 en su ${_CA_TIERS[tier].name}`}</small></div>
            ${m.phone ? `<a class="btn-order-collect" target="_blank" rel="noopener" href="${escapeAttr(_caWaLink(m, tier, kind))}">WhatsApp</a>` : '<small>Sin celular</small>'}
          </div>`;
        }).join('')}
      </div>
    </section>` : ''}

    <section class="ca-block">
      <div class="ca-toolbar">
        <input type="search" id="caSearch" placeholder="Buscar por nombre, DNI o celular…" value="${escapeAttr(_caSearch)}">
        <div class="seller-chips ca-chips">
          <button type="button" class="${_caFilter === 'con' ? 'active' : ''}" data-ca-filter="con">Con huellitas</button>
          <button type="button" class="${_caFilter === 'todos' ? 'active' : ''}" data-ca-filter="todos">Todos los clientes</button>
        </div>
      </div>
      <div class="ca-list">
        ${list.length ? list.map(_caRowHtml).join('') : `<p class="wk-empty">${_caFilter === 'con' && !q
          ? 'Todavía nadie tiene huellitas. Aparecen cuando marcas como pagado un pedido hecho en la página por un cliente con su sesión iniciada.'
          : 'Nadie coincide con la búsqueda.'}</p>`}
      </div>
      ${total > list.length ? `<button type="button" class="ca-more" id="caMore">Ver más (${total - list.length})</button>` : ''}
    </section>

    <details class="ca-rules">
      <summary>Reglas del Club</summary>
      <ul>
        <li>Suman solo los pedidos hechos <b>en la página</b> por clientes <b>con su sesión iniciada</b> (no los que registras tú ni las ventas de las vendedoras).</li>
        <li>La huellita entra cuando marcas el pedido como <b>pagado</b> (o enviado / entregado). Si lo cancelas, se quita sola.</li>
        <li>De S/ 15 a S/ 59.99 → <b>Golden</b>. Desde S/ 60 → <b>Black</b>. Máximo 1 huellita por día. La primera compra suma 1 de bienvenida.</li>
        <li>Con 9, su pedido 10 lleva el regalo: Golden → 5 ml árabe; Black → 5 ml árabe o diseñador (sin nicho, L'Immensité ni Sauvage Elixir). El regalo aparece en el pedido a S/ 0.</li>
      </ul>
    </details>`;

  box.querySelector('#caSearch')?.addEventListener('input', e => {
    _caSearch = e.target.value.trim();
    clearTimeout(renderClubSection._t);
    renderClubSection._t = setTimeout(() => renderClubSection().then(() => {
      const inp = document.getElementById('caSearch'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }).catch(console.error), 250);
  });
  box.querySelectorAll('[data-ca-filter]').forEach(b => b.addEventListener('click', () => { _caFilter = b.dataset.caFilter; _caLimit = 40; renderClubSection().catch(console.error); }));
  box.querySelector('#caMore')?.addEventListener('click', () => { _caLimit += 40; renderClubSection().catch(console.error); });
  box.querySelectorAll('[data-ca-adjust]').forEach(b => b.addEventListener('click', () => {
    const m = people.find(x => x.id === b.dataset.id);
    if (m) _caOpenAdjust(m, b.dataset.caAdjust);
  }));
  box.querySelectorAll('[data-ca-history]').forEach(b => b.addEventListener('click', () => {
    const m = people.find(x => x.id === b.dataset.caHistory);
    if (m) _caOpenHistory(m);
  }));
}

function _caMember(p, r, orders) {
  const tier = (t, saldo, canjes) => {
    const enCamino = orders.filter(o => o.clubCliente === p.id && o.clubRegalo === t && ['pendiente', 'separado'].includes(o.status)).length;
    const libres = saldo - _CA_SLOTS * enCamino;
    const paws   = enCamino ? _CA_SLOTS : Math.max(0, Math.min(_CA_SLOTS, libres));
    return { saldo, canjes, enCamino, paws, listo: !enCamino && libres >= _CA_SLOTS, extra: Math.max(0, libres - _CA_SLOTS), faltan: Math.max(0, _CA_SLOTS - paws) };
  };
  const golden = tier('golden', r?.golden || 0, r?.golden_canjes || 0);
  const black  = tier('black',  r?.black  || 0, r?.black_canjes  || 0);
  return {
    id: p.id, name: p.nombre_completo || 'Cliente', dni: p.dni || '', phone: (p.telefono || '').replace(/\D/g, ''),
    golden, black, last: r?.ultimo || null,
    rank: (golden.listo || black.listo ? 1000 : 0) + (golden.faltan === 1 || black.faltan === 1 ? 500 : 0) + golden.paws + black.paws * 1.1
  };
}

function _caPawsHtml(t, info) {
  let dots = '';
  for (let i = 0; i < _CA_SLOTS; i++) dots += `<i class="${i < info.paws ? 'on' : ''}"></i>`;
  const state = info.enCamino ? '🚚 regalo por entregar' : info.listo ? '🎁 regalo listo' : `${info.paws}/${_CA_SLOTS}`;
  return `<div class="ca-tier ca-tier--${t}">
    <span class="ca-tier-name">${_CA_TIERS[t].name}</span>
    <span class="ca-paws">${dots}<em class="${info.listo || info.enCamino ? 'on' : ''}">🎁</em></span>
    <span class="ca-tier-state">${state}${info.extra ? ` · +${info.extra}` : ''}${info.canjes ? ` · 🏆${info.canjes}` : ''}</span>
  </div>`;
}

function _caRowHtml(m) {
  return `<div class="ca-row">
    <div class="ca-who">
      <strong>${sanitize(m.name)}</strong>
      <small>${m.dni ? `DNI ${sanitize(m.dni)}` : ''}${m.phone ? ` · <a href="https://wa.me/51${escapeAttr(m.phone)}" target="_blank" rel="noopener">${sanitize(m.phone)}</a>` : ''}</small>
    </div>
    ${_caPawsHtml('golden', m.golden)}
    ${_caPawsHtml('black', m.black)}
    <div class="ca-actions">
      <button type="button" class="wk-btn" data-ca-adjust="golden" data-id="${escapeAttr(m.id)}">± Golden</button>
      <button type="button" class="wk-btn" data-ca-adjust="black" data-id="${escapeAttr(m.id)}">± Black</button>
      <button type="button" class="wk-btn" data-ca-history="${escapeAttr(m.id)}">Historial</button>
    </div>
  </div>`;
}

function _caWaLink(m, tier, kind) {
  const first = (m.name || '').split(/\s+/)[0] || '';
  const T = _CA_TIERS[tier];
  const msg = kind === 'ready'
    ? `¡Hola ${first}! 🐾 Tu tarjeta ${T.name} del Club MICHT ya está completa. En tu próximo pedido en michtdecants.com eliges tu ${T.short} GRATIS 🎁 (solo inicia sesión y elígelo al finalizar tu pedido).`
    : `¡Hola ${first}! 🐾 Te falta solo 1 huellita en tu tarjeta ${T.name} del Club MICHT. Con tu próximo pedido desde ${T.min} en michtdecants.com la completas, y el siguiente va con un ${T.short} de regalo 🎁`;
  return `https://wa.me/51${m.phone}?text=${encodeURIComponent(msg)}`;
}

// Dar o quitar huellitas a mano
function _caOpenAdjust(m, tier) {
  const info = m[tier];
  _wkModal(`Huellitas ${_CA_TIERS[tier].name} · ${m.name}`, `
    <p class="sa-note">Ahora tiene ${info.saldo} ${info.saldo === 1 ? 'huellita' : 'huellitas'} en su ${_CA_TIERS[tier].name}.</p>
    <input type="hidden" name="sign" value="1">
    <div class="seller-chips ca-sign">
      <button type="button" class="active" data-sign="1">➕ Dar</button>
      <button type="button" data-sign="-1">➖ Quitar</button>
    </div>
    <label class="wk-field"><span>Cantidad</span><input type="number" name="n" min="1" max="9" value="1" inputmode="numeric"></label>
    <label class="wk-field"><span>Mensaje para el cliente (opcional, lo verá en su tarjeta)</span><input type="text" name="nota" maxlength="200" placeholder="Ej: Por tu cumpleaños 🎂"></label>`,
  'Guardar', async form => {
    const sign = parseInt(form.sign.value);
    const n = parseInt(form.n.value);
    if (!(n >= 1 && n <= 9)) throw new Error('La cantidad va de 1 a 9.');
    if (sign < 0 && n > info.saldo) throw new Error(`Solo tiene ${info.saldo} para quitar.`);
    const { error } = await db.from('club_sellos').insert({
      cliente_id: m.id, tarjeta: tier, tipo: 'manual', cantidad: sign * n,
      nota: form.nota.value.trim().slice(0, 200) || null
    });
    if (error) throw new Error(error.message || 'No se pudo guardar.');
    showToast(`✓ ${sign > 0 ? 'Diste' : 'Quitaste'} ${n} ${n === 1 ? 'huellita' : 'huellitas'} ${_CA_TIERS[tier].name} a ${m.name}`);
    renderClubSection().catch(console.error);
  });
  const modal = document.querySelectorAll('.sa-overlay');
  const form = modal[modal.length - 1]?.querySelector('form');
  form?.querySelectorAll('.ca-sign button').forEach(b => b.addEventListener('click', () => {
    form.sign.value = b.dataset.sign;
    form.querySelectorAll('.ca-sign button').forEach(x => x.classList.toggle('active', x === b));
  }));
}

async function _caOpenHistory(m) {
  const overlay = document.createElement('div');
  overlay.className = 'sa-overlay';
  overlay.innerHTML = `<div class="sa-modal" role="dialog" aria-modal="true" aria-label="Historial de ${escapeAttr(m.name)}">
    <h3>🐾 ${sanitize(m.name)}</h3><div class="ca-hist"><p class="wk-empty">Cargando…</p></div>
    <div class="sa-modal-foot"><button type="button" class="btn-cancel" data-act="close">Cerrar</button></div></div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay || e.target.closest('[data-act="close"]')) close(); });
  const draw = async () => {
    const { data, error } = await db.from('club_sellos').select('*').eq('cliente_id', m.id).order('created_at', { ascending: false }).limit(60);
    const el = overlay.querySelector('.ca-hist');
    if (error) { el.innerHTML = `<p class="wk-empty">⚠ ${sanitize(error.message)}</p>`; return; }
    if (!data.length) { el.innerHTML = '<p class="wk-empty">Sin movimientos todavía.</p>'; return; }
    const label = { compra: '🐾 Pedido', bienvenida: '🎉 Bienvenida', manual: '✨ A mano', canje: '🎁 Regalo entregado' };
    el.innerHTML = `<ul>${data.map(h => `<li>
      <span>${label[h.tipo] || h.tipo} <small>${_CA_TIERS[h.tarjeta]?.name || ''} · ${new Date(h.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })}${h.pedido_id ? ` · ${sanitize(h.pedido_id)}` : ''}${h.nota ? ` · ${sanitize(h.nota)}` : ''}</small></span>
      <b>${h.cantidad > 0 ? '+' : ''}${h.cantidad}</b>
      ${h.tipo === 'manual' ? `<button type="button" class="ca-undo" data-id="${h.id}" title="Deshacer">✕</button>` : ''}
    </li>`).join('')}</ul>`;
    el.querySelectorAll('.ca-undo').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('¿Deshacer este movimiento?')) return;
      const { error: e } = await db.from('club_sellos').delete().eq('id', parseInt(b.dataset.id));
      if (e) { alert('⚠ ' + e.message); return; }
      await draw();
      renderClubSection().catch(console.error);
    }));
  };
  draw().catch(console.error);
}

// Etiqueta del Club en la lista de pedidos
function clubBadgeHtml(o) {
  if (o.clubRegalo) return `<span class="order-club-badge is-gift">🎁 Regalo Club ${_CA_TIERS[o.clubRegalo]?.name || ''}</span>`;
  if (o.clubCliente) {
    const t = o.total >= 60 ? 'black' : o.total >= 15 ? 'golden' : null;
    return t ? `<span class="order-club-badge">🐾 Club ${_CA_TIERS[t].name}${isPaidStatus(o.status) && o.status !== 'separado' ? '' : ' · suma al pagar'}</span>` : '';
  }
  return '';
}
