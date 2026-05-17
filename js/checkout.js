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

  open() {
    const modal = document.getElementById('checkoutModal');
    modal.classList.add('open');
    document.getElementById('overlay').classList.add('active');
    this._showStep(1);
    this.renderSummary();
    this.populateDepartments();
  },

  close() {
    document.getElementById('checkoutModal').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
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
      document.getElementById('yapeTotalAmount').textContent = `S/ ${Cart.total().toFixed(2)}`;
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
    const el = document.getElementById('modalOrderSummary');
    el.innerHTML = `
      <h4>Resumen del Pedido</h4>
      <ul class="order-list">
        ${Cart.items.map(i => `
          <li>
            <span>${sanitize(i.brand)} – ${sanitize(i.productName)} (${sanitize(i.size)}) × ${i.quantity}</span>
            <span>S/ ${(i.price * i.quantity).toFixed(2)}</span>
          </li>
        `).join('')}
      </ul>
      <div class="order-total-row">
        <strong>Total</strong>
        <strong>S/ ${Cart.total().toFixed(2)}</strong>
      </div>
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
    const lines = ['🛍️ *NUEVO PEDIDO – MICHT Perfumes*\n'];

    lines.push('*Productos:*');
    Cart.items.forEach(i => {
      lines.push(`  • ${i.brand} – ${i.productName} (${i.size}) × ${i.quantity} = S/ ${(i.price * i.quantity).toFixed(2)}`);
    });
    lines.push(`\n*Total: S/ ${Cart.total().toFixed(2)}*`);
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
    if (Cart.items.length === 0) { alert('Tu carrito está vacío.'); return; }

    // Capturar datos del pedido ANTES de limpiar el carrito
    const isShipping = this.deliveryType === 'shipping';
    const orderItems = Cart.items.map(i => ({
      productId:   i.productId,
      productName: i.productName,
      brand:       i.brand,
      size:        i.size,
      price:       i.price,
      quantity:    i.quantity
    }));
    const orderData = {
      customerName:  isShipping ? document.getElementById('nameInput').value.trim()   : document.getElementById('pickupNameInput').value.trim(),
      customerPhone: isShipping ? document.getElementById('phoneInput').value.trim()  : '',
      customerDni:   isShipping ? document.getElementById('dniInput').value.trim()    : '',
      deliveryType:  isShipping ? 'envio' : 'recojo',
      department:    isShipping ? document.getElementById('departmentSelect').value   : '',
      province:      isShipping ? document.getElementById('provinceSelect').value     : '',
      shalomOffice:  isShipping ? document.getElementById('shalomInput').value.trim() : '',
      notes: '',
      items: orderItems,
      total: Cart.total()
    };

    // Abrir WhatsApp — función SÍNCRONA para preservar el gesto del usuario en móvil
    const message = encodeURIComponent(this.buildWhatsAppMessage());
    const url     = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    const opened  = window.open(url, '_blank', 'noopener,noreferrer');
    // Fallback para iOS Safari que bloquea window.open
    if (!opened) window.location.href = url;

    this.close();
    Cart.clear();

    // Guardar en Supabase en segundo plano (fire-and-forget, no bloquea)
    CloudOrders.create(orderData).catch(err => console.error('Error al registrar pedido:', err));
  }
};

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
