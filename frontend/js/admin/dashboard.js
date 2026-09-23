// ═══════════════════════════════════════════════════════════════════════════════
// ─── DASHBOARD / INICIO ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function renderDashboard() {
  const el = document.getElementById('dashboardContent');
  if (!el) return;

  // Fecha y hora actual
  const dateEl = document.getElementById('dashboardDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Skeleton mientras carga
  el.innerHTML = `
    <div class="dash-skeleton-wrap">
      <div class="sk-block" style="height:90px;border-radius:var(--r-lg)"></div>
      <div class="sk-block" style="height:90px;border-radius:var(--r-lg)"></div>
      <div class="sk-block" style="height:90px;border-radius:var(--r-lg)"></div>
      <div class="sk-block" style="height:90px;border-radius:var(--r-lg)"></div>
    </div>`;

  const [orders, products] = await Promise.all([
    CloudOrders.getAll().catch(() => []),
    CloudProducts.getAll().catch(() => [])
  ]);

  const today     = new Date().toDateString();
  const todayOrds = orders.filter(o => new Date(o.date).toDateString() === today);
  const pending   = orders.filter(o => o.status === 'pendiente');
  const weekAgo   = Date.now() - 7 * 24 * 3600 * 1000;
  const weekRevenue = orders
    .filter(o => o.status === 'pagado' && new Date(o.date).getTime() > weekAgo)
    .reduce((s, o) => s + o.total, 0);

  // Stock bajo: decants con < 15ml restantes o enteros con stockQuantity < 2
  const lowStock = products.filter(p => {
    if (!p.inStock) return false;
    if (p.type === 'entero') return (p.stockQuantity || 0) <= 1;
    return p.bottleTotalMl > 0 && (p.bottleRemainingMl || 0) > 0 && (p.bottleRemainingMl || 0) < 15;
  });

  // Últimos 5 pedidos
  const recent = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const STATUS_COLORS = { pendiente: 'var(--orange)', pagado: 'var(--green)', cancelado: 'var(--red)', enviado: '#64b5f6', entregado: 'var(--gold)' };
  const STATUS_LABELS_D = { pendiente: 'Pendiente', pagado: 'Pagado', cancelado: 'Cancelado', enviado: 'Enviado', entregado: 'Entregado' };

  el.innerHTML = `
    <!-- KPIs -->
    <div class="dash-kpi-grid">
      <div class="dash-kpi">
        <div class="dash-kpi-icon" style="background:rgba(124,79,176,.12);color:var(--gold)">📦</div>
        <div class="dash-kpi-body">
          <div class="dash-kpi-val">${todayOrds.length}</div>
          <div class="dash-kpi-lbl">Pedidos hoy</div>
        </div>
      </div>
      <div class="dash-kpi">
        <div class="dash-kpi-icon" style="background:rgba(76,175,80,.1);color:var(--green)">💰</div>
        <div class="dash-kpi-body">
          <div class="dash-kpi-val">S/ ${weekRevenue.toFixed(0)}</div>
          <div class="dash-kpi-lbl">Ingresos esta semana</div>
        </div>
      </div>
      <div class="dash-kpi ${pending.length > 0 ? 'dash-kpi-warn' : ''}">
        <div class="dash-kpi-icon" style="background:rgba(255,152,0,.1);color:var(--orange)">⏳</div>
        <div class="dash-kpi-body">
          <div class="dash-kpi-val">${pending.length}</div>
          <div class="dash-kpi-lbl">Por confirmar</div>
        </div>
      </div>
      <div class="dash-kpi ${lowStock.length > 0 ? 'dash-kpi-alert' : ''}">
        <div class="dash-kpi-icon" style="background:rgba(239,83,80,.1);color:var(--red)">⚠</div>
        <div class="dash-kpi-body">
          <div class="dash-kpi-val">${lowStock.length}</div>
          <div class="dash-kpi-lbl">Stock bajo</div>
        </div>
      </div>
    </div>

    <div class="dash-two-col">
      <!-- Últimos pedidos -->
      <div class="dash-panel">
        <div class="dash-panel-head">
          <span>Últimos pedidos</span>
          <button class="dash-panel-link" onclick="document.querySelector('[data-section=orders]').click()">Ver todos →</button>
        </div>
        <div class="dash-panel-body">
          ${recent.length === 0
            ? `<p style="text-align:center;color:var(--text2);padding:1.5rem;font-size:.82rem">No hay pedidos aún</p>`
            : recent.map(o => `
            <div class="dash-order-row">
              <div>
                <div class="dash-order-id">${sanitize(o.id)}</div>
                <div class="dash-order-client">${sanitize(o.customerName || '—')}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700;color:var(--gold);font-size:.85rem">S/ ${o.total.toFixed(2)}</div>
                <span style="font-size:.68rem;font-weight:600;color:${STATUS_COLORS[o.status] || 'var(--text2)'}">${STATUS_LABELS_D[o.status] || o.status}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Alertas de stock bajo -->
      <div class="dash-panel">
        <div class="dash-panel-head">
          <span>⚠ Stock bajo</span>
          <button class="dash-panel-link" onclick="document.querySelector('[data-section=products]').click()">Ver perfumes →</button>
        </div>
        <div class="dash-panel-body">
          ${lowStock.length === 0
            ? `<p style="text-align:center;color:var(--green);padding:1.5rem;font-size:.82rem">✓ Todo el stock está bien</p>`
            : lowStock.slice(0, 8).map(p => {
                const detail = p.type === 'entero'
                  ? `${p.stockQuantity || 0} und.`
                  : `~${Math.round(p.bottleRemainingMl || 0)}ml`;
                return `
                <div class="dash-stock-row">
                  <div class="dash-stock-info">
                    <div class="dash-stock-name">${sanitize(p.brand)} — ${sanitize(p.name)}</div>
                    <div class="dash-stock-detail">${detail} restantes</div>
                  </div>
                  <span class="dash-stock-badge">${detail}</span>
                </div>`;
              }).join('')}
        </div>
      </div>
    </div>

    <!-- Acciones rápidas -->
    <div class="dash-actions">
      <button class="dash-action-btn" onclick="document.querySelector('[data-section=orders]').click();setTimeout(()=>document.getElementById('registerOrderBtn')?.click(),300)">
        <span>📝</span> Registrar pedido
      </button>
      <button class="dash-action-btn" onclick="document.querySelector('[data-section=products]').click();setTimeout(()=>document.getElementById('addProductBtn')?.click(),300)">
        <span>✦</span> Agregar perfume
      </button>
      <button class="dash-action-btn" onclick="exportCatalogPDF()">
        <span>📄</span> Exportar catálogo PDF
      </button>
      <button class="dash-action-btn" onclick="document.querySelector('[data-section=accounting]').click()">
        <span>💳</span> Ver contabilidad
      </button>
    </div>`;
}
