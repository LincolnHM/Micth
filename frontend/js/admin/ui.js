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
    'background:#7c4fb0;border:1px solid #7c4fb0;color:#fff'
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
