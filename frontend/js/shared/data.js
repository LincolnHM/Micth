function mergeProductsWithDefaults(products) {
  const defaultsById = new Map(DEFAULT_PRODUCTS.map(product => [product.id, product]));
  const seenIds = new Set();
  let changed = false;

  const merged = products.map(product => {
    seenIds.add(product.id);
    const defaults = defaultsById.get(product.id);
    if (!defaults) {
      return product;
    }

    const nextProduct = {
      ...defaults,
      ...product,
      imageUrl: product.imageUrl || defaults.imageUrl || buildProductImage({ ...defaults, ...product })
    };

    if (JSON.stringify(nextProduct) !== JSON.stringify(product)) {
      changed = true;
    }

    return nextProduct;
  });

  DEFAULT_PRODUCTS.forEach(product => {
    if (!seenIds.has(product.id)) {
      merged.push({ ...product });
      changed = true;
    }
  });

  return { products: merged, changed };
}

// ─── Acordes principales (estilo Fragrantica) ─────────────────────────────────
// p.accords: [{ name: 'fresco especiado', pct: 100 }, ...] ordenado de mayor a menor.

function parseAccordsText(text) {
  return String(text || '')
    .split('\n')
    .map(line => {
      const m = line.match(/^\s*([^:]+):\s*(\d+(?:\.\d+)?)\s*%?\s*$/);
      if (!m) return null;
      const name = m[1].trim();
      const pct  = Math.max(1, Math.min(100, parseFloat(m[2])));
      return name ? { name, pct } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 12);
}

function accordsToText(accords) {
  if (!Array.isArray(accords) || !accords.length) return '';
  return accords.map(a => `${a.name}: ${a.pct}`).join('\n');
}

const ACCORD_COLORS = {
  'cítrico': '#d7de4c', 'citrico': '#d7de4c',
  'fresco especiado': '#93b562',
  'fresco': '#a8d18c',
  'verde': '#7fa06a',
  'herbal': '#7c9473',
  'aromático': '#6f8f78', 'aromatico': '#6f8f78',
  'acuático': '#6ec3d6', 'acuatico': '#6ec3d6',
  'marino': '#5aa8c2',
  'ozónico': '#8fd0e0', 'ozonico': '#8fd0e0',
  'afrutado': '#c65a7c', 'frutal': '#c65a7c',
  'floral': '#e79cc2', 'florales': '#e79cc2',
  'blanco floral': '#f0c9dd',
  'dulce': '#e0637e',
  'vainilla': '#e8c9a0',
  'caramelo': '#d1a25c',
  'almizclado': '#e6d4e6', 'almizcle': '#e6d4e6',
  'polvoriento': '#cbb3d1', 'empolvado': '#cbb3d1',
  'amaderado': '#9c6b3f', 'madera': '#9c6b3f',
  'cedro': '#a97c50',
  'sándalo': '#b58a5c', 'sandalo': '#b58a5c',
  'oud': '#6e3b3b',
  'cuero': '#5a3d30',
  'ámbar': '#c98a4b', 'ambar': '#c98a4b',
  'especiado suave': '#dba077',
  'especiado': '#d17a45',
  'picante': '#c9542f',
  'balsámico': '#b06a35', 'balsamico': '#b06a35',
  'ahumado': '#5f5048',
  'tabaco': '#7a5230',
  'café': '#4a2f22', 'cafe': '#4a2f22',
  'cacao': '#4a2f22', 'chocolate': '#4a2f22',
  'lavanda': '#9a86c4',
  'anís': '#c8dfb8', 'anis': '#c8dfb8',
  'gourmand': '#d99e6c',
  'coco': '#e8d8b8',
  'almendra': '#d8bd93',
  'rosa': '#e6879f',
  'jazmín': '#f0d1e0', 'jazmin': '#f0d1e0',
  'atalcado': '#cbb3d1',
  'cálido especiado': '#c9642f', 'calido especiado': '#c9642f',
  'floral blanco': '#f0c9dd',
  'floral amarillo': '#e8d17a',
  'aldehídico': '#b8c4cc', 'aldehidico': '#b8c4cc',
  'terrosos': '#8a7a63', 'terroso': '#8a7a63',
  'iris': '#c3b8cf',
  'tropical': '#f0a83c',
  'musgoso': '#6b6f4a',
  'canela': '#a85a35',
  'pachulí': '#6e5a3a', 'pachuli': '#6e5a3a',
  'acerezado': '#c94b6a',
  'herbáceo': '#7c9473', 'herbaceo': '#7c9473',
  'mineral': '#9db3ad',
  'salado': '#a9c2cc',
  'jabonoso': '#d9e2df',
  'violeta': '#a48fc7',
  'animálico': '#5c4a3a', 'animalico': '#5c4a3a',
  'amielado': '#d9a441',
  'lactónico': '#f0e2c8', 'lactonico': '#f0e2c8',
  'terpénico': '#a9c47a', 'terpenico': '#a9c47a',
  'nueces': '#b98d5a',
  'ron': '#8a4a2a',
  'animal': '#5c4a3a',
  'conífero': '#5f7a52', 'conifero': '#5f7a52'
};

function accordColor(name) {
  const key = String(name || '').toLowerCase().trim();
  if (ACCORD_COLORS[key]) return ACCORD_COLORS[key];
  for (const k in ACCORD_COLORS) {
    if (key.includes(k)) return ACCORD_COLORS[k];
  }
  const hue = hashString(key) % 360;
  return `hsl(${hue}, 45%, 62%)`;
}

function accordTextColor(color) {
  if (color.startsWith('hsl')) return '#1a1a1a';
  const c = color.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16), g = parseInt(c.substring(2, 4), 16), b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#fff8ec';
}

// ─── API de productos ─────────────────────────────────────────────────────────

const Products = {
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seeded = DEFAULT_PRODUCTS.map(product => ({ ...product }));
        this.save(seeded);
        return seeded;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        const seeded = DEFAULT_PRODUCTS.map(product => ({ ...product }));
        this.save(seeded);
        return seeded;
      }

      const { products, changed } = mergeProductsWithDefaults(parsed);
      if (changed) {
        this.save(products);
      }
      return products;
    } catch {
      const seeded = DEFAULT_PRODUCTS.map(product => ({ ...product }));
      this.save(seeded);
      return seeded;
    }
  },
  save(products) { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); },
  getById(id) { return this.getAll().find(p => p.id === id); },
  add(product) {
    const products = this.getAll();
    const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({ ...product, id: newId });
    this.save(products);
    return newId;
  },
  update(id, data) { this.save(this.getAll().map(p => p.id === id ? { ...p, ...data } : p)); },
  delete(id) { this.save(this.getAll().filter(p => p.id !== id)); }
};

// ─── API de combos de decants ──────────────────────────────────────────────────
// Un combo es un set fijo de 2-3 perfumes (uno de cada uno, `items` = lista de
// productId). NO tiene un único precio: tiene hasta 4 precios, uno por talla
// (COMBO_SIZES) — el cliente elige con qué talla quiere TODOS los perfumes del
// combo y paga el precio de esa talla. Una talla con precio 0/ausente no se
// ofrece en ese combo (mismo criterio que ya se usa en `sizes` de productos).
// El "precio antes" NUNCA se guarda congelado — se recalcula en vivo contra el
// catálogo actual para cada talla.

const COMBO_SIZES = ['2ml', '3ml', '5ml', '10ml'];

const Combos = {
  getAll() {
    try {
      const raw = localStorage.getItem(COMBOS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  save(combos) {
    try {
      localStorage.setItem(COMBOS_KEY, JSON.stringify(combos));
    } catch {
      // Cuota del navegador llena (típico con fotos grandes): guardar sin fotos
      // en vez de romper el guardado del combo.
      try { localStorage.setItem(COMBOS_KEY, JSON.stringify(combos.map(c => ({ ...c, imageUrl: '' })))); } catch {}
    }
  },
  getById(id) { return this.getAll().find(c => c.id === id); },
  add(combo) {
    const combos = this.getAll();
    const newId = combos.length ? Math.max(...combos.map(c => c.id)) + 1 : 1;
    const newCombo = { ...combo, id: newId };
    combos.push(newCombo);
    this.save(combos);
    return newId;
  },
  update(id, data) { this.save(this.getAll().map(c => c.id === id ? { ...c, ...data } : c)); },
  delete(id) { this.save(this.getAll().filter(c => c.id !== id)); }
};

// Precio de un tamaño de producto dado (0 si no existe la talla o el producto).
function comboItemUnitPrice(product, size) {
  if (!product) return 0;
  const price = product.sizes ? product.sizes[size] : undefined;
  return typeof price === 'number' ? price : parseFloat(price) || 0;
}

// Info de un combo para UNA talla dada: cuánto costaría comprar cada perfume
// por separado en esa talla (`before`), y si esa talla está realmente
// disponible para TODOS los perfumes del combo (`available` — si a alguno le
// falta precio en esa talla, no tiene sentido ofrecerla, aunque el admin haya
// puesto un precio de combo ahí por error).
function comboSizeInfo(combo, allProducts, size) {
  const lookup = new Map((allProducts || []).map(p => [p.id, p]));
  let before = 0;
  let available = true;
  (combo?.items || []).forEach(productId => {
    const product = lookup.get(productId);
    const unit = comboItemUnitPrice(product, size);
    if (!(unit > 0)) available = false;
    before += unit;
  });
  if (!(combo?.items || []).length) available = false;
  return { before, available };
}

// Todas las tallas del combo que tienen precio puesto Y siguen disponibles
// para los perfumes elegidos — lo que realmente se puede ofrecer al cliente.
function comboAvailableSizes(combo, allProducts) {
  return COMBO_SIZES
    .map(size => ({ size, price: parseFloat(combo?.prices?.[size]) || 0, ...comboSizeInfo(combo, allProducts, size) }))
    .filter(s => s.price > 0 && s.available);
}

// ─── Pedidos → stock (funciones puras, sin red) ───────────────────────────────
// Un pedido "descontó stock" mientras está en un estado de pago. Pasar a
// cualquiera de estos estados descuenta; salir de ellos (a pendiente/cancelado)
// devuelve el stock. "enviado"/"entregado" son estados viejos que ya no se
// ofrecen en el panel pero pueden existir en pedidos antiguos.
const PAID_STATES = ['pagado', 'enviado', 'entregado'];
const isPaidStatus = status => PAID_STATES.includes(status);

// Un item de combo no es un producto real: trae su propio desglose (comboItems)
// con los perfumes que sí salen del frasco.
function flattenOrderItems(items) {
  return (Array.isArray(items) ? items : []).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    if (Array.isArray(item.comboItems) && item.comboItems.length) {
      const mult = parseInt(item.quantity) || 1;
      return item.comboItems.map(ci => ({ ...ci, quantity: (parseInt(ci.qty) || 1) * mult }));
    }
    return [item];
  });
}

// Cuánto sale del inventario por cada perfume: ml del frasco (decants), unidades
// (perfumes enteros) y unidades de entero sellado de un perfume que también se
// vende en decant. Suma TODAS las líneas del mismo perfume — un pedido puede
// traer el mismo perfume en dos tallas (ej. 3ml + 10ml) y ambas deben restar.
// `lookup` es un Map (o un objeto) id → producto.
function orderStockNeeds(items, lookup) {
  const get = id => (lookup instanceof Map ? lookup.get(id) : lookup?.[id]);
  const needs = new Map();
  const skipped = [];
  flattenOrderItems(items).forEach(item => {
    const pid = parseInt(item.productId);
    if (isNaN(pid) || pid < 0) return;
    const product = get(pid);
    if (!product) {
      skipped.push(((item.brand || '') + ' ' + (item.productName || item.name || '#' + pid)).trim());
      return;
    }
    const qty = Math.max(1, parseInt(item.quantity) || 1);
    const n = needs.get(pid) || { productId: pid, label: `${product.brand} ${product.name}`.trim(), ml: 0, units: 0, enteroUnits: 0 };
    if (product.type === 'entero') {
      n.units += qty;
    } else if (item.size === 'Unidad') {
      n.enteroUnits += qty;
    } else {
      const mlEach = parseFloat(item.size);
      if (isNaN(mlEach) || mlEach <= 0) return;
      n.ml += mlEach * qty;
    }
    needs.set(pid, n);
  });
  return { needs, skipped };
}

// ─── API de pedidos ───────────────────────────────────────────────────────────

const Orders = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); }
    catch { return []; }
  },
  save(orders) { localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)); },
  getById(id) { return this.getAll().find(o => o.id === id); },

  create(order) {
    const orders  = this.getAll();
    const num     = orders.length + 1;
    const newOrder = {
      ...order,
      id:        `ORD-${String(num).padStart(4, '0')}`,
      date:      new Date().toISOString(),
      status:    'pendiente'
    };
    orders.unshift(newOrder);
    this.save(orders);
    return newOrder.id;
  },

  // Solo cambia el estado en el caché local. El stock NO se toca aquí: lo descuenta
  // (o devuelve) CloudOrders.updateStatus una sola vez, contra la base de datos.
  updateStatus(id, status, paymentMethod = null) {
    const orders = this.getAll().map(o => {
      if (o.id !== id) return o;
      const updated = { ...o, status, updatedAt: new Date().toISOString() };
      if (paymentMethod) updated.paymentMethod = paymentMethod;
      return updated;
    });
    this.save(orders);
  },

  delete(id) { this.save(this.getAll().filter(o => o.id !== id)); },

  getStats() {
    const all = this.getAll();
    return {
      total:     all.length,
      pendiente: all.filter(o => o.status === 'pendiente').length,
      pagado:    all.filter(o => o.status === 'pagado').length,
      enviado:   all.filter(o => o.status === 'enviado').length,
      entregado: all.filter(o => o.status === 'entregado').length,
      revenue:   all.filter(o => ['pagado','enviado','entregado'].includes(o.status))
                    .reduce((s, o) => s + o.total, 0)
    };
  }
};

// ─── Configuracion de campanas visuales ─────────────────────────────────────

const VALID_CAMPAIGNS = new Set(['default', 'dia-madre', 'dia-padre', 'san-juan', 'navidad']);

function getNthWeekdayOfMonth(year, monthIndex, weekday, nth) {
  const first = new Date(year, monthIndex, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function computePeruCampaignByDate(dateValue = new Date()) {
  const date  = new Date(dateValue);
  const year  = date.getFullYear();
  const month = date.getMonth();
  const day   = date.getDate();

  // Navidad: todo diciembre para campaña comercial completa.
  if (month === 11) return 'navidad';

  // Día de la Madre: segundo domingo de mayo (empieza 7 días antes).
  if (month === 4) {
    const mothersDay = getNthWeekdayOfMonth(year, 4, 0, 2);
    if (day >= mothersDay - 6 && day <= mothersDay) return 'dia-madre';
  }

  if (month === 5) {
    // Día del Padre: tercer domingo de junio (empieza 7 días antes).
    const fathersDay = getNthWeekdayOfMonth(year, 5, 0, 3);
    if (day >= fathersDay - 6 && day <= fathersDay) return 'dia-padre';

    // San Juan: 24 de junio (empieza 7 días antes = día 17).
    // Solo aplica si ya terminó la ventana del Padre.
    if (day >= 17 && day <= 24) return 'san-juan';
  }

  return 'default';
}

function normalizeCampaign(value) {
  const campaign = String(value || '').trim().toLowerCase();
  return VALID_CAMPAIGNS.has(campaign) ? campaign : 'default';
}

function nowIso() {
  return new Date().toISOString();
}

const SiteTheme = {
  async getSettings() {
    // Priorizar nube para que el cambio se refleje a todos los visitantes.
    if (typeof db !== 'undefined' && db) {
      const { data, error } = await db
        .from('site_settings')
        .select('value, updated_at')
        .eq('key', 'active_campaign')
        .maybeSingle();

      if (!error && data) {
        const value = (data.value && typeof data.value === 'object') ? data.value : {};
        const settings = {
          campaign: normalizeCampaign(value.campaign),
          mode: value.mode === 'auto' ? 'auto' : 'manual',
          updatedAt: value.updatedAt || data.updated_at || null
        };
        if (settings.mode === 'auto') {
          settings.campaign = computePeruCampaignByDate();
        }
        this._saveLocal(settings);
        return settings;
      }
    }
    const fallback = this._readLocal();
    if (fallback.mode === 'auto') {
      fallback.campaign = computePeruCampaignByDate();
    }
    return fallback;
  },

  async getActiveCampaign() {
    const settings = await this.getSettings();
    return settings.campaign;
  },

  async setActiveCampaign(campaign) {
    const normalized = normalizeCampaign(campaign);
    const payload = { campaign: normalized, mode: 'manual', updatedAt: nowIso() };

    // Guardar local primero para respuesta inmediata y sync entre pestañas.
    this._saveLocal(payload);

    if (typeof db !== 'undefined' && db) {
      const { error } = await db
        .from('site_settings')
        .upsert(
          {
            key: 'active_campaign',
            value: payload,
            updated_at: nowIso()
          },
          { onConflict: 'key' }
        );

      if (!error) {
        return { ...payload, synced: true };
      }
      return { ...payload, synced: false, error };
    }

    return { ...payload, synced: false };
  },

  async setAutomaticMode() {
    const payload = {
      campaign: computePeruCampaignByDate(),
      mode: 'auto',
      updatedAt: nowIso()
    };

    this._saveLocal(payload);

    if (typeof db !== 'undefined' && db) {
      const { error } = await db
        .from('site_settings')
        .upsert(
          {
            key: 'active_campaign',
            value: payload,
            updated_at: nowIso()
          },
          { onConflict: 'key' }
        );

      if (!error) {
        return { ...payload, synced: true };
      }
      return { ...payload, synced: false, error };
    }

    return { ...payload, synced: false };
  },

  _readLocal() {
    try {
      const raw = localStorage.getItem(SITE_THEME_KEY);
      if (!raw) return { campaign: 'default', updatedAt: null };
      const parsed = JSON.parse(raw);
      return {
        campaign: normalizeCampaign(parsed?.campaign),
        mode: parsed?.mode === 'auto' ? 'auto' : 'manual',
        updatedAt: parsed?.updatedAt || null
      };
    } catch {
      return { campaign: 'default', mode: 'manual', updatedAt: null };
    }
  },

  _saveLocal(settings) {
    const payload = {
      campaign: normalizeCampaign(settings?.campaign),
      mode: settings?.mode === 'auto' ? 'auto' : 'manual',
      updatedAt: settings?.updatedAt || nowIso()
    };
    localStorage.setItem(SITE_THEME_KEY, JSON.stringify(payload));
    return payload;
  }
};

// ─── Anuncio de bienvenida (modal al entrar a la tienda) ──────────────────────
// Reutiliza la misma tabla genérica `site_settings` que SiteTheme (key/value),
// así no hace falta crear ninguna tabla nueva en Supabase.

const ANNOUNCEMENT_KEY = 'micht_announcement';

function normalizeCtaAction(value) {
  return (value === 'catalog' || value === 'whatsapp') ? value : 'none';
}

const SiteAnnouncement = {
  async getSettings() {
    if (typeof db !== 'undefined' && db) {
      const { data, error } = await db
        .from('site_settings')
        .select('value, updated_at')
        .eq('key', 'announcement')
        .maybeSingle();

      if (!error && data) {
        const value = (data.value && typeof data.value === 'object') ? data.value : {};
        const settings = this._normalize(value, data.updated_at);
        this._saveLocal(settings);
        return settings;
      }
    }
    return this._readLocal();
  },

  async save(input) {
    const payload = this._normalize(input, nowIso());

    this._saveLocal(payload);

    if (typeof db !== 'undefined' && db) {
      const { error } = await db
        .from('site_settings')
        .upsert(
          { key: 'announcement', value: payload, updated_at: nowIso() },
          { onConflict: 'key' }
        );
      if (!error) return { ...payload, synced: true };
      return { ...payload, synced: false, error };
    }
    return { ...payload, synced: false };
  },

  _normalize(value, updatedAtFallback) {
    return {
      enabled:    !!value?.enabled,
      imageUrl:   String(value?.imageUrl ?? '').trim(),
      emoji:      String(value?.emoji ?? '📢').trim().slice(0, 8) || '📢',
      title:      String(value?.title ?? '').trim().slice(0, 80),
      message:    String(value?.message ?? '').trim().slice(0, 260),
      ctaText:    String(value?.ctaText ?? '').trim().slice(0, 40),
      ctaAction:  normalizeCtaAction(value?.ctaAction),
      updatedAt:  value?.updatedAt || updatedAtFallback || null
    };
  },

  _readLocal() {
    try {
      const raw = localStorage.getItem(ANNOUNCEMENT_KEY);
      if (!raw) return this._normalize({}, null);
      return this._normalize(JSON.parse(raw), null);
    } catch {
      return this._normalize({}, null);
    }
  },

  _saveLocal(settings) {
    try { localStorage.setItem(ANNOUNCEMENT_KEY, JSON.stringify(settings)); } catch {}
  }
};

// ─── Sanitización ─────────────────────────────────────────────────────────────

function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '').trim().slice(0, 500);
  return d.innerHTML;
}

function sanitizeNum(val, min = 0, max = 99999) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : Math.min(Math.max(n, min), max);
}

// ─── Familias olfativas disponibles ──────────────────────────────────────────

const OLF_FAMILIES = [
  'Floral', 'Floral Amaderado', 'Floral Frutal', 'Floral Oriental', 'Floral Aldehídico',
  'Amaderado', 'Amaderado Frutal', 'Amaderado Especiado', 'Amaderado Marino',
  'Aromático Amaderado', 'Aromático Frutal', 'Aromático Acuático',
  'Oriental', 'Oriental Floral', 'Oriental Amaderado', 'Oriental Especiado',
  'Oriental Cítrico', 'Oriental Gourmand', 'Oriental Ahumado',
  'Gourmand', 'Gourmand Floral',
  'Cítrico', 'Cítrico Aromático',
  'Acuático', 'Acuático Aromático',
  'Frutal Floral',
  'Cuero', 'Chypre'
];
