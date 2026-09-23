// ═══════════════════════════════════════════════════════════════════════════════
// ─── SUPABASE REALTIME — notificación de nuevos pedidos ───────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

let _realtimeChannel = null;

function startRealtimeOrders() {
  if (!db || _realtimeChannel) return;

  // Solo activo si Supabase tiene Realtime habilitado en la tabla pedidos.
  // Si no lo está, este bloque falla silenciosamente.
  try {
    _realtimeChannel = db
      .channel('pedidos-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        (payload) => {
          const order = orderFromDB(payload.new);
          _showNewOrderToast(order);
          // Refrescar tabla y stats si la sección Pedidos está activa
          const ordersSection = document.getElementById('section-orders');
          if (ordersSection?.classList.contains('active')) {
            renderOrdersSection().catch(console.error);
          }
          // Actualizar badge en nav si existe
          _updatePendingBadge();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.info('[MICHT Realtime] Canal no disponible — activa Realtime en Supabase para esta tabla.');
          _realtimeChannel = null;
        }
      });
  } catch (err) {
    console.info('[MICHT Realtime] No disponible:', err?.message);
    _realtimeChannel = null;
  }
}

function _showNewOrderToast(order) {
  const toast = document.getElementById('newOrderToast');
  const msg   = document.getElementById('newOrderToastMsg');
  if (!toast || !msg) return;

  const name  = order.customerName ? `de ${order.customerName}` : '';
  const total = order.total > 0 ? ` · S/ ${order.total.toFixed(2)}` : '';
  msg.textContent = `Pedido ${name}${total}`;
  toast.style.display = 'block';

  // Auto-ocultar a los 12 segundos
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 12000);

  // Sonido de notificación (tono suave)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) {}
}

function _updatePendingBadge() {
  CloudOrders.getAll().then(orders => {
    const pending = orders.filter(o => o.status === 'pendiente').length;
    const btn = document.querySelector('[data-section="orders"]');
    if (!btn) return;
    let badge = btn.querySelector('.nav-badge');
    if (pending > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge';
        badge.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;background:#ef5350;color:#fff;border-radius:50px;font-size:.62rem;font-weight:800;margin-left:.35rem;line-height:1';
        btn.appendChild(badge);
      }
      badge.textContent = pending > 99 ? '99+' : pending;
    } else {
      badge?.remove();
    }
  }).catch(() => {});
}
