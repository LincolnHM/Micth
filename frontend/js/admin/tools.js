// ═══════════════════════════════════════════════════════════════════════════════
// ─── HERRAMIENTAS ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function setupToolsSection() {
  setupPriceCalculator();
  setupCsvExport();
  await setupWhatsAppTool();
}

// ── Calculadora de precios ────────────────────────────────────────────────────

function setupPriceCalculator() {
  const btn = document.getElementById('calcBtn');
  if (!btn || btn._bound) return;
  btn._bound = true;

  const priceInput = document.getElementById('calcBottlePrice');
  const mlInput    = document.getElementById('calcBottleMl');
  const marginInput = document.getElementById('calcMargin');
  const result      = document.getElementById('calcResult');

  function calculate() {
    const bottlePrice = parseFloat(priceInput.value);
    const bottleMl    = parseFloat(mlInput.value);
    const marginVal   = parseFloat(marginInput.value);
    const margin      = isNaN(marginVal) ? 0.8 : marginVal / 100;

    if (isNaN(bottlePrice) || isNaN(bottleMl) || bottleMl <= 0 || bottlePrice <= 0) {
      result.style.display = 'none';
      return false;
    }

    const costPerMl = bottlePrice / bottleMl;
    const sizes = [3, 5, 10, 15, 20];

    result.style.display = 'block';
    result.innerHTML = `
      <div class="calc-result-header">
        <span>Costo por ml: <strong>S/ ${costPerMl.toFixed(3)}</strong></span>
        <span style="color:var(--text2)">Margen: ${Math.round(margin * 100)}%</span>
      </div>
      <div class="calc-sizes-grid">
        ${sizes.map(ml => {
          const cost = costPerMl * ml;
          const price = cost * (1 + margin);
          const rounded = Math.ceil(price / 0.5) * 0.5;
          return `
          <div class="calc-size-card">
            <div class="calc-size-ml">${ml}ml</div>
            <div class="calc-size-cost">Costo: S/ ${cost.toFixed(2)}</div>
            <div class="calc-size-price">S/ ${rounded.toFixed(2)}</div>
            <div class="calc-size-gain" style="color:var(--green)">+S/ ${(rounded - cost).toFixed(2)}</div>
          </div>`;
        }).join('')}
      </div>
      <p style="font-size:.72rem;color:var(--text3);margin-top:.5rem">*Precio redondeado al S/ 0.50 más cercano para facilitar el cobro.</p>`;
    return true;
  }

  [priceInput, mlInput, marginInput].forEach(inp => {
    inp?.addEventListener('input', calculate);
  });

  btn.addEventListener('click', () => {
    const success = calculate();
    if (!success) {
      showToast('Ingresa precio del frasco y ml totales válidos.');
    }
  });
}

// ── Exportar pedidos a CSV ────────────────────────────────────────────────────

function setupCsvExport() {
  const btn = document.getElementById('exportCsvBtn');
  if (!btn || btn._bound) return;
  btn._bound = true;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Exportando…';
    try {
      const statusFilter = document.getElementById('csvStatusFilter')?.value || 'all';
      let orders = await CloudOrders.getAll();
      if (statusFilter !== 'all') orders = orders.filter(o => o.status === statusFilter);

      const rows = [
        ['ID', 'Fecha', 'Cliente', 'Teléfono', 'DNI', 'Entrega', 'Departamento', 'Productos', 'Total', 'Estado', 'Método Pago', 'Notas']
      ];

      orders.forEach(o => {
        const items = (o.items || []).map(i => `${i.brand} ${i.productName} ${i.size} x${i.quantity}`).join(' | ');
        const fecha = new Date(o.date).toLocaleDateString('es-PE');
        rows.push([
          o.id, fecha,
          o.customerName || '', o.customerPhone || '', o.customerDni || '',
          o.deliveryType === 'recojo' ? 'Recojo' : 'Shalom',
          o.department || '',
          items,
          o.total.toFixed(2),
          o.status,
          o.paymentMethod || '',
          o.notes || ''
        ]);
      });

      // Anti "inyección de fórmulas": un cliente puede escribir en su nombre/notas algo como
      // =HYPERLINK(...) o =cmd|'/c calc'!A0 y Excel lo EJECUTARÍA al abrir este archivo. Si una
      // celda empieza con = + - @ (o tab / retorno), se le antepone un apóstrofo para que sea texto.
      const safeCell = cell => {
        const t = String(cell);
        return /^[=+\-@\t\r]/.test(t) ? "'" + t : t;
      };
      const csv = rows.map(r => r.map(cell => `"${safeCell(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `pedidos_micht_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`${orders.length} pedidos exportados ✓`);
    } catch (err) {
      console.error(err);
      showToast('Error al exportar.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar CSV`;
    }
  });
}

// ── WhatsApp masivo ───────────────────────────────────────────────────────────

async function setupWhatsAppTool() {
  const btn = document.getElementById('waGenBtn');
  if (!btn || btn._bound) return;
  btn._bound = true;

  // Cargar teléfonos únicos de pedidos
  const orders = await withTimeout(CloudOrders.getAll(), 12000, 'los clientes').catch(() => []);
  const phoneMap = {};
  orders.forEach(o => {
    if (o.customerPhone && o.customerName) {
      phoneMap[o.customerPhone] = o.customerName;
    }
  });
  const phones = Object.entries(phoneMap);

  const countEl = document.getElementById('waClientsCount');
  if (countEl) countEl.textContent = `${phones.length} cliente${phones.length !== 1 ? 's' : ''} con teléfono`;

  btn.addEventListener('click', () => {
    const msg = document.getElementById('waMessageText')?.value.trim();
    if (!msg) { showToast('Escribe un mensaje primero.'); return; }
    if (!phones.length) { showToast('No hay clientes con teléfono registrado.'); return; }

    const result = document.getElementById('waLinksResult');
    const encoded = encodeURIComponent(msg);

    result.innerHTML = `
      <div style="font-size:.78rem;color:var(--text2);margin-bottom:.5rem">${phones.length} links generados — haz clic en cada uno para abrir WhatsApp:</div>
      <div class="wa-links-grid">
        ${phones.map(([phone, name]) => {
          const cleanPhone = phone.replace(/\D/g, '');
          const num = cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;
          return `
          <a class="wa-link-item" href="https://wa.me/${num}?text=${encoded}" target="_blank" rel="noopener noreferrer">
            <span class="wa-link-name">${sanitize(name)}</span>
            <span class="wa-link-phone">${sanitize(phone)}</span>
            <span class="wa-link-icon">→</span>
          </a>`;
        }).join('')}
      </div>`;
  });
}
