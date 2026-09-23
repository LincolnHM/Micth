// ─── Módulo de Control de Caja (POS Cash Sessions) ──────────────────────────

const CajaManager = {
  _storageKey: 'micht_caja_sesiones',
  _activeKey: 'micht_caja_activa',

  // Cargar historial de sesiones
  getHistorial() {
    try {
      return JSON.parse(localStorage.getItem(this._storageKey) || '[]');
    } catch (e) {
      console.error('Error al cargar historial de caja:', e);
      return [];
    }
  },

  // Guardar historial de sesiones
  saveHistorial(historial) {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(historial));
    } catch (e) {
      console.error('Error al guardar historial de caja:', e);
    }
  },

  // Cargar sesión activa
  getSesionActiva() {
    try {
      return JSON.parse(localStorage.getItem(this._activeKey) || 'null');
    } catch (e) {
      console.error('Error al cargar sesión activa de caja:', e);
      return null;
    }
  },

  // Guardar sesión activa
  saveSesionActiva(sesion) {
    try {
      localStorage.setItem(this._activeKey, JSON.stringify(sesion));
    } catch (e) {
      console.error('Error al guardar sesión activa de caja:', e);
    }
  },

  // Abrir Caja
  abrirCaja(montoInicial) {
    const sesion = {
      id: 'CAJA-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
      fechaApertura: new Date().toISOString(),
      montoApertura: parseFloat(montoInicial) || 0,
      estado: 'abierto',
      fechaCierre: null,
      ventasEfectivo: 0,
      ventasYape: 0,
      ventasPlin: 0,
      ventasTransferencia: 0,
      montoEsperado: parseFloat(montoInicial) || 0,
      montoReal: null,
      discrepancia: null,
      notas: ''
    };
    this.saveSesionActiva(sesion);
    return sesion;
  },

  // Cerrar Caja
  cerrarCaja(montoReal, notas, expectedSales) {
    const sesion = this.getSesionActiva();
    if (!sesion) return null;

    sesion.estado = 'cerrado';
    sesion.fechaCierre = new Date().toISOString();
    sesion.ventasEfectivo = expectedSales.efectivo;
    sesion.ventasYape = expectedSales.yape;
    sesion.ventasPlin = expectedSales.plin;
    sesion.ventasTransferencia = expectedSales.transferencia;
    
    sesion.montoEsperado = sesion.montoApertura + expectedSales.efectivo;
    sesion.montoReal = parseFloat(montoReal) || 0;
    sesion.discrepancia = sesion.montoReal - sesion.montoEsperado;
    sesion.notas = notas || '';

    // Guardar en historial
    const historial = this.getHistorial();
    historial.unshift(sesion);
    this.saveHistorial(historial);

    // Limpiar sesión activa
    localStorage.removeItem(this._activeKey);
    return sesion;
  },

  // Calcular las ventas realizadas en un rango de fecha
  async calcularVentas(fechaInicio, fechaFin = null) {
    const orders = await CloudOrders.getAll().catch(() => []);
    const inicio = new Date(fechaInicio).getTime();
    const fin = fechaFin ? new Date(fechaFin).getTime() : Date.now();

    const ventas = {
      efectivo: 0,
      yape: 0,
      plin: 0,
      transferencia: 0,
      total: 0
    };

    orders.forEach(o => {
      if (o.status !== 'pagado') return;
      const orderTime = new Date(o.date).getTime();
      if (orderTime >= inicio && orderTime <= fin) {
        const pm = (o.paymentMethod || '').toLowerCase();
        if (pm === 'efectivo') {
          ventas.efectivo += o.total;
        } else if (pm === 'yape') {
          ventas.yape += o.total;
        } else if (pm === 'plin') {
          ventas.plin += o.total;
        } else if (pm === 'transferencia' || pm === 'banco') {
          ventas.transferencia += o.total;
        }
        ventas.total += o.total;
      }
    });

    return ventas;
  },

  // Eliminar un turno del historial
  eliminarSesion(id) {
    const historial = this.getHistorial().filter(s => s.id !== id);
    this.saveHistorial(historial);
  }
};

async function renderCajaSection() {
  const activePanel = document.getElementById('cajaActivePanel');
  const historyBody = document.getElementById('cajaHistoryTableBody');
  const statusLabel = document.getElementById('cajaStatusLabel');
  if (!activePanel || !historyBody) return;

  const sesion = CajaManager.getSesionActiva();

  if (sesion) {
    // Caja abierta: Actualizar estado de indicador
    statusLabel.className = 'caja-status-pill open';
    statusLabel.textContent = 'Abierta';

    // Calcular ventas acumuladas de la sesión activa
    const ventas = await CajaManager.calcularVentas(sesion.fechaApertura);
    const montoEsperado = sesion.montoApertura + ventas.efectivo;

    // Renderizar panel de caja activa
    activePanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border);padding-bottom:.8rem;flex-wrap:wrap;gap:.5rem">
        <div>
          <span style="font-size:.73rem;color:var(--text3);font-family:sans-serif">TURNO ACTIVO</span>
          <h3 style="color:var(--white);font-size:1.15rem;margin:0;font-family:'Playfair Display',serif">${sesion.id}</h3>
          <span style="font-size:.78rem;color:var(--text2)">Abierta el ${new Date(sesion.fechaApertura).toLocaleString('es-PE')}</span>
        </div>
        <button id="cajaCerrarBtn" class="btn-delete" style="padding:.5rem 1.2rem;font-size:.8rem;font-weight:700">Cerrar Turno de Caja</button>
      </div>

      <div class="caja-info-grid">
        <div class="caja-info-card">
          <span class="caja-info-title">💵 Fondo Inicial</span>
          <span class="caja-info-value gold">S/ ${sesion.montoApertura.toFixed(2)}</span>
        </div>
        <div class="caja-info-card">
          <span class="caja-info-title">💵 Ventas Efectivo</span>
          <span class="caja-info-value">S/ ${ventas.efectivo.toFixed(2)}</span>
        </div>
        <div class="caja-info-card">
          <span class="caja-info-title">📱 Ventas Yape</span>
          <span class="caja-info-value">S/ ${ventas.yape.toFixed(2)}</span>
        </div>
        <div class="caja-info-card">
          <span class="caja-info-title">📲 Ventas Plin</span>
          <span class="caja-info-value">S/ ${ventas.plin.toFixed(2)}</span>
        </div>
        <div class="caja-info-card">
          <span class="caja-info-title">🏦 Transferencias</span>
          <span class="caja-info-value">S/ ${ventas.transferencia.toFixed(2)}</span>
        </div>
        <div class="caja-info-card" style="border-color:rgba(37,211,102,.2)">
          <span class="caja-info-title" style="color:#25d366">💵 Esperado en Caja</span>
          <span class="caja-info-value green">S/ ${montoEsperado.toFixed(2)}</span>
        </div>
      </div>

      <div style="background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:var(--r);padding:.9rem 1.1rem;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:.8rem;color:var(--text2)">Total recaudado en billeteras/bancos (sin efectivo):</span>
        <strong style="color:var(--gold);font-size:.95rem">S/ ${(ventas.yape + ventas.plin + ventas.transferencia).toFixed(2)}</strong>
      </div>
    `;

    // Vincular botón cerrar caja
    document.getElementById('cajaCerrarBtn')?.addEventListener('click', () => {
      openCerrarCajaDialog(ventas);
    });

  } else {
    // Caja cerrada: Actualizar estado de indicador
    statusLabel.className = 'caja-status-pill closed';
    statusLabel.textContent = 'Cerrada';

    activePanel.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem">
        <span style="font-size:2.2rem;display:block;margin-bottom:.5rem">🔒</span>
        <h3 style="color:var(--white);font-size:1.1rem;margin:0;font-family:'Playfair Display',serif">La caja está cerrada</h3>
        <p style="color:var(--text3);font-size:.83rem;margin-top:.3rem;margin-bottom:1.5rem">Para registrar ventas y controlar el cuadre diario, inicia un nuevo turno de caja.</p>
        <button id="cajaAbrirBtn" class="btn-add" style="padding:.6rem 1.6rem;font-size:.82rem;font-weight:700">+ Abrir Turno de Caja</button>
      </div>
    `;

    // Vincular botón abrir caja
    document.getElementById('cajaAbrirBtn')?.addEventListener('click', openAbrirCajaDialog);
  }

  // Renderizar historial
  renderCajaHistorial();
}

function openAbrirCajaDialog() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .22s ease';

  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid var(--gold-d);border-radius:10px;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--border)">
        <h3 style="margin:0;color:var(--gold);font-family:'Playfair Display',serif;font-size:1rem">Apertura de Caja POS</h3>
        <button id="closeAbrirCaja" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer">✕</button>
      </div>

      <div style="padding:1.25rem;display:flex;flex-direction:column;gap:1rem">
        <div class="caja-form-group">
          <label for="aperturaMonto">Monto Inicial (Fondo en Efectivo) *</label>
          <input id="aperturaMonto" type="number" placeholder="0.00" step="0.10" min="0" style="font-size:1rem;padding:.6rem">
        </div>
        
        <p style="font-size:.73rem;color:var(--text3);margin:0;line-height:1.4">Este monto representa el dinero físico (sencillo/cambio) con el que se arranca el turno en caja chica.</p>

        <button id="confirmAbrirCaja" class="btn-add" style="width:100%;padding:.7rem;font-weight:700;font-size:.82rem;margin-top:.4rem">CONFIRMAR APERTURA</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.style.opacity = '1', 30);

  const closeBtn = document.getElementById('closeAbrirCaja');
  const confirmBtn = document.getElementById('confirmAbrirCaja');
  const inputVal = document.getElementById('aperturaMonto');

  const close = () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 220);
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  inputVal.focus();

  confirmBtn.addEventListener('click', () => {
    const val = parseFloat(inputVal.value);
    if (isNaN(val) || val < 0) {
      showToast('Por favor, ingresa un monto inicial válido.');
      return;
    }

    CajaManager.abrirCaja(val);
    close();
    showToast('🚀 Caja abierta con éxito.');
    renderCajaSection();
  });
}

function openCerrarCajaDialog(ventas) {
  const sesion = CajaManager.getSesionActiva();
  if (!sesion) return;

  const montoEsperado = sesion.montoApertura + ventas.efectivo;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .22s ease';

  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid var(--gold-d);border-radius:10px;width:100%;max-width:440px;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--border)">
        <h3 style="margin:0;color:var(--gold);font-family:'Playfair Display',serif;font-size:1rem">Cierre y Cuadre de Caja</h3>
        <button id="closeCerrarCaja" style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer">✕</button>
      </div>

      <div style="padding:1.25rem;display:flex;flex-direction:column;gap:1rem">
        <div style="background:rgba(255,255,255,.01);border:1px solid var(--border);border-radius:6px;padding:.8rem;display:flex;justify-content:space-between">
          <span style="font-size:.8rem;color:var(--text2)">Efectivo esperado en caja:</span>
          <strong style="color:#25d366;font-size:.92rem">S/ ${montoEsperado.toFixed(2)}</strong>
        </div>

        <div class="caja-form-group">
          <label for="cierreMontoReal">Efectivo Real Contado en Caja *</label>
          <input id="cierreMontoReal" type="number" placeholder="0.00" step="0.10" min="0" style="font-size:1.15rem;padding:.6rem;font-weight:700">
        </div>

        <!-- Discrepancia interactiva -->
        <div id="cierreDiscrepanciaBox" class="caja-discrepancy-box neutral">
          <span>DIFERENCIA (CUADRE)</span>
          <span id="cierreDiscrepanciaVal">-S/ ${montoEsperado.toFixed(2)}</span>
        </div>

        <div class="caja-form-group">
          <label for="cierreNotas">Notas del Cierre (Opcional)</label>
          <textarea id="cierreNotas" rows="2" placeholder="Detalles de descuadre, faltantes o anotaciones sobre el turno..." style="font-size:.83rem;resize:none"></textarea>
        </div>

        <button id="confirmCerrarCaja" class="btn-delete" style="width:100%;padding:.75rem;font-weight:700;font-size:.82rem;margin-top:.4rem;border-radius:6px">CONFIRMAR CIERRE DE CAJA</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.style.opacity = '1', 30);

  const closeBtn = document.getElementById('closeCerrarCaja');
  const confirmBtn = document.getElementById('confirmCerrarCaja');
  const inputReal = document.getElementById('cierreMontoReal');
  const discBox = document.getElementById('cierreDiscrepanciaBox');
  const discVal = document.getElementById('cierreDiscrepanciaVal');
  const notesText = document.getElementById('cierreNotas');

  const close = () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 220);
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  inputReal.focus();

  // Escuchar inputs para calcular cuadre en tiempo real
  inputReal.addEventListener('input', () => {
    const val = parseFloat(inputReal.value) || 0;
    const diff = val - montoEsperado;

    discVal.textContent = (diff >= 0 ? '+S/ ' : '-S/ ') + Math.abs(diff).toFixed(2);

    discBox.className = 'caja-discrepancy-box';
    if (diff === 0) {
      discBox.classList.add('ok');
    } else if (diff < 0) {
      discBox.classList.add('error');
    } else {
      discBox.classList.add('surplus');
    }
  });

  confirmBtn.addEventListener('click', () => {
    const val = parseFloat(inputReal.value);
    if (isNaN(val) || val < 0) {
      showToast('Por favor, ingresa el monto físico real contado.');
      return;
    }

    CajaManager.cerrarCaja(val, notesText.value.trim(), ventas);
    close();
    showToast('🔒 Turno de caja cerrado e historiado.');
    renderCajaSection();
  });
}

function renderCajaHistorial() {
  const historyBody = document.getElementById('cajaHistoryTableBody');
  if (!historyBody) return;

  const sessions = CajaManager.getHistorial();

  if (!sessions.length) {
    historyBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;color:var(--text3);padding:2.5rem;font-style:italic">No hay turnos cerrados en el historial.</td>
      </tr>
    `;
    return;
  }

  historyBody.innerHTML = sessions.map(s => {
    const diff = s.discrepancia;
    let diffClass = 'green';
    let diffSymbol = '';
    if (diff < 0) {
      diffClass = 'red';
      diffSymbol = '-';
    } else if (diff > 0) {
      diffClass = 'gold';
      diffSymbol = '+';
    }

    const fechaAperturaStr = new Date(s.fechaApertura).toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    const fechaCierreStr = s.fechaCierre ? new Date(s.fechaCierre).toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';

    return `
      <tr>
        <td>
          <strong style="color:var(--white);font-size:.8rem">${s.id}</strong><br>
          <span style="font-size:.73rem;color:var(--text3)">Apertura: ${fechaAperturaStr}</span>
        </td>
        <td>
          <span style="font-size:.78rem;color:var(--text2)">${fechaCierreStr}</span>
        </td>
        <td style="text-align:right;font-size:.82rem">S/ ${s.montoApertura.toFixed(2)}</td>
        <td style="text-align:right;font-size:.82rem">S/ ${s.ventasEfectivo.toFixed(2)}</td>
        <td style="text-align:right;font-size:.82rem;color:var(--text2)">S/ ${s.montoEsperado.toFixed(2)}</td>
        <td style="text-align:right;font-size:.82rem;font-weight:700;color:var(--white)">S/ ${s.montoReal.toFixed(2)}</td>
        <td style="text-align:right;font-size:.82rem;font-weight:700" class="${diffClass}">${diffSymbol}S/ ${Math.abs(diff).toFixed(2)}</td>
        <td style="text-align:center">
          <span class="caja-status-pill closed" style="font-size:.62rem;padding:.15rem .45rem">Cerrado</span>
        </td>
        <td style="text-align:center">
          <button class="caja-history-delete-btn btn-delete" data-id="${s.id}" style="padding:.2rem .5rem;font-size:.65rem;border-radius:4px" title="Eliminar del historial">Eliminar</button>
        </td>
      </tr>
      ${s.notas ? `
        <tr class="caja-notes-row" style="background:rgba(255,255,255,.01)">
          <td colspan="9" style="padding:.4rem 1.2rem;font-size:.73rem;color:var(--text3);border-top:none">
            📝 <strong>Anotaciones:</strong> ${sanitize(s.notas)}
          </td>
        </tr>
      ` : ''}
    `;
  }).join('');

  // Enlazar botones eliminar del historial
  historyBody.querySelectorAll('.caja-history-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (confirm(`¿Seguro que deseas eliminar el turno ${id} del historial?`)) {
        CajaManager.eliminarSesion(id);
        showToast('Turno eliminado del historial.');
        renderCajaHistorial();
      }
    });
  });
}

// Arrancar Realtime cuando el dashboard esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Se inicia después de que showDashboard() confirme que el admin está autenticado.
  // Usamos MutationObserver para esperar a que el dashboardSection sea visible.
  const dashEl = document.getElementById('dashboardSection');
  if (!dashEl) return;
  const obs = new MutationObserver(() => {
    if (dashEl.style.display !== 'none') {
      obs.disconnect();
      startRealtimeOrders();
      _updatePendingBadge();
    }
  });
  obs.observe(dashEl, { attributes: true, attributeFilter: ['style'] });
});
