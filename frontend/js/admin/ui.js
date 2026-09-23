// ─── Modal de método de pago ──────────────────────────────────────────────────

function showPaymentModal(message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .22s ease';

  overlay.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid #7c4fb0;border-radius:10px;padding:1.5rem 1.75rem;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:1rem">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <h3 style="margin:0;font-size:1rem;color:#7c4fb0;font-weight:700">Confirmar pago</h3>
        <button id="pmClose" style="background:none;border:none;color:#888;font-size:1.1rem;cursor:pointer">✕</button>
      </div>
      <p style="margin:0;color:#e0d5c5;font-size:.88rem;white-space:pre-line;line-height:1.55">${sanitize(message)}</p>
      <p style="margin:0;font-size:.8rem;color:var(--text2);font-weight:600">¿Cómo se realizó el pago?</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem">
        <button id="pmEfectivo" style="padding:.7rem;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;background:#1e3a20;border:2px solid #4caf50;color:#4caf50;transition:all .15s"
          onmouseover="this.style.background='#2a4f2c'" onmouseout="this.style.background='#1e3a20'">
          💵<br><span style="font-size:.8rem">Efectivo</span>
        </button>
        <button id="pmYape" style="padding:.7rem;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;background:#1e1a3a;border:2px solid #7c3aed;color:#a78bfa;transition:all .15s"
          onmouseover="this.style.background='#2a2050'" onmouseout="this.style.background='#1e1a3a'">
          📱<br><span style="font-size:.8rem">Yape</span>
        </button>
        <button id="pmPlin" style="padding:.7rem;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;background:#1a2a3a;border:2px solid #29b6f6;color:#4fc3f7;transition:all .15s"
          onmouseover="this.style.background='#1e3347'" onmouseout="this.style.background='#1a2a3a'">
          📲<br><span style="font-size:.8rem">Plin</span>
        </button>
        <button id="pmTransferencia" style="padding:.7rem;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:700;background:#1e2a1e;border:2px solid #66bb6a;color:#a5d6a7;transition:all .15s"
          onmouseover="this.style.background='#263226'" onmouseout="this.style.background='#1e2a1e'">
          🏦<br><span style="font-size:.8rem">Transferencia</span>
        </button>
      </div>
      <button id="pmCancel" style="padding:.45rem;border-radius:6px;cursor:pointer;font-size:.82rem;font-weight:600;background:transparent;border:1px solid #444;color:#888">Cancelar</button>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  function cleanup() { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 240); }

  overlay.querySelector('#pmEfectivo').addEventListener('click',     () => { cleanup(); onConfirm('efectivo'); });
  overlay.querySelector('#pmYape').addEventListener('click',         () => { cleanup(); onConfirm('yape'); });
  overlay.querySelector('#pmPlin').addEventListener('click',         () => { cleanup(); onConfirm('plin'); });
  overlay.querySelector('#pmTransferencia').addEventListener('click',() => { cleanup(); onConfirm('transferencia'); });
  overlay.querySelector('#pmCancel').addEventListener('click',   () => { cleanup(); if (onCancel) onCancel(); });
  overlay.querySelector('#pmClose').addEventListener('click',    () => { cleanup(); if (onCancel) onCancel(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) { cleanup(); if (onCancel) onCancel(); } });
}

// ─── Modal de confirmación (totalmente dinámico, sin dependencia de HTML) ────

function showConfirmModal(message, onOk, onCancel) {
  // Overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:10000',
    'background:rgba(0,0,0,.72)',
    'display:flex;align-items:center;justify-content:center',
    'padding:1rem',
    'opacity:0;transition:opacity .22s ease'
  ].join(';');

  // Caja del diálogo
  const box = document.createElement('div');
  box.style.cssText = [
    'background:#1a1a1a',
    'border:1px solid #7c4fb0',
    'border-radius:10px',
    'padding:1.5rem 1.75rem',
    'max-width:420px;width:100%',
    'box-shadow:0 8px 32px rgba(0,0,0,.6)',
    'display:flex;flex-direction:column;gap:1rem'
  ].join(';');

  // Encabezado
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:1rem';

  const title = document.createElement('h3');
  title.textContent = 'Confirmar acción';
  title.style.cssText = 'margin:0;font-size:1rem;color:#7c4fb0;font-weight:700';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none;border:none;color:#888;font-size:1.1rem;cursor:pointer;line-height:1;padding:0';

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Cuerpo del mensaje
  const body = document.createElement('p');
  body.style.cssText = 'margin:0;color:#e0d5c5;font-size:.88rem;white-space:pre-line;line-height:1.55';
  body.textContent = message;

  // Pie con botones
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:.75rem;justify-content:flex-end;flex-wrap:wrap';

  const btnCan = document.createElement('button');
  btnCan.textContent = 'Cancelar';
  btnCan.style.cssText = [
    'padding:.55rem 1.1rem;border-radius:6px;cursor:pointer;font-size:.85rem;font-weight:600',
    'background:transparent;border:1px solid #555;color:#aaa'
  ].join(';');

  const btnOk = document.createElement('button');
  btnOk.textContent = 'Confirmar';
  btnOk.style.cssText = [
    'padding:.55rem 1.25rem;border-radius:6px;cursor:pointer;font-size:.85rem;font-weight:700',
    'background:#7c4fb0;border:1px solid #7c4fb0;color:#111'
  ].join(';');

  footer.appendChild(btnCan);
  footer.appendChild(btnOk);

  box.appendChild(header);
  box.appendChild(body);
  box.appendChild(footer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Fade-in
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  function cleanup() {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); }, 240);
  }
  function handleOk()     { cleanup(); onOk(); }
  function handleCancel() { cleanup(); if (onCancel) onCancel(); }

  btnOk.addEventListener('click',   handleOk);
  btnCan.addEventListener('click',  handleCancel);
  closeBtn.addEventListener('click', handleCancel);
  // Cerrar al hacer clic fuera del diálogo
  overlay.addEventListener('click', e => { if (e.target === overlay) handleCancel(); });
}

// ─── Toast de notificación ────────────────────────────────────────────────────

function showToast(msg, ms = 2800) {
  let t = document.getElementById('adminToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'adminToast';
    // En móvil se posiciona a la izquierda para no solapar con newOrderToast (derecha)
    t.style.cssText = 'position:fixed;bottom:1.5rem;left:1rem;max-width:calc(100vw - 2rem);background:var(--card);border:1px solid var(--gold-d);color:var(--text);padding:.75rem 1.25rem;border-radius:var(--r);font-size:.85rem;z-index:9999;box-shadow:var(--sh);transition:all .3s;opacity:0;transform:translateY(10px)';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.whiteSpace = 'pre-line';
  t.style.opacity = '1'; t.style.transform = 'translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; }, ms);
}

function escapeAttr(str) { return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
