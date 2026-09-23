// ─── Sección: Contabilidad ────────────────────────────────────────────────────

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Gastos: localStorage como cache + Supabase para sync entre dispositivos ──
// Tabla 'gastos': ver backend/supabase/schema-reference.sql
// ─────────────────────────────────────────────────────────────────────────────

async function getExpenses(year) {
  // Intentar cargar desde Supabase (sync entre dispositivos)
  if (db) {
    try {
      const { data, error } = await db.from('gastos').select('*').eq('year', year);
      if (!error && data) {
        // Convertir a formato legacy {month, description, amount, date}
        const remote = data.map(r => ({ id: r.id, month: r.month, description: r.description, amount: parseFloat(r.amount), date: r.created_at }));
        localStorage.setItem(`micht_expenses_${year}`, JSON.stringify(remote));
        return remote;
      }
    } catch (_) {}
  }
  // Fallback: localStorage
  try { return JSON.parse(localStorage.getItem(`micht_expenses_${year}`) || '[]'); }
  catch { return []; }
}

async function addExpense(year, month, description, amount) {
  const newExp = { month, description, amount, date: new Date().toISOString() };
  // Guardar en Supabase
  if (db) {
    try {
      const { data, error } = await db.from('gastos').insert({ year, month, description, amount }).select().single();
      if (!error && data) newExp.id = data.id;
    } catch (_) {}
  }
  // Guardar en localStorage
  const local = JSON.parse(localStorage.getItem(`micht_expenses_${year}`) || '[]');
  local.push(newExp);
  localStorage.setItem(`micht_expenses_${year}`, JSON.stringify(local));
  return newExp;
}

async function deleteExpense(year, expenseId, localIdx) {
  // Eliminar de Supabase por id si existe
  if (db && expenseId) {
    try { await db.from('gastos').delete().eq('id', expenseId); } catch (_) {}
  }
  // Eliminar de localStorage
  const local = JSON.parse(localStorage.getItem(`micht_expenses_${year}`) || '[]');
  local.splice(localIdx, 1);
  localStorage.setItem(`micht_expenses_${year}`, JSON.stringify(local));
}

// saveExpenses mantiene compatibilidad con el código legacy (contabilidad mensual)
function saveExpenses(year, expenses) {
  localStorage.setItem(`micht_expenses_${year}`, JSON.stringify(expenses));
}

async function getMonthlyStats(orders, year) {
  const filtered = orders.filter(o => new Date(o.date).getFullYear() === year);
  const expenses = await getExpenses(year);
  return Array.from({ length: 12 }, (_, m) => {
    const monthOrders = filtered.filter(o => new Date(o.date).getMonth() === m);
    const paid        = monthOrders.filter(o => o.status === 'pagado');
    const cancelled   = monthOrders.filter(o => o.status === 'cancelado');
    const revenue     = paid.reduce((s, o) => s + o.total, 0);
    const monthExp    = expenses.filter(e => e.month === m).reduce((s, e) => s + e.amount, 0);
    return { month: m, name: MONTH_NAMES[m], orders: monthOrders.length, paid: paid.length, cancelled: cancelled.length, revenue, expenses: monthExp, net: revenue - monthExp };
  });
}

async function renderAccountingSection() {
  const yearSel = document.getElementById('accountingYear');
  if (!yearSel) return;

  let allOrders;
  try {
    allOrders = await withTimeout(CloudOrders.getAll(), 15000, 'la contabilidad');
  } catch (err) {
    console.error('[MICHT] Error cargando contabilidad:', err);
    const tbody = document.getElementById('accountingTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:2rem">No se pudo cargar la contabilidad. Vuelve a intentar desde la pestaña Contabilidad.</td></tr>';
    return;
  }

  // Poblar años disponibles
  const rawYears  = allOrders.map(o => new Date(o.date).getFullYear()).filter(y => !isNaN(y));
  const thisYear  = new Date().getFullYear();
  const years     = [...new Set([thisYear, ...rawYears])].sort((a, b) => b - a);

  if (!yearSel.dataset.filled) {
    yearSel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    yearSel.dataset.filled = '1';
  }

  const year  = parseInt(yearSel.value) || thisYear;
  const stats = await getMonthlyStats(allOrders, year);
  const now   = new Date();

  // Calcular totales
  const totalRevenue  = stats.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = stats.reduce((s, m) => s + m.expenses, 0);
  const totalNet      = totalRevenue - totalExpenses;
  const bestMonth     = stats.reduce((b, m) => m.revenue > b.revenue ? m : b, stats[0]);
  const currentMonth  = stats[now.getMonth()];
  const paidTotal     = stats.reduce((s, m) => s + m.paid, 0);
  const activeMonths  = stats.filter(m => m.revenue > 0).length || 1;

  // Desglose por método de pago
  const paidOrders = allOrders.filter(o => o.status === 'pagado' && new Date(o.date).getFullYear() === year);
  const revEfectivo = paidOrders.filter(o => o.paymentMethod === 'efectivo').reduce((s,o) => s + o.total, 0);
  const revYape     = paidOrders.filter(o => o.paymentMethod === 'yape').reduce((s,o) => s + o.total, 0);
  const revSinMet   = paidOrders.filter(o => !o.paymentMethod).reduce((s,o) => s + o.total, 0);

  // ── Tarjetas de resumen ──────────────────────────────────────────────────────
  const summary = document.getElementById('accountingSummary');
  summary.innerHTML = [
    { label: `Total ${year}`, val: `S/ ${totalRevenue.toFixed(0)}`, sub: `${paidTotal} pedidos pagados`, color: 'var(--gold)' },
    { label: 'Mejor Mes',    val: bestMonth.revenue > 0 ? bestMonth.name : '—', sub: bestMonth.revenue > 0 ? `S/ ${bestMonth.revenue.toFixed(0)}` : 'Sin ventas aún', color: 'var(--green)' },
    { label: year === thisYear ? 'Mes Actual' : `Dic ${year}`, val: `S/ ${(year === thisYear ? currentMonth : stats[11]).revenue.toFixed(0)}`, sub: `${(year === thisYear ? currentMonth : stats[11]).paid} pagados`, color: 'var(--gold-d)' },
    { label: '💵 Efectivo',  val: `S/ ${revEfectivo.toFixed(0)}`, sub: `${paidOrders.filter(o=>o.paymentMethod==='efectivo').length} pedidos`, color: '#4caf50' },
    { label: '📱 Yape',      val: `S/ ${revYape.toFixed(0)}`,     sub: `${paidOrders.filter(o=>o.paymentMethod==='yape').length} pedidos`,     color: '#7c3aed' },
    { label: 'Gastos Totales', val: `S/ ${totalExpenses.toFixed(0)}`, sub: 'registrados manualmente', color: '#ef5350' },
    { label: 'Neto (Ingr.−Gastos)', val: `S/ ${totalNet.toFixed(0)}`, sub: `Prom/mes: S/ ${(totalRevenue / activeMonths).toFixed(0)}`, color: totalNet >= 0 ? 'var(--green)' : '#ef5350' }
  ].map(c => `
    <div class="stat-card" style="text-align:left;padding:1rem 1.1rem">
      <div class="stat-label" style="margin-bottom:.35rem">${c.label}</div>
      <div class="stat-val" style="color:${c.color};font-size:1.25rem;line-height:1.2">${c.val}</div>
      <div style="font-size:.7rem;color:var(--text3);margin-top:.3rem">${c.sub}</div>
    </div>`).join('');

  // ── Gráfico de barras ────────────────────────────────────────────────────────
  setTimeout(() => drawAccountingChart(stats, year), 0);

  // ── Tabla mensual ────────────────────────────────────────────────────────────
  const tbody = document.getElementById('accountingTableBody');
  tbody.innerHTML = stats.map(m => {
    const isCurrent = m.month === now.getMonth() && year === thisYear;
    const isBest    = m.revenue > 0 && m.month === bestMonth.month;
    return `
    <tr style="${isCurrent ? 'background:rgba(124,79,176,.06)' : ''}">
      <td>
        <span style="font-weight:${isCurrent ? '700' : '400'};color:${isCurrent ? 'var(--gold)' : 'var(--text)'}">
          ${m.name}${isCurrent ? '&nbsp;<span style="font-size:.66rem;color:var(--gold-d);font-weight:400">(actual)</span>' : ''}
        </span>
        ${isBest ? '&nbsp;<span style="font-size:.68rem;background:rgba(76,175,80,.15);color:#4caf50;padding:.1rem .45rem;border-radius:3px;font-weight:600">⭐ mejor</span>' : ''}
      </td>
      <td style="text-align:center;color:var(--text2)">${m.orders || '—'}</td>
      <td style="text-align:center;color:${m.cancelled ? '#ef5350' : 'var(--text3)'}">${m.cancelled || '—'}</td>
      <td style="text-align:right;font-weight:600;color:${m.revenue > 0 ? 'var(--green)' : 'var(--text3)'}">${m.revenue > 0 ? `S/ ${m.revenue.toFixed(2)}` : '—'}</td>
      <td style="text-align:right">
        <span style="color:${m.expenses > 0 ? '#ef5350' : 'var(--text3)'}">${m.expenses > 0 ? `S/ ${m.expenses.toFixed(2)}` : '—'}</span>
        <button class="btn-expense-detail" data-month="${m.month}" data-year="${year}"
                style="margin-left:.45rem;font-size:.7rem;padding:.15rem .5rem;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:3px;cursor:pointer;transition:all .15s"
                onmouseover="this.style.borderColor='var(--gold-d)';this.style.color='var(--gold)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)'"
                title="Ver / agregar gastos de ${m.name}">+</button>
      </td>
      <td style="text-align:right;font-weight:700;color:${m.net > 0 ? 'var(--gold)' : m.net < 0 ? '#ef5350' : 'var(--text3)'}">
        ${(m.revenue > 0 || m.expenses > 0) ? `S/ ${m.net.toFixed(2)}` : '—'}
      </td>
      <td style="text-align:center">
        <button class="btn-days-detail" data-month="${m.month}" data-year="${year}"
                style="font-size:.78rem;padding:.2rem .55rem;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:3px;cursor:pointer;transition:all .15s"
                onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold)';this.style.background='rgba(124,79,176,.08)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text2)';this.style.background='transparent'"
                title="Ver días de ${m.name}">📅</button>
      </td>
    </tr>`;
  }).join('');

  // Fila de totales
  tbody.innerHTML += `
    <tr style="background:var(--bg2);border-top:2px solid var(--border)">
      <td style="font-weight:700;color:var(--text);font-size:.85rem">TOTAL ${year}</td>
      <td style="text-align:center;font-weight:700;color:var(--gold)">${stats.reduce((s,m)=>s+m.orders,0)}</td>
      <td style="text-align:center;font-weight:700;color:#ef5350">${stats.reduce((s,m)=>s+m.cancelled,0) || '—'}</td>
      <td style="text-align:right;font-weight:700;color:var(--green)">S/ ${totalRevenue.toFixed(2)}</td>
      <td style="text-align:right;font-weight:700;color:#ef5350">${totalExpenses > 0 ? `S/ ${totalExpenses.toFixed(2)}` : '—'}</td>
      <td style="text-align:right;font-weight:700;color:var(--gold)">S/ ${totalNet.toFixed(2)}</td>
      <td></td>
    </tr>`;

  // Eventos de detalle de gastos
  tbody.querySelectorAll('.btn-expense-detail').forEach(btn => {
    btn.addEventListener('click', () => openExpenseModal(parseInt(btn.dataset.month), parseInt(btn.dataset.year)));
  });

  // Eventos de detalle diario
  tbody.querySelectorAll('.btn-days-detail').forEach(btn => {
    btn.addEventListener('click', () => renderDailyView(allOrders, parseInt(btn.dataset.year), parseInt(btn.dataset.month)));
  });
}

function drawAccountingChart(stats, year) {
  const canvas = document.getElementById('accountingChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.parentElement.offsetWidth - 48;
  if (W <= 0) return;
  const H   = 200;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const padL = 52, padR = 8, padT = 22, padB = 38;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const maxRev = Math.max(...stats.map(m => m.revenue), 1);
  const barW   = cW / 12;
  const barGap = barW * 0.28;
  const bw     = barW - barGap;

  ctx.clearRect(0, 0, W, H);

  // Grid + labels eje Y
  for (let i = 0; i <= 4; i++) {
    const y   = padT + cH - cH * i / 4;
    const val = Math.round(maxRev * i / 4);
    ctx.font      = `10px Inter, sans-serif`;
    ctx.fillStyle = '#666';
    ctx.textAlign = 'right';
    ctx.fillText(`S/${val}`, padL - 5, y + 4);
    ctx.beginPath();
    ctx.strokeStyle = '#2e2e2e';
    ctx.lineWidth   = 0.8;
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + cW, y);
    ctx.stroke();
  }

  const nowMonth  = new Date().getMonth();
  const thisYear  = new Date().getFullYear();
  const bestRev   = Math.max(...stats.map(m => m.revenue));

  stats.forEach((m, i) => {
    const x    = padL + i * barW + barGap / 2;
    const barH = (m.revenue / maxRev) * cH;
    const y    = padT + cH - barH;

    const isBest    = m.revenue > 0 && m.revenue === bestRev;
    const isCurrent = i === nowMonth && year === thisYear;

    if (m.revenue === 0) {
      ctx.fillStyle = '#252525';
      ctx.fillRect(x, padT + cH - 3, bw, 3);
    } else {
      const grad = ctx.createLinearGradient(0, y, 0, padT + cH);
      if (isBest) {
        grad.addColorStop(0, '#7c4fb0');
        grad.addColorStop(1, '#3d2560');
      } else if (isCurrent) {
        grad.addColorStop(0, '#4da6ff');
        grad.addColorStop(1, '#1a4a7a');
      } else {
        grad.addColorStop(0, '#5a5a5a');
        grad.addColorStop(1, '#2a2a2a');
      }
      ctx.fillStyle = grad;
      const r = Math.min(3, bw / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
      ctx.lineTo(x + bw, padT + cH);
      ctx.lineTo(x, padT + cH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();

      if (barH > 14) {
        ctx.fillStyle   = 'rgba(255,255,255,.85)';
        ctx.font        = '9px Inter, sans-serif';
        ctx.textAlign   = 'center';
        ctx.fillText(`${m.revenue.toFixed(0)}`, x + bw / 2, y - 4);
      }
    }

    // Etiqueta mes
    ctx.fillStyle = isCurrent ? '#7c4fb0' : '#666';
    ctx.font      = `${isCurrent ? '600 ' : ''}10px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(m.name.slice(0, 3), x + bw / 2, padT + cH + 16);
  });
}

async function openExpenseModal(month, year) {
  let overlay = document.getElementById('expenseOverlay');
  if (overlay) overlay.remove();

  const allExp    = await getExpenses(year);
  const expenses  = allExp.filter(e => e.month === month);
  const total     = expenses.reduce((s, e) => s + e.amount, 0);
  const monthName = MONTH_NAMES[month];

  overlay = document.createElement('div');
  overlay.id = 'expenseOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .22s ease';

  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid var(--gold-d);border-radius:10px;padding:1.5rem;max-width:440px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:1rem;max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem">
        <h3 style="margin:0;color:var(--gold);font-family:'Playfair Display',serif;font-size:1rem">Gastos — ${monthName} ${year}</h3>
        <button id="closeExpenseModal" style="background:none;border:none;color:#888;font-size:1.2rem;cursor:pointer;line-height:1;padding:0 .2rem">✕</button>
      </div>

      <div id="expenseList" style="display:flex;flex-direction:column;gap:.45rem;min-height:30px">
        ${expenses.length ? expenses.map((e, i) => `
          <div style="display:flex;align-items:center;gap:.5rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:.5rem .75rem">
            <span style="flex:1;font-size:.83rem;color:var(--text2)">${sanitize(e.description)}</span>
            <span style="font-size:.83rem;font-weight:700;color:#ef5350;white-space:nowrap">S/ ${e.amount.toFixed(2)}</span>
            <button class="del-expense-btn" data-idx="${i}"
                    style="background:none;border:none;color:#555;cursor:pointer;font-size:1.1rem;padding:0 .2rem;line-height:1;transition:color .15s"
                    onmouseover="this.style.color='#ef5350'" onmouseout="this.style.color='#555'">×</button>
          </div>`).join('')
        : '<p style="color:var(--text3);font-size:.82rem;text-align:center;padding:.4rem 0">Sin gastos registrados este mes</p>'}
      </div>

      ${total > 0 ? `<div style="text-align:right;font-size:.85rem;color:#ef5350;font-weight:700;border-top:1px solid var(--border);padding-top:.65rem">Total gastos: S/ ${total.toFixed(2)}</div>` : ''}

      <div style="border-top:1px solid var(--border);padding-top:.8rem">
        <p style="font-size:.78rem;color:var(--text2);margin-bottom:.55rem;font-weight:600">Agregar nuevo gasto</p>
        <div style="display:flex;gap:.45rem;flex-wrap:wrap">
          <input type="text" id="expenseDesc" placeholder="Descripción (ej: Empaques, Envíos…)" maxlength="100"
                 style="flex:2;min-width:140px;padding:.42rem .65rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.82rem;outline:none"
                 onfocus="this.style.borderColor='var(--gold-d)'" onblur="this.style.borderColor='var(--border)'">
          <input type="number" id="expenseAmount" placeholder="S/ 0.00" min="0.01" step="0.5" max="99999"
                 style="width:90px;padding:.42rem .55rem;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--r);font-size:.82rem;outline:none"
                 onfocus="this.style.borderColor='var(--gold-d)'" onblur="this.style.borderColor='var(--border)'">
          <button id="saveExpenseBtn"
                  style="padding:.42rem 1rem;background:var(--gold);color:#111;border:none;border-radius:var(--r);font-size:.82rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .2s"
                  onmouseover="this.style.background='var(--gold-l)'" onmouseout="this.style.background='var(--gold)'">Agregar</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  function closeModal() {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); renderAccountingSection().catch(console.error); }, 240);
  }

  overlay.querySelector('#closeExpenseModal').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // Eliminar gasto
  overlay.querySelectorAll('.del-expense-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const localIdx = parseInt(btn.dataset.idx);
      const target   = expenses[localIdx];
      await deleteExpense(year, target?.id, (await getExpenses(year)).findIndex(e => e === target || (e.month === target.month && e.description === target.description && e.amount === target.amount)));
      showToast('Gasto eliminado ✓');
      overlay.remove();
      openExpenseModal(month, year);
    });
  });

  // Guardar gasto
  overlay.querySelector('#saveExpenseBtn').addEventListener('click', async () => {
    const desc   = overlay.querySelector('#expenseDesc').value.trim();
    const amount = parseFloat(overlay.querySelector('#expenseAmount').value);
    if (!desc)                         { showToast('Ingresa una descripción.'); return; }
    if (isNaN(amount) || amount <= 0)  { showToast('Ingresa un monto válido.'); return; }
    await addExpense(year, month, desc, amount);
    showToast('Gasto registrado ✓');
    overlay.remove();
    openExpenseModal(month, year);
  });
}

function setupAccountingEvents() {
  document.getElementById('accountingYear')?.addEventListener('change', () => {
    // No tocar dataset.filled aquí: reconstruir el <select> resetea su value
    // al primer <option> y hace que el año elegido por el admin se pierda.
    renderAccountingSection().catch(console.error);
  });

  document.getElementById('addExpenseBtn')?.addEventListener('click', () => {
    const year  = parseInt(document.getElementById('accountingYear')?.value) || new Date().getFullYear();
    const month = new Date().getMonth();
    openExpenseModal(month, year);
  });

  document.getElementById('dailyBackBtn')?.addEventListener('click', () => {
    document.getElementById('accountingDailyView').style.display  = 'none';
    document.getElementById('accountingMonthlyView').style.display = '';
  });
}

// ─── Vista Diaria ─────────────────────────────────────────────────────────────

function getDailyStats(orders, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const filtered    = orders.filter(o => {
    const d = new Date(o.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day       = i + 1;
    const dayOrders = filtered.filter(o => new Date(o.date).getDate() === day);
    const paid      = dayOrders.filter(o => o.status === 'pagado');
    const cancelled = dayOrders.filter(o => o.status === 'cancelado');
    const revenue   = paid.reduce((s, o) => s + o.total, 0);
    return { day, orders: dayOrders.length, paid: paid.length, cancelled: cancelled.length, revenue };
  });
}

function renderDailyView(allOrders, year, month) {
  const dailyStats = getDailyStats(allOrders, year, month);
  const monthName  = MONTH_NAMES[month];
  const now        = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const today      = now.getDate();

  // Cambiar vista
  document.getElementById('accountingMonthlyView').style.display = 'none';
  document.getElementById('accountingDailyView').style.display   = '';

  // Título
  document.getElementById('dailyViewTitle').textContent = `Días de ${monthName} ${year}`;

  // Resumen
  const bestDay      = dailyStats.reduce((b, d) => d.revenue > b.revenue ? d : b, dailyStats[0]);
  const totalRevenue = dailyStats.reduce((s, d) => s + d.revenue, 0);
  const totalPaid    = dailyStats.reduce((s, d) => s + d.paid, 0);
  const activeDays   = dailyStats.filter(d => d.revenue > 0).length;

  document.getElementById('dailySummary').innerHTML = [
    { label: `Total ${monthName}`, val: `S/ ${totalRevenue.toFixed(0)}`, sub: `${totalPaid} pedidos pagados`, color: 'var(--gold)' },
    { label: 'Mejor Día',         val: bestDay.revenue > 0 ? `Día ${bestDay.day}` : '—', sub: bestDay.revenue > 0 ? `S/ ${bestDay.revenue.toFixed(0)}` : 'Sin ventas aún', color: 'var(--green)' },
    { label: 'Días con Ventas',   val: String(activeDays || 0), sub: `de ${dailyStats.length} días del mes`, color: 'var(--gold-d)' },
    { label: 'Prom / Día Activo', val: activeDays > 0 ? `S/ ${(totalRevenue / activeDays).toFixed(0)}` : '—', sub: 'promedio días con venta', color: 'var(--text2)' },
  ].map(c => `
    <div class="stat-card" style="text-align:left;padding:1rem 1.1rem">
      <div class="stat-label" style="margin-bottom:.35rem">${c.label}</div>
      <div class="stat-val" style="color:${c.color};font-size:1.25rem;line-height:1.2">${c.val}</div>
      <div style="font-size:.7rem;color:var(--text3);margin-top:.3rem">${c.sub}</div>
    </div>`).join('');

  // Gráfico
  setTimeout(() => drawDailyChart(dailyStats, year, month), 0);

  // Tabla
  const tbody    = document.getElementById('dailyTableBody');
  const bestRev  = Math.max(...dailyStats.map(d => d.revenue));
  const activeDaysList = dailyStats.filter(d => d.orders > 0);

  if (activeDaysList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:2rem">Sin ventas registradas en este mes</td></tr>';
    return;
  }

  tbody.innerHTML = activeDaysList.map(d => {
    const isBest  = d.revenue > 0 && d.revenue === bestRev;
    const isToday = isCurrentMonth && d.day === today;
    return `
    <tr style="${isToday ? 'background:rgba(124,79,176,.06)' : ''}">
      <td>
        <span style="font-weight:700;color:${isToday ? 'var(--gold)' : 'var(--text)'}">
          ${d.day} de ${monthName}
        </span>
        ${isBest ? '&nbsp;<span style="font-size:.68rem;background:rgba(76,175,80,.15);color:#4caf50;padding:.1rem .45rem;border-radius:3px;font-weight:600">⭐ mejor</span>' : ''}
        ${isToday ? '&nbsp;<span style="font-size:.66rem;color:var(--gold-d)">(hoy)</span>' : ''}
      </td>
      <td style="text-align:center;color:var(--text2)">${d.paid || '—'}</td>
      <td style="text-align:center;color:${d.cancelled ? '#ef5350' : 'var(--text3)'}">${d.cancelled || '—'}</td>
      <td style="text-align:right;font-weight:600;color:${d.revenue > 0 ? 'var(--green)' : 'var(--text3)'}">
        ${d.revenue > 0 ? `S/ ${d.revenue.toFixed(2)}` : '—'}
      </td>
    </tr>`;
  }).join('');

  // Fila total
  tbody.innerHTML += `
    <tr style="background:var(--bg2);border-top:2px solid var(--border)">
      <td style="font-weight:700;color:var(--text);font-size:.85rem">TOTAL ${monthName}</td>
      <td style="text-align:center;font-weight:700;color:var(--gold)">${totalPaid}</td>
      <td style="text-align:center;font-weight:700;color:#ef5350">${dailyStats.reduce((s,d)=>s+d.cancelled,0) || '—'}</td>
      <td style="text-align:right;font-weight:700;color:var(--green)">S/ ${totalRevenue.toFixed(2)}</td>
    </tr>`;
}

function drawDailyChart(dailyStats, year, month) {
  const canvas = document.getElementById('dailyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.parentElement.offsetWidth - 48;
  if (W <= 0) return;
  const H   = 200;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const padL = 52, padR = 8, padT = 22, padB = 38;
  const cW     = W - padL - padR;
  const cH     = H - padT - padB;
  const n      = dailyStats.length;
  const maxRev = Math.max(...dailyStats.map(d => d.revenue), 1);
  const barW   = cW / n;
  const barGap = barW * 0.3;
  const bw     = barW - barGap;

  ctx.clearRect(0, 0, W, H);

  // Grid + etiquetas Y
  for (let i = 0; i <= 4; i++) {
    const y   = padT + cH - cH * i / 4;
    const val = Math.round(maxRev * i / 4);
    ctx.font      = '10px Inter, sans-serif';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'right';
    ctx.fillText(`S/${val}`, padL - 5, y + 4);
    ctx.beginPath();
    ctx.strokeStyle = '#2e2e2e';
    ctx.lineWidth   = 0.8;
    ctx.moveTo(padL, y); ctx.lineTo(padL + cW, y);
    ctx.stroke();
  }

  const now        = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const today      = now.getDate();
  const bestRev    = Math.max(...dailyStats.map(d => d.revenue));

  dailyStats.forEach((d, i) => {
    const x    = padL + i * barW + barGap / 2;
    const barH = (d.revenue / maxRev) * cH;
    const y    = padT + cH - barH;

    const isBest  = d.revenue > 0 && d.revenue === bestRev;
    const isToday = isCurrentMonth && d.day === today;

    if (d.revenue === 0) {
      ctx.fillStyle = '#252525';
      ctx.fillRect(x, padT + cH - 2, bw, 2);
    } else {
      const grad = ctx.createLinearGradient(0, y, 0, padT + cH);
      if (isBest) {
        grad.addColorStop(0, '#7c4fb0'); grad.addColorStop(1, '#3d2560');
      } else if (isToday) {
        grad.addColorStop(0, '#4da6ff'); grad.addColorStop(1, '#1a4a7a');
      } else {
        grad.addColorStop(0, '#5a5a5a'); grad.addColorStop(1, '#2a2a2a');
      }
      ctx.fillStyle = grad;
      const r = Math.min(3, bw / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
      ctx.lineTo(x + bw, padT + cH);
      ctx.lineTo(x, padT + cH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();

      if (barH > 14 && bw > 10) {
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.font      = '8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${d.revenue.toFixed(0)}`, x + bw / 2, y - 4);
      }
    }

    // Etiqueta día — mostrar todos si hay espacio, si no cada 5
    const showLabel = bw >= 10 || d.day === 1 || d.day % 5 === 0 || d.day === n;
    if (showLabel) {
      ctx.fillStyle = isToday ? '#7c4fb0' : isBest ? '#7c4fb0' : '#666';
      ctx.font      = `${(isToday || isBest) ? '700 ' : ''}${bw > 12 ? '9' : '8'}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${d.day}`, x + bw / 2, padT + cH + 14);
    }
  });
}
