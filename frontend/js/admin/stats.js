// ─── Sección: Estadísticas completas ─────────────────────────────────────────

let _statsCache = null;
let _statsCacheAt = 0;

// ── Chart helpers para Estadísticas ─────────────────────────────────────────

function _chartSetup(id, w, h) {
  const c = document.getElementById(id);
  if (!c) return null;
  const dpr = window.devicePixelRatio || 1;
  const pw  = c.parentElement ? (c.parentElement.offsetWidth - 24) : w;
  const cw  = Math.max(pw, 80);
  c.width  = cw * dpr; c.height = h * dpr;
  c.style.width = cw + 'px'; c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cw, h);
  return { ctx, W: cw, H: h };
}

function _drawTrendChart(id, months) {
  const r = _chartSetup(id, 300, 130);
  if (!r) return;
  const { ctx, W, H } = r;
  const maxRev = Math.max(...months.map(m => m.rev), 1);
  const padL = 44, padB = 24, padT = 12, padR = 8;
  const cW = W - padL - padR, cH = H - padT - padB;
  const n  = months.length;

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = padT + cH - cH * i / 4;
    ctx.fillStyle = '#555'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`S/${Math.round(maxRev * i / 4)}`, padL - 4, y + 3);
    ctx.beginPath(); ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = .7;
    ctx.moveTo(padL, y); ctx.lineTo(padL + cW, y); ctx.stroke();
  }

  // Area gradient
  const pts = months.map((m, i) => ({
    x: padL + i * (cW / (n - 1)),
    y: padT + cH - (m.rev / maxRev) * cH
  }));

  const grad = ctx.createLinearGradient(0, padT, 0, padT + cH);
  grad.addColorStop(0, 'rgba(124,79,176,.35)');
  grad.addColorStop(1, 'rgba(124,79,176,0)');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, padT + cH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, padT + cH);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#7c4fb0'; ctx.lineWidth = 2; ctx.stroke();

  // Dots + labels
  pts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#7c4fb0'; ctx.fill();
    ctx.fillStyle = '#888'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(months[i].label, p.x, H - 5);
    if (months[i].rev > 0) {
      ctx.fillStyle = '#7c4fb0'; ctx.font = 'bold 8px sans-serif';
      ctx.fillText(`${months[i].rev.toFixed(0)}`, p.x, p.y - 7);
    }
  });
}

function _drawPayDonut(id, nEfect, nYape, nSin, total) {
  const size = 110;
  const c = document.getElementById(id);
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  c.width = c.height = size * dpr;
  c.style.width = c.style.height = size + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  const segs = [
    { v: nEfect, col: '#4caf50' },
    { v: nYape,  col: '#7c3aed' },
    { v: nSin,   col: '#3a3a3a' }
  ].filter(s => s.v > 0);
  const tot = segs.reduce((s, x) => s + x.v, 0) || 1;

  const cx = size / 2, cy = size / 2, R = size * .42, ri = size * .24;
  let angle = -Math.PI / 2;
  segs.forEach(seg => {
    const sweep = (seg.v / tot) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = seg.col; ctx.fill();
    angle += sweep;
  });

  // Hole
  ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#1a1a1a';
  ctx.fill();

  // Center text
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7c4fb0'; ctx.font = `bold ${size * .15}px sans-serif`;
  ctx.fillText(total, cx, cy - 7);
  ctx.fillStyle = '#888'; ctx.font = `${size * .09}px sans-serif`;
  ctx.fillText('pagados', cx, cy + 9);
}

function _drawTopHBar(id, items) {
  if (!items.length) return;
  const ROW = 26, PAD_T = 4;
  const r = _chartSetup(id, 300, items.length * ROW + PAD_T * 2);
  if (!r) return;
  const { ctx, W, H } = r;
  const maxV  = items[0]?.qty || 1;
  const padL  = 120, padR = 48;
  const barW  = W - padL - padR;
  const GOLD  = '#7c4fb0';
  const DARK  = '#2e2e2e';

  items.forEach((item, i) => {
    const y  = PAD_T + i * ROW;
    const pct = item.qty / maxV;
    const bw  = Math.max(pct * barW, 2);
    const clr = i === 0 ? GOLD : i === 1 ? '#9a7830' : i === 2 ? '#6a5020' : DARK;

    // Label
    const lbl = (item.brand ? item.brand + ' ' : '') + item.name;
    const short = lbl.length > 17 ? lbl.slice(0, 17) + '…' : lbl;
    ctx.fillStyle = '#aaa'; ctx.font = '9.5px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(short, padL - 5, y + 14);

    // Bar
    ctx.fillStyle = clr;
    const bh = 14, by = y + 5;
    ctx.beginPath();
    ctx.moveTo(padL, by); ctx.lineTo(padL + bw - 4, by);
    ctx.quadraticCurveTo(padL + bw, by, padL + bw, by + 4);
    ctx.lineTo(padL + bw, by + bh - 4);
    ctx.quadraticCurveTo(padL + bw, by + bh, padL + bw - 4, by + bh);
    ctx.lineTo(padL, by + bh); ctx.closePath(); ctx.fill();

    // Value
    ctx.fillStyle = '#ccc'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${item.qty} un.`, padL + bw + 4, y + 14);
  });
}
const STATS_TTL = 90000; // 90 s

async function renderStatsSection(forceRefresh = false) {
  const container = document.getElementById('statsContent');
  if (!container) return;

  const now = Date.now();
  const useCache = !forceRefresh && _statsCache && (now - _statsCacheAt) < STATS_TTL;

  if (!useCache) {
    container.innerHTML = `
      <div style="padding:1.5rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.6rem;margin-bottom:.8rem">
        ${[1,2,3,4].map(() => `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:.8rem;height:56px;animation:statsSkeleton 1.2s ease infinite alternate"></div>`).join('')}
      </div>
      <style>@keyframes statsSkeleton{from{opacity:.4}to{opacity:.9}}</style>
      <p style="text-align:center;color:var(--text2);font-size:.8rem;padding:.5rem">Cargando datos…</p>`;
  }

  let orders, products;
  if (useCache) {
    ({ orders, products } = _statsCache);
  } else {
    try {
      [orders, products] = await Promise.all([CloudOrders.getAll(), CloudProducts.getAll()]);
      _statsCache   = { orders, products };
      _statsCacheAt = now;
    } catch (err) {
      console.error('Stats: error al cargar datos:', err);
      container.innerHTML = '<p style="color:var(--text2);text-align:center;padding:2rem">Error al cargar. Haz clic en "↻ Actualizar" para reintentar.</p>';
      return;
    }
  }

  if (!orders.length) {
    container.innerHTML = '<p style="color:var(--text2);text-align:center;padding:2.5rem">Aún no hay pedidos registrados.</p>';
    return;
  }

  // ── Lookup de productos ─────────────────────────────────────────────────
  const prodLookup = {};
  products.forEach(p => { prodLookup[p.id] = p; });

  // ── KPIs ────────────────────────────────────────────────────────────────
  const paidOrders    = orders.filter(o => o.status === 'pagado');
  const totalRevenue  = paidOrders.reduce((s, o) => s + (o.total || 0), 0);
  const avgTicket     = paidOrders.length ? totalRevenue / paidOrders.length : 0;
  const discountCount = orders.filter(o => (o.notes || '').includes('DESCUENTO')).length;

  // ── Top perfumes (decants) ───────────────────────────────────────────────
  const perfMap = {};
  orders.forEach(o => {
    (o.items || []).forEach(item => {
      const k = item.productId ? String(item.productId) : (item.productName || '?');
      if (!perfMap[k]) perfMap[k] = { name: item.productName || k, brand: item.brand || '', qty: 0, rev: 0 };
      perfMap[k].qty += (item.quantity || 1);
      perfMap[k].rev += (item.price || 0) * (item.quantity || 1);
    });
  });
  const topPerf = Object.values(perfMap).sort((a, b) => b.qty - a.qty).slice(0, 10);
  const maxPerf = topPerf[0]?.qty || 1;

  // ── Por género ────────────────────────────────────────────────────────────
  const gQty = { masculino: 0, femenino: 0, unisex: 0 };
  orders.forEach(o => {
    (o.items || []).forEach(item => {
      const p = prodLookup[item.productId];
      const g = (p?.gender || 'unisex').toLowerCase();
      if (gQty[g] !== undefined) gQty[g] += (item.quantity || 1);
      else gQty.unisex += (item.quantity || 1);
    });
  });
  const totalG = Math.max(gQty.masculino + gQty.femenino + gQty.unisex, 1);

  // ── Por tipo ──────────────────────────────────────────────────────────────
  const typeQty = {};
  orders.forEach(o => {
    (o.items || []).forEach(item => {
      const p = prodLookup[item.productId];
      const t = p?.type || 'diseñador';
      typeQty[t] = (typeQty[t] || 0) + (item.quantity || 1);
    });
  });
  const totalT = Math.max(Object.values(typeQty).reduce((s, v) => s + v, 0), 1);

  // ── Por tamaño ────────────────────────────────────────────────────────────
  const sizeQty = {};
  orders.forEach(o => {
    (o.items || []).forEach(item => {
      const sz = item.size || '?';
      sizeQty[sz] = (sizeQty[sz] || 0) + (item.quantity || 1);
    });
  });
  const topSizes  = Object.entries(sizeQty).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxSize   = topSizes[0]?.[1] || 1;

  // ── Entrega ───────────────────────────────────────────────────────────────
  let cRecojo = 0, cEnvio = 0;
  orders.forEach(o => { o.deliveryType === 'envio' ? cEnvio++ : cRecojo++; });
  const totalDel = Math.max(cRecojo + cEnvio, 1);

  // ── Top departamentos ─────────────────────────────────────────────────────
  const deptMap = {};
  orders.filter(o => o.deliveryType === 'envio' && o.department).forEach(o => {
    deptMap[o.department] = (deptMap[o.department] || 0) + 1;
  });
  const topDepts = Object.entries(deptMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxDept  = topDepts[0]?.[1] || 1;

  // ── Top clientes ──────────────────────────────────────────────────────────
  const clientMap = {};
  orders.forEach(o => {
    const k = o.customerDni || o.customerName || '?';
    if (!clientMap[k]) clientMap[k] = { name: o.customerName || '—', dni: o.customerDni || '—', phone: o.customerPhone || '—', orders: 0, total: 0 };
    clientMap[k].orders++;
    clientMap[k].total += (o.total || 0);
    if (o.customerName)  clientMap[k].name  = o.customerName;
    if (o.customerPhone) clientMap[k].phone = o.customerPhone;
  });
  const topClients = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 10);

  // ── Método de pago ─────────────────────────────────────────────────────────
  const pmEfectivo = paidOrders.filter(o => o.paymentMethod === 'efectivo');
  const pmYape     = paidOrders.filter(o => o.paymentMethod === 'yape');
  const pmSinDato  = paidOrders.filter(o => !o.paymentMethod);
  const revEfect   = pmEfectivo.reduce((s, o) => s + o.total, 0);
  const revYape    = pmYape.reduce((s, o) => s + o.total, 0);

  // ── Tendencia últimos 6 meses ──────────────────────────────────────────────
  const now6 = new Date();
  const trend6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now6.getFullYear(), now6.getMonth() - 5 + i, 1);
    const mo = paidOrders.filter(o => {
      const od = new Date(o.date);
      return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
    });
    return { label: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()], rev: mo.reduce((s,o) => s + o.total, 0) };
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const medal = i => ['🥇','🥈','🥉'][i] || `${i+1}`;

  const bar = (label, val, max, color = 'var(--gold)') => {
    const pct = Math.round(val / max * 100);
    return `<div style="margin-bottom:.5rem">
      <div style="display:flex;justify-content:space-between;font-size:.76rem;margin-bottom:.18rem">
        <span style="color:var(--text2)">${label}</span>
        <span style="color:var(--text);font-weight:600">${val} <small style="color:var(--text3)">(${pct}%)</small></span>
      </div>
      <div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:3px"></div>
      </div>
    </div>`;
  };

  const th = 'padding:.45rem .65rem;color:var(--text2);font-size:.72rem;font-weight:600;text-align:left;border-bottom:1px solid var(--border)';
  const td = 'padding:.45rem .65rem;font-size:.78rem;border-bottom:1px solid var(--border)';
  const tdr = td + ';text-align:right';

  container.innerHTML = `
    <style>
      .stats-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;padding:.75rem .75rem 0}
      .stats-kpis-2{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;padding:.4rem .75rem 0}
      .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;padding:.75rem}
      .stats-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;padding:0 .75rem .75rem}
      .kpi-box{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:.65rem .8rem;position:relative;overflow:hidden}
      .kpi-box::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,transparent 60%,rgba(255,255,255,.02));pointer-events:none}
      .kpi-v{font-size:1.25rem;font-weight:700;color:var(--gold);font-family:'Playfair Display',serif;line-height:1.1}
      .kpi-l{font-size:.63rem;color:var(--text2);margin-top:.2rem;letter-spacing:.03em}
      .kpi-sub{font-size:.6rem;color:var(--text3);margin-top:.1rem}
      .stat-card-inner{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
      .stat-card-head{padding:.6rem .8rem;border-bottom:1px solid var(--border);font-size:.8rem;color:var(--gold);font-weight:600;display:flex;align-items:center;gap:.4rem}
      .stat-card-sub{font-size:.65rem;color:var(--text2);font-weight:400;margin-left:auto}
      .stat-card-body{padding:.6rem .8rem}
      .chart-legend{display:flex;flex-wrap:wrap;gap:.4rem .8rem;padding:.5rem .8rem .7rem;font-size:.72rem}
      .legend-dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:.3rem;flex-shrink:0}
      @media(max-width:600px){
        .stats-kpis,.stats-kpis-2{grid-template-columns:1fr 1fr}
        .stats-grid{grid-template-columns:1fr}
        .stats-grid-3{grid-template-columns:1fr}
        .stats-kpis,.stats-kpis-2,.stats-grid,.stats-grid-3{padding:.5rem}
      }
    </style>

    <!-- Cabecera -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .75rem .2rem;flex-wrap:wrap;gap:.4rem">
      <span style="font-size:.72rem;color:var(--text3)">Caché 90s · ${orders.length} pedidos · ${products.length} productos</span>
      <button onclick="renderStatsSection(true)" style="font-size:.7rem;padding:.28rem .7rem;background:transparent;border:1px solid var(--border);border-radius:var(--r);color:var(--text2);cursor:pointer;display:flex;align-items:center;gap:.3rem">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        Actualizar
      </button>
    </div>

    <!-- KPIs fila 1 -->
    <div class="stats-kpis">
      <div class="kpi-box">
        <div class="kpi-v">${orders.length}</div>
        <div class="kpi-l">Total pedidos</div>
        <div class="kpi-sub">${paidOrders.length} pagados · ${orders.filter(o=>o.status==='pendiente').length} pendientes</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-v" style="color:#4caf50">S/ ${totalRevenue.toFixed(0)}</div>
        <div class="kpi-l">Facturado (pagados)</div>
        <div class="kpi-sub">Ticket prom. S/ ${avgTicket.toFixed(1)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-v" style="color:var(--text2)">${products.filter(p=>p.inStock).length}<span style="font-size:.75rem;color:var(--text3)">/${products.length}</span></div>
        <div class="kpi-l">Productos en stock</div>
        <div class="kpi-sub">${products.filter(p=>!p.inStock).length} agotados</div>
      </div>
    </div>

    <!-- KPIs fila 2: métodos de pago -->
    <div class="stats-kpis-2">
      <div class="kpi-box" style="border-color:rgba(76,175,80,.3)">
        <div class="kpi-v" style="color:#4caf50">S/ ${revEfect.toFixed(0)}</div>
        <div class="kpi-l">💵 Efectivo</div>
        <div class="kpi-sub">${pmEfectivo.length} pedido${pmEfectivo.length!==1?'s':''}</div>
      </div>
      <div class="kpi-box" style="border-color:rgba(124,58,237,.3)">
        <div class="kpi-v" style="color:#a78bfa">S/ ${revYape.toFixed(0)}</div>
        <div class="kpi-l">📱 Yape</div>
        <div class="kpi-sub">${pmYape.length} pedido${pmYape.length!==1?'s':''}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-v" style="color:var(--text2)">S/ ${pmSinDato.reduce((s,o)=>s+o.total,0).toFixed(0)}</div>
        <div class="kpi-l">⏳ Sin dato de pago</div>
        <div class="kpi-sub">${pmSinDato.length} pedido${pmSinDato.length!==1?'s':''}</div>
      </div>
    </div>

    <!-- Chart: Tendencia 6 meses + Métodos de pago -->
    <div class="stats-grid">
      <div class="stat-card-inner">
        <div class="stat-card-head">📈 Tendencia de ventas <span class="stat-card-sub">últimos 6 meses</span></div>
        <div style="padding:.75rem"><canvas id="statsTrendChart" style="display:block;width:100%;height:130px"></canvas></div>
      </div>
      <div class="stat-card-inner">
        <div class="stat-card-head">💳 Método de pago <span class="stat-card-sub">pedidos pagados</span></div>
        <div style="display:flex;align-items:center;justify-content:center;gap:1rem;padding:.75rem;flex-wrap:wrap">
          <canvas id="statsPayChart" style="flex-shrink:0"></canvas>
          <div class="chart-legend" style="flex-direction:column;padding:0;gap:.5rem">
            <div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem"><span class="legend-dot" style="background:#4caf50"></span>💵 Efectivo: <strong>${pmEfectivo.length}</strong></div>
            <div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem"><span class="legend-dot" style="background:#7c3aed"></span>📱 Yape: <strong>${pmYape.length}</strong></div>
            <div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem"><span class="legend-dot" style="background:#444"></span>Sin dato: <strong>${pmSinDato.length}</strong></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top decants (chart horizontal) + clientes -->
    <div class="stats-grid">
      <div class="stat-card-inner">
        <div class="stat-card-head">🏆 Top decants <span class="stat-card-sub">por unidades vendidas</span></div>
        <div style="padding:.75rem .5rem"><canvas id="statsTopChart" style="display:block;width:100%"></canvas></div>
      </div>
      <div class="stat-card-inner">
        <div class="stat-card-head">⭐ Mejores clientes<span class="stat-card-sub">por total gastado</span></div>
        <div class="stat-card-body" style="padding:0">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>
              <th style="${th}">#</th><th style="${th}">Cliente</th>
              <th style="${th};text-align:right">Ped.</th><th style="${th};text-align:right">S/</th>
            </tr></thead>
            <tbody>${topClients.map((c,i) => `<tr>
              <td style="${td};font-size:.85rem">${medal(i)}</td>
              <td style="${td}"><strong style="font-size:.76rem;display:block">${sanitize(c.name)}</strong><small style="color:var(--text2);font-size:.68rem">DNI: ••••${sanitize(c.dni).slice(-4)}</small></td>
              <td style="${tdr};color:var(--gold);font-weight:700">${c.orders}</td>
              <td style="${tdr}">S/${c.total.toFixed(0)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Fila de 3: género, tipo, tamaños -->
    <div class="stats-grid-3">
      <div class="stat-card-inner">
        <div class="stat-card-head">👥 Por género</div>
        <div class="stat-card-body">
          ${bar('👨 Hombre', gQty.masculino, totalG, '#5b9cf6')}
          ${bar('👩 Mujer',  gQty.femenino,  totalG, '#f06292')}
          ${bar('✨ Unisex', gQty.unisex,    totalG, 'var(--gold)')}
        </div>
      </div>
      <div class="stat-card-inner">
        <div class="stat-card-head">🧴 Tipo fragancia</div>
        <div class="stat-card-body">
          ${Object.entries(typeQty).sort((a,b)=>b[1]-a[1]).map(([t,v]) => {
            const clr = { arabe:'#a78bfa', entero:'#34d399' };
            return bar(t.charAt(0).toUpperCase()+t.slice(1), v, totalT, clr[t]||'var(--gold)');
          }).join('')}
        </div>
      </div>
      <div class="stat-card-inner">
        <div class="stat-card-head">💧 Tamaño decant</div>
        <div class="stat-card-body">
          ${topSizes.map(([sz,v]) => bar(sz, v, maxSize)).join('') || '<p style="color:var(--text2);font-size:.78rem">Sin datos</p>'}
        </div>
      </div>
    </div>

    <!-- Fila de 2: entrega + departamentos -->
    <div class="stats-grid" style="padding-top:0">
      <div class="stat-card-inner">
        <div class="stat-card-head">🚚 Método de entrega</div>
        <div class="stat-card-body">
          ${bar('🏪 Recojo en tienda', cRecojo, totalDel, 'var(--gold)')}
          ${bar('📦 Envío Shalom', cEnvio, totalDel, '#60a5fa')}
        </div>
      </div>
      <div class="stat-card-inner">
        <div class="stat-card-head">📍 Envíos por región</div>
        <div class="stat-card-body">
          ${topDepts.length ? topDepts.map(([d,v]) => bar(d,v,maxDept)).join('') : '<p style="color:var(--text2);font-size:.78rem;text-align:center">Sin envíos aún</p>'}
        </div>
      </div>
    </div>`;

  // ── Dibujar gráficos después del render ──────────────────────────────────
  setTimeout(() => {
    _drawTrendChart('statsTrendChart', trend6);
    _drawPayDonut('statsPayChart', pmEfectivo.length, pmYape.length, pmSinDato.length, paidOrders.length);
    _drawTopHBar('statsTopChart', topPerf.slice(0, 8));
  }, 60);
}
