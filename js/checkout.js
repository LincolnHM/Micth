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

// ─── Módulo de Checkout ───────────────────────────────────────────────────────

const Checkout = {
  deliveryType: 'pickup',

  open() {
    const modal = document.getElementById('checkoutModal');
    modal.classList.add('open');
    document.getElementById('overlay').classList.add('active');
    this.renderSummary();
    this.populateDepartments();
  },

  close() {
    document.getElementById('checkoutModal').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
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

    lines.push('\n_Mensaje enviado desde michtperfumes.com_');
    return lines.join('\n');
  },

  validateShippingForm() {
    const dni    = document.getElementById('dniInput').value.trim();
    const name   = document.getElementById('nameInput').value.trim();
    const phone  = document.getElementById('phoneInput').value.trim();
    const dept   = document.getElementById('departmentSelect').value;
    const prov   = document.getElementById('provinceSelect').value;
    const shalom = document.getElementById('shalomInput').value.trim();

    const errors = [];
    if (!/^\d{8}$/.test(dni))        errors.push('El DNI debe tener 8 dígitos.');
    if (name.length < 3)             errors.push('Ingresa tu nombre completo.');
    if (!/^\d{7,9}$/.test(phone))    errors.push('El teléfono debe tener entre 7 y 9 dígitos.');
    if (!dept)                        errors.push('Selecciona un departamento.');
    if (!prov)                        errors.push('Selecciona una provincia.');
    if (shalom.length < 3)           errors.push('Indica la agencia Shalom.');
    return errors;
  },

  send() {
    if (Cart.items.length === 0) {
      alert('Tu carrito está vacío.');
      return;
    }

    if (this.deliveryType === 'pickup') {
      const name = document.getElementById('pickupNameInput').value.trim();
      if (name.length < 2) { alert('Por favor ingresa tu nombre para el recojo.'); return; }
    }

    if (this.deliveryType === 'shipping') {
      const errors = this.validateShippingForm();
      if (errors.length) {
        alert(errors.join('\n'));
        return;
      }
    }

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
      customerName:  isShipping ? document.getElementById('nameInput').value.trim()   : 'Recojo en tienda',
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

  document.getElementById('sendWhatsappBtn').addEventListener('click', () => Checkout.send());
});
