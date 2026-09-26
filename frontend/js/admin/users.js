// ─── Sección: Usuarios ───────────────────────────────────────────────────────

async function renderUsersSection() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:2rem">Cargando usuarios…</td></tr>';

  const hint = document.getElementById('usersSqlHint');

  if (!db) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:2rem">Base de datos no disponible.</td></tr>';
    return;
  }

  // ── Obtener perfiles (Promise.resolve() envuelve el builder de Supabase, que no es
  // un Promise nativo, para poder aplicarle withTimeout sin que falle .finally()) ──
  let profilesData = [], profilesErr = null;
  try {
    const res = await withTimeout(
      Promise.resolve(db.from('perfiles_usuarios').select('*').order('created_at', { ascending: false })),
      15000, 'los clientes'
    );
    profilesData = res.data  || [];
    profilesErr  = res.error || null;
  } catch (e) {
    profilesErr = e;
  }

  if (profilesErr) {
    const code = profilesErr.code || '';
    const msg  = String(profilesErr.message || profilesErr.details || '');
    const isPermission = code === '42501' || code === '42P01' || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('does not exist');
    if (hint) hint.style.display = isPermission ? '' : 'none';
    tbody.innerHTML = isPermission
      ? '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:2rem">Sin acceso — ejecuta el SQL de arriba en Supabase para habilitar esta sección.</td></tr>'
      : `<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:2rem">Error al cargar usuarios: ${sanitize(msg || code || 'desconocido')}</td></tr>`;
    return;
  }

  if (hint) hint.style.display = 'none';

  // ── Obtener pedidos para cruzar por DNI (falla silenciosa) ──
  let orders = [];
  try { orders = await CloudOrders.getAll(); } catch (_) {}

  const ordersByDni = {};
  orders.forEach(o => {
    const dni = (o.customerDni || '').trim();
    if (!dni) return;
    if (!ordersByDni[dni]) ordersByDni[dni] = { count: 0, total: 0 };
    ordersByDni[dni].count++;
    if (o.status === 'pagado') ordersByDni[dni].total += (o.total || 0);
  });

  updateUsersStats(profilesData, ordersByDni);

  // ── Filtro de búsqueda ────────────────────────────────────────────────────────
  let filtered = profilesData;
  if (_userSearch) {
    const q = _userSearch.toLowerCase();
    filtered = profilesData.filter(p =>
      (p.nombre_completo || '').toLowerCase().includes(q) ||
      (p.dni  || '').includes(q) ||
      (p.telefono || '').includes(q)
    );
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:2rem">${
      profilesData.length ? 'Ningún usuario coincide con la búsqueda.' : 'No hay usuarios registrados aún.'
    }</td></tr>`;
    return;
  }

  const tdS = 'padding:.5rem .7rem;font-size:.80rem;border-bottom:1px solid var(--border);vertical-align:middle';

  tbody.innerHTML = filtered.map(p => {
    const stats    = ordersByDni[(p.dni || '').trim()] || { count: 0, total: 0 };
    const regDate  = new Date(p.created_at).toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'2-digit' });
    const discBadge = p.primer_descuento_usado
      ? '<span style="font-size:.72rem;background:rgba(239,83,80,.12);color:#ef5350;padding:.15rem .55rem;border-radius:3px;white-space:nowrap">Usado</span>'
      : '<span style="font-size:.72rem;background:rgba(76,175,80,.12);color:#4caf50;padding:.15rem .55rem;border-radius:3px;white-space:nowrap">Disponible</span>';

    return `<tr>
      <td style="${tdS}"><strong style="color:var(--text)">${sanitize(p.nombre_completo || '—')}</strong></td>
      <td style="${tdS};font-family:monospace;color:var(--text2);letter-spacing:.04em">${sanitize(p.dni || '—')}</td>
      <td style="${tdS}"><a href="https://wa.me/51${escapeAttr((p.telefono||'').replace(/\D/g,''))}" target="_blank" rel="noopener"
            style="color:var(--gold);text-decoration:none" onmouseover="this.style.opacity='.7'" onmouseout="this.style.opacity='1'">📱 ${sanitize(p.telefono || '—')}</a></td>
      <td style="${tdS};text-align:center">${discBadge}</td>
      <td style="${tdS};color:var(--text2);font-size:.75rem;white-space:nowrap">${regDate}</td>
      <td style="${tdS};text-align:center;color:${stats.count > 0 ? 'var(--gold)' : 'var(--text3)'}"><strong>${stats.count || '—'}</strong></td>
      <td style="${tdS};text-align:right;font-weight:${stats.total > 0 ? '700' : '400'};color:${stats.total > 0 ? 'var(--green)' : 'var(--text3)'}">
        ${stats.total > 0 ? `S/ ${stats.total.toFixed(2)}` : '—'}
      </td>
      <td style="${tdS};text-align:center">
        <button class="btn-view-user-orders" data-dni="${escapeAttr(p.dni || '')}" data-name="${escapeAttr(p.nombre_completo || '')}"
                style="font-size:.72rem;padding:.3rem .65rem;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:var(--r);cursor:pointer;transition:all .15s;white-space:nowrap"
                onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">Ver pedidos</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-view-user-orders').forEach(btn => {
    btn.addEventListener('click', () => openUserOrdersModal(btn.dataset.dni, btn.dataset.name));
  });
}

function updateUsersStats(profiles, ordersByDni) {
  const bar = document.getElementById('usersStatsBar');
  if (!bar) return;
  const total       = profiles.length;
  const discAvail   = profiles.filter(p => !p.primer_descuento_usado).length;
  const discUsed    = profiles.filter(p =>  p.primer_descuento_usado).length;
  const conPedidos  = profiles.filter(p => (ordersByDni[(p.dni||'').trim()]?.count || 0) > 0).length;
  bar.innerHTML = `
    <div class="stat-card"><div class="stat-val" style="color:var(--gold)">${total}</div><div class="stat-label">Total usuarios</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#4caf50">${discAvail}</div><div class="stat-label">Con 10% OFF</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--text2)">${discUsed}</div><div class="stat-label">Descuento usado</div></div>
    <div class="stat-card"><div class="stat-val" style="color:#60a5fa">${conPedidos}</div><div class="stat-label">Con pedidos</div></div>
  `;
}

async function openUserOrdersModal(dni, name) {
  if (!dni) { showToast('Este usuario no tiene DNI registrado.'); return; }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .22s ease';

  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid var(--gold-d);border-radius:10px;padding:1.5rem;max-width:560px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.6);max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:1rem">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem">
        <h3 style="margin:0;color:var(--gold);font-family:'Playfair Display',serif;font-size:1rem">Pedidos de ${sanitize(name)}</h3>
        <button id="closeUserOrdersModal" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer;line-height:1;padding:0 .2rem">✕</button>
      </div>
      <div id="userOrdersList" style="display:flex;flex-direction:column;gap:.5rem">
        <p style="color:var(--text2);text-align:center;padding:1.5rem">Cargando…</p>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  function closeModal() {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 240);
  }
  overlay.querySelector('#closeUserOrdersModal').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  try {
    const allOrders = await withTimeout(CloudOrders.getAll(), 15000, 'los pedidos del usuario');
    const userOrders = allOrders.filter(o => (o.customerDni || '').trim() === dni.trim());
    const list = overlay.querySelector('#userOrdersList');

    if (!userOrders.length) {
      list.innerHTML = '<p style="color:var(--text2);text-align:center;padding:1.5rem">Este usuario no tiene pedidos registrados.</p>';
      return;
    }

    const STATUS_LABELS = { pendiente: 'Pendiente', pagado: 'Pagado', cancelado: 'Cancelado', enviado: 'Enviado', entregado: 'Entregado' };
    list.innerHTML = userOrders.map(o => {
      const date  = new Date(o.date).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
      const items = (o.items || []).map(i => `${sanitize(i.productName)} ${sanitize(i.size)} ×${parseInt(i.quantity) || 1}`).join(' · ');
      const safeStatus = (o.status || '').replace(/[^a-z]/g, '');
      return `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:.75rem 1rem">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem">
            <span class="order-id">${sanitize(o.id)}</span>
            <span class="status-badge status-${safeStatus}">${STATUS_LABELS[o.status] ?? sanitize(o.status)}</span>
            <span style="font-size:.73rem;color:var(--text3)">${date}</span>
          </div>
          <div style="font-size:.78rem;color:var(--text2);margin-bottom:.35rem">${items || '—'}</div>
          <div style="display:flex;justify-content:space-between;font-size:.8rem">
            <span style="color:var(--text3)">${deliveryInfo(o.deliveryType).icon} ${deliveryInfo(o.deliveryType).short}</span>
            <strong style="color:var(--gold)">S/ ${o.total.toFixed(2)}</strong>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    overlay.querySelector('#userOrdersList').innerHTML = '<p style="color:var(--text2);text-align:center">Error al cargar los pedidos.</p>';
  }
}

function setupUsersEvents() {
  document.getElementById('userSearch')?.addEventListener('input', function() {
    _userSearch = this.value.trim();
    renderUsersSection().catch(console.error);
  });

  document.getElementById('refreshUsersBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshUsersBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = '.5'; }
    await renderUsersSection().catch(console.error);
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    showToast('Usuarios actualizados ✓');
  });
}
