// ═══════════════════════════════════════════════════════════════════════════════
// ─── CONTROL DE PRECIOS ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

let _preciosSearch     = '';
let _preciosTypeFilter = 'all';

async function _setCostPrice(productId, price) {
  await CloudProducts.update(parseInt(productId), { costPrice: price });
}

function _preciosMarginColor(pct) {
  if (pct >= 50) return '#4caf50';
  if (pct >= 25) return '#ff9800';
  return '#ef5350';
}

async function renderPreciosSection() {
  const container = document.getElementById('preciosContent');
  if (!container) return;

  container.innerHTML = `<div style="text-align:center;color:var(--text2);padding:2.5rem;font-size:.85rem">Cargando perfumes…</div>`;

  let products = [];
  try {
    products = await withTimeout(CloudProducts.getAll(), 15000, 'los precios');
  } catch (err) {
    container.innerHTML = `<div style="text-align:center;color:#ef5350;padding:2rem">No se pudieron cargar los perfumes. Recarga la página.</div>`;
    return;
  }

  if (_preciosTypeFilter === 'entero') {
    products = products.filter(p => p.type === 'entero');
  } else if (_preciosTypeFilter === 'decant') {
    products = products.filter(p => p.type !== 'entero');
  }

  if (_preciosSearch) {
    const q = _preciosSearch.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      (p.olfFamily || '').toLowerCase().includes(q)
    );
  }

  if (!products.length) {
    container.innerHTML = `<div style="text-align:center;color:var(--text2);padding:2.5rem">No hay perfumes que coincidan.</div>`;
    return;
  }

  // ── Resumen global ──────────────────────────────────────────────────────────
  const totalWithCost = products.filter(p => (p.costPrice || 0) > 0).length;
  const totalSinCosto = products.length - totalWithCost;

  const summaryHtml = `
    <div style="display:flex;gap:.65rem;flex-wrap:wrap;margin-bottom:1.25rem">
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:.65rem 1.1rem;min-width:110px">
        <div style="font-size:.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.2rem">Total</div>
        <div style="font-size:1.3rem;font-weight:700;color:var(--gold)">${products.length}</div>
      </div>
      <div style="background:var(--card);border:1px solid rgba(76,175,80,.3);border-radius:var(--r);padding:.65rem 1.1rem;min-width:110px">
        <div style="font-size:.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.2rem">Con costo</div>
        <div style="font-size:1.3rem;font-weight:700;color:#4caf50">${totalWithCost}</div>
      </div>
      ${totalSinCosto > 0 ? `
      <div style="background:var(--card);border:1px solid rgba(239,83,80,.25);border-radius:var(--r);padding:.65rem 1.1rem;min-width:110px">
        <div style="font-size:.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.2rem">Sin costo</div>
        <div style="font-size:1.3rem;font-weight:700;color:#ef5350">${totalSinCosto}</div>
      </div>` : ''}
    </div>`;

  // ── Tabla encabezado ────────────────────────────────────────────────────────
  const headerHtml = `
    <div class="precios-table-header" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:1rem;padding:.5rem 1rem;margin-bottom:.35rem;border-radius:var(--r)">
      <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;font-weight:600">Perfume</div>
      <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;font-weight:600;text-align:right">Costo entrada (S/)</div>
      <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;font-weight:600;text-align:right">Precio venta (S/)</div>
      <div style="font-size:.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;font-weight:600;text-align:right">Ganancia / Margen</div>
    </div>`;

  // ── Filas de productos ──────────────────────────────────────────────────────
  const rowsHtml = products.map(p => {
    const isEntero   = p.type === 'entero';
    const costPrice  = parseFloat(p.costPrice || 0);
    const typeLabel  = p.type === 'arabe' ? 'Árabe' : p.type === 'entero' ? 'Entero' : 'Diseñador';
    const typeBadge  = p.type === 'arabe' ? 'badge-arabe' : p.type === 'entero' ? 'badge-entero' : 'badge-dis';
    const adminImg   = _normAdminImg(p.imageUrl) || buildProductImage(p);
    const hasCost    = costPrice > 0;

    // ── Columna "Precio venta" y "Ganancia" ──────────────────────────────────
    let salePricesHtml = '';
    let gananciaHtml   = '';

    if (isEntero) {
      const salePrice = parseFloat(p.enteroPrice || 0);
      const ganancia  = hasCost && salePrice > 0 ? salePrice - costPrice : null;
      const margin    = ganancia !== null && salePrice > 0 ? (ganancia / salePrice * 100) : null;

      salePricesHtml = salePrice > 0
        ? `<span style="font-size:1rem;font-weight:700;color:var(--gold)">S/ ${salePrice.toFixed(2)}</span><div style="font-size:.7rem;color:var(--text3);margin-top:.1rem">Precio entero</div>`
        : `<span style="color:var(--text3);font-size:.82rem">Sin precio asignado</span>`;

      if (ganancia !== null) {
        const gColor = _preciosMarginColor(margin);
        gananciaHtml = `
          <div style="display:flex;flex-direction:column;gap:.15rem;align-items:flex-end">
            <span style="font-size:1rem;font-weight:700;color:${gColor}">${ganancia >= 0 ? '+' : ''}S/ ${ganancia.toFixed(2)}</span>
            <span style="font-size:.76rem;padding:.15rem .5rem;border-radius:20px;background:${gColor}22;color:${gColor};font-weight:700">${margin.toFixed(1)}%</span>
          </div>`;
      } else {
        gananciaHtml = `<span style="color:var(--text3);font-size:.78rem">${hasCost ? 'Sin precio venta' : 'Ingresa el costo'}</span>`;
      }
    } else {
      // Decants — mostrar una fila por talla
      const costPerMl  = hasCost && p.bottleTotalMl > 0 ? costPrice / p.bottleTotalMl : 0;
      const sizes      = Object.entries(p.sizes || {});
      const hasBottle  = p.bottleTotalMl > 0;

      if (!sizes.length) {
        salePricesHtml = `<span style="color:var(--text3);font-size:.78rem">Sin tallas</span>`;
        gananciaHtml   = `<span style="color:var(--text3);font-size:.78rem">—</span>`;
      } else {
        salePricesHtml = `
          <div style="display:flex;flex-direction:column;gap:.25rem">
            ${sizes.map(([ml, price]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.2rem .4rem;background:var(--bg2);border-radius:4px">
              <span style="font-size:.73rem;color:var(--text2);white-space:nowrap;min-width:32px">${sanitize(ml)}</span>
              <span style="font-size:.88rem;font-weight:700;color:var(--gold)">S/${parseFloat(price).toFixed(2)}</span>
            </div>`).join('')}
          </div>`;

        gananciaHtml = `
          <div style="display:flex;flex-direction:column;gap:.25rem">
            ${sizes.map(([ml, price]) => {
              const mlNum   = parseFloat(ml);
              const saleP   = parseFloat(price);
              if (!costPerMl || isNaN(mlNum) || !hasBottle) {
                return `<div style="height:32px;display:flex;align-items:center;justify-content:flex-end;padding:.2rem .4rem"><span style="color:var(--text3);font-size:.73rem">${!hasCost ? '—' : 'Sin botella'}</span></div>`;
              }
              const mlCost  = costPerMl * mlNum;
              const gan     = saleP - mlCost;
              const margin  = saleP > 0 ? (gan / saleP * 100) : 0;
              const gColor  = _preciosMarginColor(margin);
              return `
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:.35rem;padding:.2rem .4rem;background:var(--bg2);border-radius:4px">
                  <span style="font-size:.8rem;font-weight:700;color:${gColor}">${gan >= 0 ? '+' : ''}S/${gan.toFixed(2)}</span>
                  <span style="font-size:.68rem;padding:.1rem .38rem;border-radius:12px;background:${gColor}22;color:${gColor};font-weight:700;white-space:nowrap">${margin.toFixed(0)}%</span>
                </div>`;
            }).join('')}
          </div>`;
      }

      // Nota de frasco si no está configurado
      if (!hasBottle && hasCost) {
        gananciaHtml += `<div style="font-size:.68rem;color:var(--text3);margin-top:.25rem">⚠ Sin ml de frasco configurados</div>`;
      }
    }

    return `
    <div class="admin-card precios-product-row" data-id="${p.id}"
         style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:1rem;align-items:start;padding:1rem 1.1rem;margin-bottom:.5rem;transition:border-color .2s"
         onmouseenter="this.style.borderColor='rgba(124,79,176,.25)'" onmouseleave="this.style.borderColor=''">

      <!-- Col 1: Perfume info -->
      <div style="display:flex;gap:.75rem;align-items:flex-start;min-width:0">
        <img src="${escapeAttr(adminImg)}" alt="" loading="lazy"
             style="width:48px;height:48px;object-fit:contain;border-radius:var(--r);background:var(--bg2);flex-shrink:0"
             onerror="this.style.display='none'">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-bottom:.25rem">
            <span class="admin-type-badge ${typeBadge}" style="font-size:.63rem">${typeLabel}</span>
            ${!hasCost ? '<span style="font-size:.62rem;background:rgba(239,83,80,.14);color:#ef5350;border:1px solid rgba(239,83,80,.3);border-radius:10px;padding:.1rem .45rem;font-weight:600">Sin costo</span>' : ''}
          </div>
          <h3 style="font-size:.82rem;font-weight:600;color:var(--white);margin:0 0 .15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sanitize(p.brand)}</h3>
          <p style="font-size:.76rem;color:var(--text2);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sanitize(p.name)}</p>
          ${!isEntero && p.bottleTotalMl > 0 ? `<p style="font-size:.68rem;color:var(--text3);margin:.15rem 0 0">Frasco: ${p.bottleTotalMl} ml</p>` : ''}
        </div>
      </div>

      <!-- Col 2: Costo entrada -->
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.35rem">
        <div style="display:flex;align-items:center;gap:.3rem">
          <span style="font-size:.78rem;color:var(--text3)">S/</span>
          <input type="number" class="cost-price-input" data-id="${p.id}"
                 value="${hasCost ? costPrice.toFixed(2) : ''}"
                 min="0" max="99999" step="0.5"
                 placeholder="0.00"
                 style="width:82px;background:var(--bg2);border:1px solid var(--border-l);border-radius:var(--r);color:var(--text);font-size:.9rem;font-weight:700;padding:.32rem .5rem;outline:none;text-align:right;transition:border-color .15s"
                 onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--border-l)'">
        </div>
        <button class="btn-save-cost" data-id="${p.id}"
                style="font-size:.72rem;padding:.3rem .8rem;background:rgba(124,79,176,.12);color:var(--gold-d);border:1px solid rgba(124,79,176,.3);border-radius:var(--r);cursor:pointer;font-weight:700;white-space:nowrap;transition:background .15s"
                onmouseover="this.style.background='rgba(124,79,176,.24)'" onmouseout="this.style.background='rgba(124,79,176,.12)'">
          Guardar costo
        </button>
        ${isEntero && !hasCost ? '' : !isEntero && p.bottleTotalMl > 0 && hasCost ? `<div style="font-size:.68rem;color:var(--text3);text-align:right">S/${(costPrice/p.bottleTotalMl).toFixed(3)}/ml</div>` : ''}
      </div>

      <!-- Col 3: Precio venta -->
      <div style="display:flex;flex-direction:column;align-items:flex-end">
        ${salePricesHtml}
      </div>

      <!-- Col 4: Ganancia / Margen -->
      <div style="display:flex;flex-direction:column;align-items:flex-end">
        ${gananciaHtml}
      </div>

    </div>`;
  }).join('');

  container.innerHTML = summaryHtml + headerHtml + `<div id="preciosRowsWrap">${rowsHtml}</div>`;

  // ── Eventos: guardar costo ─────────────────────────────────────────────────
  container.querySelectorAll('.btn-save-cost').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id    = btn.dataset.id;
      const row   = btn.closest('.precios-product-row');
      const inp   = row?.querySelector('.cost-price-input');
      const price = parseFloat(inp?.value);
      if (isNaN(price) || price < 0) { showToast('Ingresa un precio válido (mayor a 0).'); return; }
      btn.disabled    = true;
      btn.textContent = 'Guardando…';
      try {
        await _setCostPrice(id, price);
        showToast('Precio de entrada guardado en base de datos ✓');
        await renderPreciosSection();
      } catch (err) {
        console.error('[MICHT] Error guardando cost_price:', err);
        showToast('Error al guardar. Verifica la conexión.');
        btn.disabled    = false;
        btn.textContent = 'Guardar costo';
      }
    });
  });
}

function setupPreciosEvents() {
  const search = document.getElementById('preciosSearch');
  if (search && !search._bound) {
    search._bound = true;
    search.addEventListener('input', function () {
      _preciosSearch = this.value.trim();
      renderPreciosSection().catch(console.error);
    });
  }

  document.querySelectorAll('.precios-filter-btn').forEach(btn => {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.precios-filter-btn').forEach(b => {
        b.style.background = 'var(--bg2)';
        b.style.color      = 'var(--text2)';
        b.classList.remove('active');
      });
      btn.style.background = 'var(--gold)';
      btn.style.color      = '#111';
      btn.classList.add('active');
      _preciosTypeFilter = btn.dataset.ptype;
      renderPreciosSection().catch(console.error);
    });
  });
}
