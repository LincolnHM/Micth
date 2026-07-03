// ─── Datos geográficos de Perú ────────────────────────────────────────────────

const PERU_GEO = {
  'Amazonas':       ['Chachapoyas','Bagua','Bongará','Condorcanqui','Luya','Rodríguez de Mendoza','Utcubamba'],
  'Áncash':         ['Huaraz','Aija','Antonio Raymondi','Asunción','Bolognesi','Carhuaz','Carlos Fermín Fitzcarrald','Casma','Corongo','Huari','Huarmey','Huaylas','Mariscal Luzuriaga','Ocros','Pallasca','Pomabamba','Recuay','Santa','Sihuas','Yungay'],
  'Apurímac':       ['Abancay','Andahuaylas','Antabamba','Aymaraes','Cotabambas','Chincheros','Grau'],
  'Arequipa':       ['Arequipa','Camaná','Caravelí','Castilla','Caylloma','Condesuyos','Islay','La Unión'],
  'Ayacucho':       ['Huamanga','Cangallo','Huanca Sancos','Huanta','La Mar','Lucanas','Parinacochas','Páucar del Sara Sara','Sucre','Víctor Fajardo','Vilcas Huamán'],
  'Cajamarca':      ['Cajamarca','Cajabamba','Celendín','Chota','Contumazá','Cutervo','Hualgayoc','Jaén','San Ignacio','San Marcos','San Miguel','San Pablo','Santa Cruz'],
  'Callao':         ['Callao'],
  'Cusco':          ['Cusco','Acomayo','Anta','Calca','Canas','Canchis','Chumbivilcas','Espinar','La Convención','Paruro','Paucartambo','Quispicanchi','Urubamba'],
  'Huancavelica':   ['Huancavelica','Acobamba','Angaraes','Castrovirreyna','Churcampa','Huaytará','Tayacaja'],
  'Huánuco':        ['Huánuco','Ambo','Dos de Mayo','Huacaybamba','Huamalíes','Leoncio Prado','Marañón','Pachitea','Puerto Inca','Lauricocha','Yarowilca'],
  'Ica':            ['Ica','Chincha','Nazca','Palpa','Pisco'],
  'Junín':          ['Huancayo','Chanchamayo','Chupaca','Concepción','Jauja','Junín','Satipo','Tarma','Yauli'],
  'La Libertad':    ['Trujillo','Ascope','Bolívar','Chepén','Julcán','Otuzco','Pacasmayo','Pataz','Sánchez Carrión','Santiago de Chuco','Gran Chimú','Virú'],
  'Lambayeque':     ['Chiclayo','Ferreñafe','Lambayeque'],
  'Lima':           ['Lima','Barranca','Cajatambo','Canta','Cañete','Huaral','Huarochirí','Huaura','Oyón','Yauyos'],
  'Loreto':         ['Maynas','Alto Amazonas','Loreto','Mariscal Ramón Castilla','Putumayo','Requena','Ucayali','Datem del Marañón'],
  'Madre de Dios':  ['Tambopata','Manu','Tahuamanu'],
  'Moquegua':       ['Mariscal Nieto','General Sánchez Cerro','Ilo'],
  'Pasco':          ['Pasco','Daniel Alcídes Carrión','Oxapampa'],
  'Piura':          ['Piura','Ayabaca','Huancabamba','Morropón','Paita','Sechura','Sullana','Talara'],
  'Puno':           ['Puno','Azángaro','Carabaya','Chucuito','El Collao','Huancané','Lampa','Melgar','Moho','San Antonio de Putina','San Román','Sandia','Yunguyo'],
  'San Martín':     ['Moyobamba','Bellavista','El Dorado','Huallaga','Lamas','Mariscal Cáceres','Picota','Rioja','San Martín','Tocache'],
  'Tacna':          ['Tacna','Candarave','Jorge Basadre','Tarata'],
  'Tumbes':         ['Tumbes','Contralmirante Villar','Zarumilla'],
  'Ucayali':        ['Coronel Portillo','Atalaya','Padre Abad','Purús']
};

const WHATSAPP_NUMBER = '51917452643';

// ─── Reglas de validación ─────────────────────────────────────────────────────

const _rules = {
  pickupName(v) {
    v = v.trim();
    if (v.length < 2) return 'Ingresa tu nombre (mínimo 2 letras).';
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/.test(v)) return 'El nombre solo debe contener letras.';
    return null;
  },
  dni(v) {
    if (!/^\d{8}$/.test(v.trim())) return 'El DNI debe tener exactamente 8 dígitos numéricos.';
    return null;
  },
  name(v) {
    v = v.trim();
    if (v.length < 4) return 'Ingresa tu nombre y apellido completos.';
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/.test(v)) return 'Solo letras y espacios, sin números ni caracteres especiales.';
    if (v.split(/\s+/).filter(Boolean).length < 2) return 'Escribe nombre Y apellido (al menos dos palabras).';
    return null;
  },
  phone(v) {
    v = v.trim();
    if (!/^9\d{8}$/.test(v)) return 'Celular peruano inválido — debe tener 9 dígitos y empezar con 9 (ej: 987654321).';
    if (/^(\d)\1{8}$/.test(v)) return 'Número inválido — no pueden ser todos los dígitos iguales.';
    return null;
  },
  department(v) {
    if (!v) return 'Selecciona tu departamento.';
    return null;
  },
  province(v) {
    if (!v) return 'Selecciona tu provincia.';
    return null;
  },
  shalom(v) {
    v = v.trim();
    if (v.length < 5) return 'Indica la agencia Shalom con dirección (ej: Shalom – Av. España 123, Trujillo).';
    return null;
  }
};

// ─── Helpers de feedback visual ───────────────────────────────────────────────

function _showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  const grp = el.closest('.form-group');
  if (!grp) return;
  grp.classList.add('fv-error');
  grp.classList.remove('fv-ok');
  let p = grp.querySelector('.fv-msg');
  if (!p) { p = document.createElement('p'); p.className = 'fv-msg'; grp.appendChild(p); }
  p.textContent = msg;
}

function _clearErr(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const grp = el.closest('.form-group');
  if (!grp) return;
  grp.classList.remove('fv-error');
  grp.classList.add('fv-ok');
  const p = grp.querySelector('.fv-msg');
  if (p) p.textContent = '';
}

function _resetAllErr() {
  document.querySelectorAll('.form-group.fv-error, .form-group.fv-ok').forEach(g => {
    g.classList.remove('fv-error', 'fv-ok');
    const p = g.querySelector('.fv-msg');
    if (p) p.textContent = '';
  });
}

// ─── Módulo de Checkout ───────────────────────────────────────────────────────

const Checkout = {
  deliveryType: 'pickup',
  _step: 1,
  _sending: false,

  // Retorna el total efectivo (con descuento si aplica)
  _effectiveTotal() {
    const base = Cart.total();
    if (typeof UserAuth !== 'undefined' && UserAuth.hasFirstDiscount()) {
      return parseFloat((base * 0.90).toFixed(2));
    }
    return base;
  },

  open() {
    const modal = document.getElementById('checkoutModal');
    modal.classList.add('open');
    document.getElementById('overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
    this._showStep(1);
    this.renderSummary();
    this.populateDepartments();

    // Restablecer el botón de enviar por si quedó deshabilitado/con texto de carga
    // de un pedido anterior en la misma sesión
    const sendBtn = document.getElementById('sendWhatsappBtn');
    if (sendBtn) {
      sendBtn.disabled = false;
      if (sendBtn.dataset.originalHtml) sendBtn.innerHTML = sendBtn.dataset.originalHtml;
    }

    // Pre-rellenar datos del usuario si está logueado
    if (typeof UserAuth !== 'undefined' && UserAuth.isLoggedIn()) {
      const profile = UserAuth.getProfile();
      if (profile) {
        const nameInput  = document.getElementById('nameInput');
        const dniInput   = document.getElementById('dniInput');
        const phoneInput = document.getElementById('phoneInput');
        if (nameInput  && !nameInput.value  && profile.nombre_completo) nameInput.value  = profile.nombre_completo;
        if (dniInput   && !dniInput.value   && profile.dni)             dniInput.value   = profile.dni;
        if (phoneInput && !phoneInput.value && profile.telefono)        phoneInput.value = profile.telefono;
        const pickupInput = document.getElementById('pickupNameInput');
        if (pickupInput && !pickupInput.value && profile.nombre_completo) pickupInput.value = profile.nombre_completo;
      }
    }
  },

  close() {
    this._sending = false;
    document.getElementById('checkoutModal').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
    document.body.style.overflow = '';
  },

  _showStep(n) {
    this._step = n;
    document.getElementById('checkoutStep1').classList.toggle('hidden', n !== 1);
    document.getElementById('checkoutStep2').classList.toggle('hidden', n !== 2);
    document.getElementById('mstep1').classList.toggle('active', n >= 1);
    document.getElementById('mstep2').classList.toggle('active', n >= 2);
    document.getElementById('mstepLine').classList.toggle('active', n >= 2);
    document.getElementById('checkoutTitle').textContent = n === 1 ? 'Finalizar Pedido' : 'Pagar con Yape';
    if (n === 2) {
      document.getElementById('yapeTotalAmount').textContent = `S/ ${this._effectiveTotal().toFixed(2)}`;
      document.querySelector('.modal-content').scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  goToPayment() {
    if (Cart.items.length === 0) { alert('Tu carrito está vacío.'); return; }
    if (this.deliveryType === 'pickup'   && !this.validatePickupForm())   return;
    if (this.deliveryType === 'shipping' && !this.validateShippingForm()) return;
    this._showStep(2);
  },

  renderSummary() {
    const el        = document.getElementById('modalOrderSummary');
    const base      = Cart.total();
    const hasDisc   = typeof UserAuth !== 'undefined' && UserAuth.hasFirstDiscount();
    const effective = this._effectiveTotal();
    const discount  = hasDisc ? parseFloat((base - effective).toFixed(2)) : 0;

    const discountBanner = hasDisc ? `
      <div class="checkout-discount-banner">
        <span class="checkout-discount-badge">10% OFF</span>
        <span class="checkout-discount-text"><strong>¡Descuento de primera compra aplicado!</strong> Ahorra S/ ${discount.toFixed(2)}</span>
      </div>` : '';

    const discountRow = hasDisc ? `
      <div class="order-discount-row">
        <span>Descuento 10% (primera compra)</span>
        <span>- S/ ${discount.toFixed(2)}</span>
      </div>
      <div class="order-total-row-final">
        <strong>Total a pagar</strong>
        <strong>S/ ${effective.toFixed(2)}</strong>
      </div>` : `
      <div class="order-total-row">
        <strong>Total</strong>
        <strong>S/ ${base.toFixed(2)}</strong>
      </div>`;

    el.innerHTML = `
      ${discountBanner}
      <h4>Resumen del Pedido</h4>
      <ul class="order-list">
        ${Cart.items.map(i => `
          <li>
            <span>${sanitize(i.brand)} – ${sanitize(i.productName)} (${sanitize(i.size)}) × ${i.quantity}</span>
            <span>S/ ${(i.price * i.quantity).toFixed(2)}</span>
          </li>
        `).join('')}
      </ul>
      ${hasDisc ? `<div class="order-total-row" style="text-decoration:line-through;color:var(--text3);font-size:.85rem"><span>Subtotal</span><span>S/ ${base.toFixed(2)}</span></div>` : ''}
      ${discountRow}
    `;
  },

  populateDepartments() {
    const sel = document.getElementById('departmentSelect');
    sel.innerHTML = '<option value="">Selecciona un departamento</option>' +
      Object.keys(PERU_GEO).sort().map(d => `<option value="${escapeAttr(d)}">${d}</option>`).join('');
  },

  populateProvinces(department) {
    const sel = document.getElementById('provinceSelect');
    const provinces = PERU_GEO[department] || [];
    sel.innerHTML = '<option value="">Selecciona una provincia</option>' +
      provinces.map(p => `<option value="${escapeAttr(p)}">${p}</option>`).join('');
  },

  buildWhatsAppMessage() {
    const lines      = ['🛍️ *NUEVO PEDIDO – MICHT Perfumes*\n'];
    const base       = Cart.total();
    const hasDisc    = typeof UserAuth !== 'undefined' && UserAuth.hasFirstDiscount();
    const effective  = this._effectiveTotal();

    lines.push('*Productos:*');
    Cart.items.forEach(i => {
      lines.push(`  • ${i.brand} – ${i.productName} (${i.size}) × ${i.quantity} = S/ ${(i.price * i.quantity).toFixed(2)}`);
    });

    if (hasDisc) {
      const profile = UserAuth.getProfile();
      lines.push(`\n~~Subtotal: S/ ${base.toFixed(2)}~~`);
      lines.push(`🎁 *Descuento 10% primera compra* (DNI: ${profile?.dni || ''}): -S/ ${(base - effective).toFixed(2)}`);
      lines.push(`\n*TOTAL A PAGAR: S/ ${effective.toFixed(2)}*`);
    } else {
      lines.push(`\n*Total: S/ ${base.toFixed(2)}*`);
    }

    lines.push('\n💸 *Método de pago:* Yape ✅');
    lines.push('_(Por favor 📸 envíanos una captura de pantalla de tu pago Yape para confirmar el pedido)_');

    if (this.deliveryType === 'pickup') {
      const pickupName = document.getElementById('pickupNameInput').value.trim();
      lines.push('\n📍 *Tipo de entrega:* Recojo en Tienda');
      if (pickupName) lines.push(`*Nombre:* ${pickupName}`);
    } else {
      const dni        = document.getElementById('dniInput').value.trim();
      const name       = document.getElementById('nameInput').value.trim();
      const phone      = document.getElementById('phoneInput').value.trim();
      const department = document.getElementById('departmentSelect').value;
      const province   = document.getElementById('provinceSelect').value;
      const shalom     = document.getElementById('shalomInput').value.trim();

      lines.push('\n📦 *Tipo de entrega:* Envío a Provincia (Shalom)');
      lines.push('\n*Datos del destinatario:*');
      lines.push(`  • Nombre: ${name}`);
      lines.push(`  • DNI: ${dni}`);
      lines.push(`  • Teléfono: ${phone}`);
      lines.push(`  • Departamento: ${department}`);
      lines.push(`  • Provincia: ${province}`);
      lines.push(`  • Agencia Shalom: ${shalom}`);
    }

    lines.push('\n_Mensaje enviado desde michtdecants.com');
    return lines.join('\n');
  },

  validateShippingForm() {
    const checks = [
      ['dniInput',         _rules.dni,        () => document.getElementById('dniInput').value],
      ['nameInput',        _rules.name,       () => document.getElementById('nameInput').value],
      ['phoneInput',       _rules.phone,      () => document.getElementById('phoneInput').value],
      ['departmentSelect', _rules.department, () => document.getElementById('departmentSelect').value],
      ['provinceSelect',   _rules.province,   () => document.getElementById('provinceSelect').value],
      ['shalomInput',      _rules.shalom,     () => document.getElementById('shalomInput').value],
    ];
    let ok = true;
    checks.forEach(([id, rule, get]) => {
      const err = rule(get());
      if (err) { _showErr(id, err); ok = false; }
      else     { _clearErr(id); }
    });
    return ok;
  },

  validatePickupForm() {
    const err = _rules.pickupName(document.getElementById('pickupNameInput').value);
    if (err) { _showErr('pickupNameInput', err); return false; }
    _clearErr('pickupNameInput');
    return true;
  },

  send() {
    if (this._sending) return;
    if (Cart.items.length === 0) { alert('Tu carrito está vacío.'); return; }

    this._sending = true;
    const sendBtn = document.getElementById('sendWhatsappBtn');
    if (sendBtn) {
      if (!sendBtn.dataset.originalHtml) sendBtn.dataset.originalHtml = sendBtn.innerHTML;
      sendBtn.disabled = true;
      sendBtn.textContent = 'Enviando...';
    }

    // Capturar datos del pedido ANTES de limpiar el carrito
    const isShipping    = this.deliveryType === 'shipping';
    const hasDiscount   = typeof UserAuth !== 'undefined' && UserAuth.hasFirstDiscount();
    const orderItems    = Cart.items.map(i => ({
      productId:   i.productId,
      productName: i.productName,
      brand:       i.brand,
      size:        i.size,
      price:       i.price,
      quantity:    i.quantity
    }));
    const orderTotal    = this._effectiveTotal();
    const profile       = (typeof UserAuth !== 'undefined') ? UserAuth.getProfile() : null;
    const orderData = {
      customerName:  isShipping ? document.getElementById('nameInput').value.trim()   : document.getElementById('pickupNameInput').value.trim(),
      customerPhone: isShipping ? document.getElementById('phoneInput').value.trim()  : (profile?.telefono || ''),
      customerDni:   isShipping ? document.getElementById('dniInput').value.trim()    : (profile?.dni || ''),
      deliveryType:  isShipping ? 'envio' : 'recojo',
      department:    isShipping ? document.getElementById('departmentSelect').value   : '',
      province:      isShipping ? document.getElementById('provinceSelect').value     : '',
      shalomOffice:  isShipping ? document.getElementById('shalomInput').value.trim() : '',
      notes:         hasDiscount ? 'DESCUENTO 10% PRIMERA COMPRA aplicado' : '',
      items:         orderItems,
      total:         orderTotal,
      paymentMethod: 'yape'
    };

    // Marcar descuento como usado (si aplica) antes de que la página cambie
    if (hasDiscount) {
      UserAuth.markDiscountUsed().catch(() => {});
    }

    // Guardar pedido ANTES de abrir WhatsApp para que la solicitud Supabase
    // esté en vuelo antes de cualquier posible navegación de página
    CloudOrders.create(orderData).catch(err => console.error('Error al registrar pedido:', err));

    // Abrir WhatsApp — función SÍNCRONA para preservar el gesto del usuario en móvil
    const message = encodeURIComponent(this.buildWhatsAppMessage());
    const url     = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    const opened  = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = url;

    this.close();
    Cart.clear();
    _showOrderSuccessModal(orderData);
  }
};

// ─── Modal de éxito post-pedido ───────────────────────────────────────────────

function _showOrderSuccessModal(order) {
  let modal = document.getElementById('orderSuccessModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'orderSuccessModal';
    modal.className = 'order-success-modal';
    modal.innerHTML = `
      <div class="os-backdrop"></div>
      <div class="os-box">
        <div class="os-icon">✅</div>
        <h3 class="os-title">¡Pedido enviado!</h3>
        <p class="os-sub">Tu pedido fue enviado por WhatsApp. Te confirmaremos en breve.</p>
        <div id="osSummary" class="os-summary"></div>
        <div class="os-actions">
          <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener noreferrer" class="os-wa-btn">
            <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Abrir WhatsApp
          </a>
          <button class="os-close-btn" id="osCloseBtn">Volver a la tienda</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.os-backdrop').addEventListener('click', () => modal.classList.remove('open'));
    document.getElementById('osCloseBtn').addEventListener('click', () => modal.classList.remove('open'));
  }
  document.getElementById('osSummary').innerHTML = `
    <ul class="os-items">
      ${order.items.map(i => `<li><span>${sanitize(i.brand)} – ${sanitize(i.productName)} (${sanitize(i.size)}) × ${i.quantity}</span><span>S/ ${(i.price * i.quantity).toFixed(2)}</span></li>`).join('')}
    </ul>
    <div class="os-total"><span>Total</span><strong>S/ ${order.total.toFixed(2)}</strong></div>`;
  modal.classList.add('open');
}

// ─── Inicialización del checkout ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('closeModal').addEventListener('click', () => Checkout.close());

  // Paso 1 → 2
  document.getElementById('continueToPayBtn').addEventListener('click', () => Checkout.goToPayment());

  // Paso 2 → 1
  document.getElementById('backToStep1Btn').addEventListener('click', () => Checkout._showStep(1));

  // Copiar número de celular
  document.getElementById('copyPhoneBtn').addEventListener('click', function () {
    const number = '917452643';
    const btn = this;
    const original = btn.innerHTML;
    const markCopied = () => {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg> ¡Copiado!';
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = original; btn.classList.remove('copied'); }, 2200);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(number).then(markCopied).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = number; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); markCopied();
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = number; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta); markCopied();
    }
  });

  function _applyDeliveryType(value) {
    Checkout.deliveryType = value;
    document.getElementById('pickupForm').classList.toggle('hidden', value !== 'pickup');
    const form = document.getElementById('shippingForm');
    const wasHidden = form.classList.contains('hidden');
    form.classList.toggle('hidden', value !== 'shipping');
    if (value === 'shipping' && wasHidden) {
      setTimeout(() => {
        const mc = document.querySelector('.modal-content');
        if (mc) mc.scrollTo({ top: mc.scrollHeight, behavior: 'smooth' });
      }, 60);
    }
  }

  document.querySelectorAll('input[name="deliveryType"]').forEach(radio => {
    radio.addEventListener('change', () => _applyDeliveryType(radio.value));
  });

  document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', () => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) { radio.checked = true; _applyDeliveryType(radio.value); }
    });
  });

  document.getElementById('departmentSelect').addEventListener('change', function () {
    Checkout.populateProvinces(this.value);
  });

  document.getElementById('dniInput').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 8);
  });

  document.getElementById('phoneInput').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 9);
  });

  // ── Validación en tiempo real ─────────────────────────────────────────────
  const _fieldRuleMap = {
    pickupNameInput: 'pickupName',
    dniInput:        'dni',
    nameInput:       'name',
    phoneInput:      'phone',
    shalomInput:     'shalom',
  };

  Object.entries(_fieldRuleMap).forEach(([id, ruleKey]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => {
      const err = _rules[ruleKey](el.value);
      if (err) _showErr(id, err); else _clearErr(id);
    });
    el.addEventListener('input', () => {
      const grp = el.closest('.form-group');
      if (!grp || !grp.classList.contains('fv-error')) return;
      const err = _rules[ruleKey](el.value);
      if (err) _showErr(id, err); else _clearErr(id);
    });
  });

  ['departmentSelect', 'provinceSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      const ruleKey = id === 'departmentSelect' ? 'department' : 'province';
      const err = _rules[ruleKey](el.value);
      if (err) _showErr(id, err); else _clearErr(id);
    });
  });

  document.getElementById('sendWhatsappBtn').addEventListener('click', () => Checkout.send());
});
