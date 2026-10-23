// ═══════════════════════════════════════════════════════════════════════════════
// ─── COTIZADOR (lista mayorista Zimaxx → precio en soles) ─────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Cotiza perfumes enteros por encargo con la lista de Zimaxx (mayorista en USA):
// toma el precio en dólares de tu link personal (catalogozimaxx.netlify.app/?c=…),
// le suma el envío y la aduana, lo pasa a soles y le pone tu margen. Con eso arma
// el mensaje de la cotización para mandarlo al cliente por WhatsApp.
//
// El link de Zimaxx funciona como una contraseña (quien lo tiene ve tus precios
// de mayorista), así que NO va en el código ni en la base: se guarda solo en el
// navegador donde lo pegas. Igual los ajustes y la cotización que estás armando.

const QT_API = 'https://yukulanekksquqkateqk.supabase.co/rest/v1/rpc/get_catalog';
// Clave pública del catálogo de Zimaxx (la misma que usa su página); sin el link no abre nada
const QT_API_KEY = 'sb_publishable_R6_Z9JkXhEDBEKxrnQEo4Q_5-puZYos';
const QT_STORE = { link: 'micht_qt_link', cfg: 'micht_qt_cfg', lines: 'micht_qt_lines', cache: 'micht_qt_cache' };
const QT_DEFAULT_NOTE = 'Pedido por encargo. Para separarlo se deja un adelanto por Yape.';
const QT_DEFAULTS = { tc: 3.40, envio: 5, aduana: 0, margen: 30, redondeo: 5, nota: QT_DEFAULT_NOTE };
const QT_LINES = { 'Perfume': 'Diseñador', 'Perfume - Arabes': 'Árabes' };
const QT_PAGE = 30;
const QT_STALE_MS = 10 * 60 * 1000;   // al volver a la sección, recarga precios si pasaron 10 min

const _qt = {
  ready: false,
  token: '',
  client: null,
  products: [],
  byId: new Map(),
  loadedAt: 0,
  loading: false,
  error: '',
  cfg: { ...QT_DEFAULTS },
  lines: [],          // { id, qty, price (S/ puesto a mano o null = sugerido), snap (copia del producto) }
  customer: { name: '', phone: '' },
  search: '', line: '', brand: '', flash: false, limit: QT_PAGE,
  shop: null,         // Map nombre normalizado → perfumes de MICHT (para "En tu tienda")
};

// ── Guardado en el navegador ──────────────────────────────────────────────────

function _qtRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}

function _qtWrite(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* modo privado o sin espacio: la herramienta sigue funcionando sin guardar */ }
}

// ── Formatos ──────────────────────────────────────────────────────────────────

function _qtNum(n, dec = 2) {
  const [int, frac] = Math.abs(n).toFixed(dec).split('.');
  return (n < 0 ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? '.' + frac : '');
}
const _qtUsdTxt = n => `US$ ${_qtNum(n)}`;
// Los precios de venta salen redondeados: sin ".00" se leen mejor en el mensaje
const _qtPen = n => `S/ ${Number.isInteger(Math.round(n * 100) / 100) ? _qtNum(n, 0) : _qtNum(n)}`;

function _qtNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

// ── Lectura del nombre de Zimaxx ("Khamrah Qahwa 3.4 Oz Edp Unisex") ─────────

// Onzas → ml como vienen en la caja (3.4 oz es 100 ml, no 100.5)
const QT_OZ_ML = {
  '0.16': 5, '0.23': 7, '0.33': 10, '0.34': 10, '0.5': 15, '0.85': 25, '1': 30, '1.7': 50,
  '2': 60, '2.5': 75, '2.7': 80, '3': 90, '3.3': 100, '3.38': 100, '3.4': 100, '3.6': 105,
  '4': 120, '4.2': 125, '6.7': 200, '6.8': 200, '8': 236, '8.4': 250,
};
// Primero se busca la talla con unidad ("3.4 Oz", "100 ml"); si no tiene, un decimal suelto
// antes de la concentración o el género ("3.4 Edp"). Así "L.12.12" no se lee como talla.
const QT_SIZE_RE = /\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:o\s?z|ox)\b|\b(\d{1,3})\s*ml\b/i;
const QT_SIZE_BARE_RE = /\b(\d{1,2}\.\d{1,2})\s+(?=edp|edt|edc|parfum|women|men|unisex)/i;
const QT_CONC = [
  [/\bextrait\b/i, 'Extrait'], [/\bparfum\b/i, 'Parfum'], [/\bedp\b/i, 'EDP'],
  [/\bedt\b/i, 'EDT'], [/\bedc\b|\bcologne\b/i, 'EDC'], [/\bbody mist\b/i, 'Body Mist'],
];
const QT_GENDER = { men: 'hombre', women: 'mujer', unisex: 'unisex' };

function _qtParseName(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  const m = n.match(QT_SIZE_RE) || n.match(QT_SIZE_BARE_RE);
  let ml = 0;
  if (m) {
    if (m[2]) ml = parseInt(m[2], 10);
    else {
      const oz = String(parseFloat(m[1]));
      ml = QT_OZ_ML[oz] || Math.round(parseFloat(oz) * 29.5735 / 5) * 5;
    }
  }
  const isSet = /^set\b/i.test(n);
  const before = m ? n.slice(0, m.index).trim() : n;
  const rest = m ? n.slice(m.index + m[0].length) : '';
  // La concentración y el género suelen ir después de la talla ("… 3.4 Oz Edp Men"), pero a
  // veces la concentración ya es parte del nombre ("9 Pm Elixir Parfum 3.4 Oz"): ahí no se repite.
  const findConc = s => (QT_CONC.find(([re]) => re.test(s)) || [null, ''])[1];
  const concAfter = findConc(rest);
  const conc = concAfter || findConc(before);
  const g = rest.match(/\b(men|women|unisex)\b/i) || before.match(/\b(men|women|unisex)\b/i);
  const gender = g ? QT_GENDER[g[1].toLowerCase()] : '';
  // Nombre para el cliente: lo que va antes de la talla + concentración + ml ("Khamrah Qahwa EDP 100 ml")
  const base = before;
  const display = isSet ? n : [base, concAfter, ml ? `${ml} ml` : ''].filter(Boolean).join(' ');
  return { ml, conc, gender, base, display, isSet };
}

function _qtPrepare(p) {
  const info = _qtParseName(p.name);
  return {
    ...p,
    ...info,
    key: info.isSet ? '' : _qtShopKey(info.base),
    searchKey: _qtNorm(`${p.name} ${p.category} ${p.upc || ''} ${info.display}`),
  };
}

// ── Precios ───────────────────────────────────────────────────────────────────

// Mismas reglas que la página de Zimaxx: cada nivel tiene su precio y el siguiente
// se activa cuando el pedido, calculado con esos precios, llega a su "threshold".
function _qtTierPrice(p, i) {
  const tp = p.tier_prices;
  const base = p.price == null ? null : Number(p.price);
  if (!Array.isArray(tp) || !tp.length) return base;
  for (let k = Math.min(i, tp.length - 1); k >= 0; k--) if (tp[k] != null) return Number(tp[k]);
  return base;
}

function _qtTiers() { return Array.isArray(_qt.client?.tiers) ? _qt.client.tiers : []; }

function _qtTierState() {
  const tiers = _qtTiers();
  const n = tiers.length;
  const totals = Array(Math.max(n, 1)).fill(0);
  for (const l of _qt.lines) {
    const p = _qtLineProduct(l);
    if (!p) continue;
    for (let i = 0; i < Math.max(n, 1); i++) totals[i] += (_qtTierPrice(p, i) || 0) * l.qty;
  }
  let index = 0;
  while (index < n - 1 && tiers[index + 1].threshold != null && totals[index + 1] >= Number(tiers[index + 1].threshold)) index++;
  const next = index < n - 1 && tiers[index + 1].threshold != null ? tiers[index + 1] : null;
  return { index, tier: tiers[index] || null, next, nextTotal: next ? totals[index + 1] : 0 };
}

function _qtCost(usd) {
  const c = _qt.cfg;
  return (usd + c.envio) * (1 + c.aduana / 100) * c.tc;
}

function _qtSuggested(cost) {
  const step = _qt.cfg.redondeo > 0 ? _qt.cfg.redondeo : 1;
  return Math.ceil((cost * (1 + _qt.cfg.margen / 100)) / step - 1e-9) * step;
}

function _qtLineProduct(l) { return _qt.byId.get(l.id) || l.snap || null; }

function _qtLineCalc(l, tierIndex) {
  const p = _qtLineProduct(l);
  const usd = _qtTierPrice(p, tierIndex) || 0;
  const cost = _qtCost(usd);
  const sale = l.price != null ? l.price : _qtSuggested(cost);
  // En un set el costo incluye cremas y minis: el costo por ml no sirve
  const decantable = p.ml > 0 && !p.isSet;
  return { p, usd, cost, sale, gain: sale - cost, perMl: decantable ? cost / p.ml : 0, decantable };
}

// ── "En tu tienda": el mismo perfume ya publicado en MICHT ───────────────────

// "The Most Wanted (Parfum)" de MICHT y "The Most Wanted Parfum 3.4 Oz" de Zimaxx dan la misma llave
function _qtShopKey(name) {
  return _qtNorm(name).replace(/\s+(eau de parfum|edp|edt|parfum)$/, '');
}

const QT_BRAND_ALIAS = { 'dior': 'christian dior', 'montblanc': 'mont blanc', 'ysl': 'yves saint laurent' };
function _qtBrandOk(a, b) {
  a = _qtNorm(a); b = _qtNorm(b);
  a = QT_BRAND_ALIAS[a] || a; b = QT_BRAND_ALIAS[b] || b;
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
}

// Si el nombre en MICHT dice la concentración ("Invictus Parfum"), tiene que ser la misma
// que la de Zimaxx: "Invictus 3.4 Oz Edt" es otro perfume.
const QT_TAIL_CONC = { edp: 'EDP', edt: 'EDT', parfum: 'Parfum' };
function _qtTailConc(name) {
  const m = _qtNorm(name).match(/\b(edp|edt|parfum)$/);
  return m ? QT_TAIL_CONC[m[1]] : '';
}

function _qtShopMatches(p) {
  if (!_qt.shop || !p.key) return [];
  return (_qt.shop.get(p.key) || []).filter(s => {
    const sc = _qtTailConc(s.name);
    return _qtBrandOk(s.brand, p.category) && !(sc && p.conc && sc !== p.conc);
  });
}

function _qtShopLabel(p) {
  const parts = _qtShopMatches(p).flatMap(s => {
    const sizes = Object.entries(s.sizes || {}).filter(([, v]) => Number(v) > 0);
    if (s.type === 'entero') return sizes.length ? [`Entero ${_qtPen(Number(sizes[0][1]))}`] : [];
    const out = [];
    if (sizes.length) {
      const [size, price] = sizes.sort((x, y) => parseFloat(y[0]) - parseFloat(x[0]))[0];
      out.push(`${size} ${_qtPen(Number(price))}`);
    }
    if (s.availableAsEntero && Number(s.enteroPrice) > 0) out.push(`Entero ${_qtPen(Number(s.enteroPrice))}`);
    return out;
  });
  return parts.length ? `En tu tienda: ${[...new Set(parts)].join(' · ')}` : '';
}

async function _qtLoadShop() {
  if (_qt.shop) return;
  _qt.shop = new Map();   // se marca antes de cargar para no pedirlo dos veces
  try {
    const list = await withTimeout(CloudProducts.getAll(), 12000, 'tus perfumes');
    const map = new Map();
    for (const s of list || []) {
      const key = _qtShopKey(s.name);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    _qt.shop = map;
    _qtRenderResults();
    _qtRenderLines();
  } catch (e) {
    console.warn('[Cotizador] No se pudieron leer los perfumes de la tienda:', e);
  }
}

// ── Carga de la lista de Zimaxx ───────────────────────────────────────────────

function _qtTokenFrom(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  try {
    const u = new URL(t);
    return (u.searchParams.get('c') || '').trim();
  } catch (e) { /* no es un link: puede ser el código suelto */ }
  return /^[A-Za-z0-9_-]{6,80}$/.test(t) ? t : '';
}

async function _qtFetchCatalog(token) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(QT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: QT_API_KEY },
      body: JSON.stringify({ p_token: token }),
      signal: ctrl.signal,
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) throw new Error(`Zimaxx respondió ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.products)) throw Object.assign(new Error('link'), { badLink: true });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function _qtSetCatalog(data, loadedAt) {
  _qt.client = data.client || null;
  _qt.products = (data.products || []).filter(p => p && p.id && p.price != null).map(_qtPrepare);
  _qt.byId = new Map(_qt.products.map(p => [p.id, p]));
  _qt.loadedAt = loadedAt;
  // Las líneas guardadas toman el precio de hoy (la copia queda por si el perfume sale de la lista)
  _qt.lines.forEach(l => { const p = _qt.byId.get(l.id); if (p) l.snap = _qtSnap(p); });
  _qtSaveLines();
}

// Solo los datos que vienen de Zimaxx (lo demás se recalcula al leer)
function _qtRaw(p) {
  const { id, upc, name, price, tier_prices, category, image_url, product_line, availability } = p;
  return { id, upc, name, price, tier_prices, category, image_url, product_line, availability };
}
const _qtSnap = p => _qtPrepare(_qtRaw(p));

async function _qtRefresh() {
  if (!_qt.token || _qt.loading) return;
  _qt.loading = true;
  _qt.error = '';
  _qtRenderSource();
  try {
    const data = await _qtFetchCatalog(_qt.token);
    const now = Date.now();
    _qtSetCatalog(data, now);
    _qtWrite(QT_STORE.cache, { token: _qt.token, at: now, data });
  } catch (e) {
    if (!e.badLink) console.error('[Cotizador]', e);
    _qt.error = e.badLink
      ? 'Ese link no abrió ninguna lista. Copia el link completo que te pasó Zimaxx (el que termina en ?c=…).'
      : e.name === 'AbortError'
        ? 'Zimaxx tardó demasiado en responder. Revisa tu internet y vuelve a intentar.'
        : 'No se pudo leer la lista de Zimaxx. Vuelve a intentar en un momento.';
  } finally {
    _qt.loading = false;
    _qtRenderAll();
  }
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

async function renderCotizador() {
  const root = document.getElementById('qtRoot');
  if (!root) return;
  if (!_qt.ready) _qtInit(root);
  _qtRenderAll();
  _qtLoadShop();
  if (_qt.token && (!_qt.products.length || Date.now() - _qt.loadedAt > QT_STALE_MS)) await _qtRefresh();
}

function _qtInit(root) {
  _qt.ready = true;
  _qt.cfg = { ...QT_DEFAULTS, ..._qtRead(QT_STORE.cfg, {}) };
  _qt.token = _qtTokenFrom(_qtRead(QT_STORE.link, ''));
  _qt.lines = (_qtRead(QT_STORE.lines, []) || [])
    .filter(l => l && l.id && l.snap)
    .map(l => ({ id: l.id, qty: Math.max(1, parseInt(l.qty, 10) || 1), price: l.price == null ? null : Number(l.price), snap: _qtPrepare(l.snap) }));
  const cache = _qtRead(QT_STORE.cache, null);
  if (cache && cache.token === _qt.token && cache.data) _qtSetCatalog(cache.data, cache.at || 0);

  root.innerHTML = `
    <div id="qtSource"></div>
    <div id="qtWork">
      <details class="qt-cfg" id="qtCfg">
        <summary>Cómo se calcula el precio <span id="qtCfgSummary"></span></summary>
        <div class="qt-cfg-grid">
          <label class="qt-field"><span>Tipo de cambio (S/ por US$)</span>
            <input type="number" data-cfg="tc" min="1" max="10" step="0.01" inputmode="decimal"></label>
          <label class="qt-field"><span>Envío a Perú por frasco (US$)</span>
            <input type="number" data-cfg="envio" min="0" max="500" step="0.5" inputmode="decimal"></label>
          <label class="qt-field"><span>Aduana e impuestos (%)</span>
            <input type="number" data-cfg="aduana" min="0" max="100" step="1" inputmode="decimal"></label>
          <label class="qt-field"><span>Tu margen (%)</span>
            <input type="number" data-cfg="margen" min="0" max="500" step="5" inputmode="decimal"></label>
          <label class="qt-field"><span>Redondear la venta a</span>
            <select data-cfg="redondeo">
              <option value="1">S/ 1</option><option value="5">S/ 5</option><option value="10">S/ 10</option>
            </select></label>
        </div>
        <p class="qt-help">Costo = (precio en US$ + envío) + aduana, pasado a soles. Venta = costo + tu margen, redondeado hacia arriba. Pon el tipo de cambio del día; estos datos se guardan en este navegador.</p>
      </details>

      <div class="qt-layout">
        <section class="qt-browser" aria-label="Lista de Zimaxx">
          <div class="qt-filters">
            <input type="search" id="qtSearch" placeholder="Buscar perfume, marca o código…" autocomplete="off">
            <select id="qtLine" aria-label="Línea"></select>
            <select id="qtBrand" aria-label="Marca"></select>
            <button type="button" id="qtFlash" class="qt-chip" aria-pressed="false">🔥 Flash Sale</button>
          </div>
          <div id="qtResults" class="qt-results"></div>
        </section>

        <aside class="qt-quote" id="qtQuote" aria-label="Cotización">
          <div class="qt-quote-head">
            <h3>Cotización</h3>
            <span id="qtCount"></span>
          </div>
          <div id="qtLines" class="qt-lines"></div>
          <div id="qtTotals" class="qt-totals"></div>
          <div class="qt-customer">
            <label class="qt-field"><span>Nombre del cliente (opcional)</span>
              <input type="text" id="qtCustName" maxlength="60" autocomplete="off"></label>
            <label class="qt-field"><span>WhatsApp del cliente (opcional)</span>
              <input type="tel" id="qtCustPhone" maxlength="20" placeholder="Ej: 987654321" autocomplete="off"></label>
            <label class="qt-field"><span>Nota al final del mensaje</span>
              <textarea id="qtNote" rows="2" maxlength="300"></textarea></label>
          </div>
          <div class="qt-actions">
            <button type="button" class="btn-save qt-btn-wa" id="qtSendWa">Enviar por WhatsApp</button>
            <button type="button" class="qt-btn" id="qtCopy">Copiar mensaje</button>
            <button type="button" class="qt-btn qt-btn-ghost" id="qtClear">Vaciar</button>
          </div>
        </aside>
      </div>
      <button type="button" id="qtJump" class="qt-jump" hidden></button>
    </div>`;

  // Ajustes (en celular empiezan plegados para que la lista quede a la vista)
  root.querySelector('#qtCfg').open = window.matchMedia('(min-width: 900px)').matches;
  _qtRenderCfgSummary();
  root.querySelectorAll('[data-cfg]').forEach(el => {
    el.value = _qt.cfg[el.dataset.cfg];
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      if (isNaN(v) || v < 0 || (el.dataset.cfg === 'tc' && v <= 0)) return;
      _qt.cfg[el.dataset.cfg] = v;
      _qtWrite(QT_STORE.cfg, _qt.cfg);
      _qtRenderCfgSummary();
      _qtRenderResults();
      _qtRenderLines();
    });
  });

  // Filtros
  const search = root.querySelector('#qtSearch');
  search.addEventListener('input', () => { _qt.search = search.value; _qt.limit = QT_PAGE; _qtRenderResults(); });
  root.querySelector('#qtLine').addEventListener('change', e => {
    _qt.line = e.target.value;
    _qt.limit = QT_PAGE;
    if (_qt.brand && !_qt.products.some(p => p.category === _qt.brand && (!_qt.line || p.product_line === _qt.line))) _qt.brand = '';
    _qtRenderFilters();
    _qtRenderResults();
  });
  root.querySelector('#qtBrand').addEventListener('change', e => { _qt.brand = e.target.value; _qt.limit = QT_PAGE; _qtRenderResults(); });
  root.querySelector('#qtFlash').addEventListener('click', e => {
    _qt.flash = !_qt.flash;
    e.currentTarget.setAttribute('aria-pressed', String(_qt.flash));
    _qt.limit = QT_PAGE;
    _qtRenderResults();
  });

  // Resultados: agregar y "ver más"
  root.querySelector('#qtResults').addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) { _qtAdd(add.dataset.add); return; }
    if (e.target.closest('#qtMore')) { _qt.limit += QT_PAGE; _qtRenderResults(); }
  });

  // Líneas de la cotización
  const lines = root.querySelector('#qtLines');
  lines.addEventListener('click', e => {
    const row = e.target.closest('[data-line]');
    if (!row) return;
    const l = _qt.lines.find(x => x.id === row.dataset.line);
    if (!l) return;
    const qty = e.target.closest('[data-qty]');
    if (qty) {
      l.qty = Math.max(1, Math.min(99, l.qty + Number(qty.dataset.qty)));
      _qtSaveLines(); _qtRenderLines(); _qtRenderResults();
    } else if (e.target.closest('[data-remove]')) {
      _qt.lines = _qt.lines.filter(x => x !== l);
      _qtSaveLines(); _qtRenderLines(); _qtRenderResults();
    } else if (e.target.closest('[data-reset]')) {
      l.price = null;
      _qtSaveLines(); _qtRenderLines();
    } else if (e.target.closest('[data-decants]')) {
      const c = _qtLineCalc(l, _qtTierState().index);
      _qtOpenDecants(c.cost, c.p.ml);
    }
  });
  lines.addEventListener('input', e => {
    if (!e.target.matches('[data-price]')) return;
    const row = e.target.closest('[data-line]');
    const l = _qt.lines.find(x => x.id === row?.dataset.line);
    const v = parseFloat(e.target.value);
    if (!l || isNaN(v) || v < 0) return;
    l.price = v;
    _qtSaveLines();
    // Solo se actualiza el texto de ganancia y los totales: re-dibujar la línea le quitaría el foco al campo
    _qtUpdateGain(row, l);
    _qtRenderTotals();
  });
  lines.addEventListener('change', e => { if (e.target.matches('[data-price]')) _qtRenderLines(); });

  // Cliente y mensaje
  const name = root.querySelector('#qtCustName');
  const phone = root.querySelector('#qtCustPhone');
  const note = root.querySelector('#qtNote');
  note.value = _qt.cfg.nota;
  name.addEventListener('input', () => { _qt.customer.name = name.value; });
  phone.addEventListener('input', () => { _qt.customer.phone = phone.value; });
  note.addEventListener('input', () => { _qt.cfg.nota = note.value; _qtWrite(QT_STORE.cfg, _qt.cfg); });

  root.querySelector('#qtSendWa').addEventListener('click', _qtSendWhatsApp);
  root.querySelector('#qtCopy').addEventListener('click', _qtCopyMessage);
  root.querySelector('#qtClear').addEventListener('click', () => {
    if (!_qt.lines.length) return;
    showConfirmModal('¿Vaciar la cotización? Se quitan todos los perfumes.', () => {
      _qt.lines = [];
      _qt.customer = { name: '', phone: '' };
      name.value = ''; phone.value = '';
      _qtSaveLines(); _qtRenderLines(); _qtRenderResults();
    });
  });
  root.querySelector('#qtJump').addEventListener('click', () => {
    document.getElementById('qtQuote')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Barra del link (conectar / actualizar / cambiar)
  root.querySelector('#qtSource').addEventListener('click', e => {
    if (e.target.closest('#qtConnect')) _qtConnect();
    else if (e.target.closest('#qtReload')) _qtRefresh();
    else if (e.target.closest('#qtChangeLink')) {
      showConfirmModal('¿Cambiar el link de Zimaxx? Tendrás que pegar el nuevo link.', () => {
        _qt.token = '';
        _qt.client = null; _qt.products = []; _qt.byId = new Map(); _qt.error = '';
        _qtWrite(QT_STORE.link, null);
        _qtWrite(QT_STORE.cache, null);
        _qtRenderAll();
      });
    }
  });
  root.querySelector('#qtSource').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'qtLinkInput') _qtConnect();
  });
}

function _qtRenderCfgSummary() {
  const el = document.getElementById('qtCfgSummary');
  const c = _qt.cfg;
  if (el) el.textContent = `· dólar S/ ${c.tc} · envío US$ ${c.envio} · aduana ${c.aduana}% · margen ${c.margen}%`;
}

function _qtConnect() {
  const input = document.getElementById('qtLinkInput');
  const token = _qtTokenFrom(input?.value);
  if (!token) { showToast('Pega el link completo de tu lista de Zimaxx.'); return; }
  _qt.token = token;
  _qtWrite(QT_STORE.link, input.value.trim());
  _qtRefresh();
}

function _qtSaveLines() {
  _qtWrite(QT_STORE.lines, _qt.lines.map(({ id, qty, price, snap }) => ({ id, qty, price, snap: _qtRaw(snap) })));
}

function _qtAdd(id) {
  const p = _qt.byId.get(id);
  if (!p) return;
  const l = _qt.lines.find(x => x.id === id);
  if (l) l.qty = Math.min(99, l.qty + 1);
  else _qt.lines.push({ id, qty: 1, price: null, snap: _qtSnap(p) });
  _qtSaveLines();
  _qtRenderLines();
  _qtRenderResults();
  showToast(`Agregado: ${p.display}`, 1600);
}

function _qtRenderAll() {
  _qtRenderSource();
  const work = document.getElementById('qtWork');
  if (work) work.hidden = !_qt.token || (!_qt.products.length && !_qt.lines.length);
  _qtRenderFilters();
  _qtRenderResults();
  _qtRenderLines();
}

function _qtRenderSource() {
  const el = document.getElementById('qtSource');
  if (!el) return;

  if (!_qt.token) {
    el.innerHTML = `
      <div class="qt-connect">
        <h3>Conecta tu lista de Zimaxx</h3>
        <p>Pega el link personal de tu catálogo de Zimaxx (el que termina en <code>?c=…</code>). Así el cotizador lee tus precios de mayorista de hoy. El link se guarda solo en este navegador.</p>
        <div class="qt-connect-row">
          <input type="url" id="qtLinkInput" placeholder="https://catalogozimaxx.netlify.app/?c=…" autocomplete="off">
          <button type="button" class="btn-save" id="qtConnect">Conectar</button>
        </div>
      </div>`;
    return;
  }

  const c = _qt.client;
  const when = _qt.loadedAt
    ? new Date(_qt.loadedAt).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';
  const status = _qt.loading
    ? '<span class="qt-source-status">Cargando precios de Zimaxx…</span>'
    : when ? `<span class="qt-source-status">Precios del ${sanitize(when)}</span>` : '';
  el.innerHTML = `
    <div class="qt-source">
      <div class="qt-source-info">
        <strong>Lista Zimaxx${c?.name ? `: ${sanitize(c.name)}` : ''}</strong>
        <span>${_qt.products.length ? `${_qt.products.length} perfumes` : ''}${c?.vendedora ? ` · Vendedora: ${sanitize(c.vendedora)}` : ''}</span>
        ${status}
      </div>
      <div class="qt-source-actions">
        <button type="button" class="qt-btn" id="qtReload" ${_qt.loading ? 'disabled' : ''}>↻ Actualizar precios</button>
        <button type="button" class="qt-btn qt-btn-ghost" id="qtChangeLink">Cambiar link</button>
      </div>
    </div>
    ${_qt.error ? `<div class="qt-error" role="alert">${sanitize(_qt.error)}</div>` : ''}`;
}

function _qtRenderFilters() {
  const lineSel = document.getElementById('qtLine');
  const brandSel = document.getElementById('qtBrand');
  if (!lineSel || !brandSel) return;

  const lines = [...new Set(_qt.products.map(p => p.product_line).filter(Boolean))].sort();
  lineSel.innerHTML = `<option value="">Todas las líneas</option>` +
    lines.map(l => `<option value="${escapeAttr(l)}">${sanitize(QT_LINES[l] || l)}</option>`).join('');
  lineSel.value = _qt.line;

  const counts = new Map();
  _qt.products.forEach(p => {
    if (p.category && (!_qt.line || p.product_line === _qt.line)) counts.set(p.category, (counts.get(p.category) || 0) + 1);
  });
  brandSel.innerHTML = `<option value="">Todas las marcas</option>` +
    [...counts].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([b, n]) => `<option value="${escapeAttr(b)}">${sanitize(b)} (${n})</option>`).join('');
  brandSel.value = _qt.brand;

  const flash = document.getElementById('qtFlash');
  if (flash) flash.hidden = !_qt.products.some(p => p.availability === 'flash');
}

function _qtFiltered() {
  const q = _qtNorm(_qt.search);
  const words = q.split(' ').filter(Boolean);
  const list = _qt.products.filter(p =>
    (!_qt.line || p.product_line === _qt.line) &&
    (!_qt.brand || p.category === _qt.brand) &&
    (!_qt.flash || p.availability === 'flash') &&
    words.every(w => p.searchKey.includes(w)));
  if (!q) return list;
  // Al buscar "yara": primero los que empiezan así, y los sets al final
  const rank = p => (_qtNorm(p.base).startsWith(q) ? 0 : 1) + (p.isSet ? 2 : 0);
  return list.map((p, i) => [rank(p), i, p]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
}

function _qtImg(p, cls) {
  const src = /^https:\/\//i.test(p.image_url || '') ? p.image_url : '';
  return src
    ? `<img class="${cls}" src="${escapeAttr(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">`
    : `<span class="${cls}"></span>`;
}

function _qtRenderResults() {
  const el = document.getElementById('qtResults');
  if (!el) return;
  if (!_qt.products.length) {
    el.innerHTML = `<p class="qt-empty">${_qt.loading ? 'Cargando la lista…' : 'Todavía no hay precios cargados.'}</p>`;
    return;
  }
  const list = _qtFiltered();
  if (!list.length) {
    el.innerHTML = '<p class="qt-empty">No hay perfumes con esa búsqueda.</p>';
    return;
  }
  const tier = _qtTierState().index;
  const inQuote = new Map(_qt.lines.map(l => [l.id, l.qty]));
  el.innerHTML = `
    <p class="qt-results-count">${list.length} perfume${list.length !== 1 ? 's' : ''}</p>
    ${list.slice(0, _qt.limit).map(p => {
      const usd = _qtTierPrice(p, tier) || 0;
      const cost = _qtCost(usd);
      const shop = _qtShopLabel(p);
      const qty = inQuote.get(p.id);
      return `
      <div class="qt-item">
        ${_qtImg(p, 'qt-thumb')}
        <div class="qt-item-info">
          <div class="qt-item-name">${sanitize(p.isSet ? p.name : p.base)}</div>
          <div class="qt-item-meta">${sanitize(p.category)}${p.isSet ? '' : ` · ${sanitize([p.conc, p.ml ? p.ml + ' ml' : ''].filter(Boolean).join(' '))}`}${p.gender ? ` · ${p.gender}` : ''}</div>
          <div class="qt-item-tags">
            ${p.availability === 'flash' ? '<span class="qt-tag qt-tag-flash">🔥 Flash</span>' : ''}
            ${shop ? `<span class="qt-tag qt-tag-shop" title="Así lo vendes hoy en MICHT">${sanitize(shop)}</span>` : ''}
          </div>
        </div>
        <div class="qt-item-prices">
          <div class="qt-item-usd">${_qtUsdTxt(usd)}</div>
          <div class="qt-item-cost">Costo ${_qtPen(Math.round(cost * 100) / 100)}</div>
          <div class="qt-item-sale">${_qtPen(_qtSuggested(cost))}</div>
        </div>
        <button type="button" class="qt-add${qty ? ' is-in' : ''}" data-add="${escapeAttr(p.id)}"
                aria-label="${qty ? `Agregar otro (${qty} en la cotización)` : 'Agregar a la cotización'}">${qty ? `✓ ${qty}` : '+'}</button>
      </div>`;
    }).join('')}
    ${list.length > _qt.limit ? `<button type="button" class="qt-btn qt-more" id="qtMore">Ver más (${list.length - _qt.limit})</button>` : ''}`;
}

function _qtGainText(c) {
  const pct = c.cost > 0 ? Math.round(c.gain / c.cost * 100) : 0;
  return `${c.gain >= 0 ? 'Ganas' : 'Pierdes'} ${_qtPen(Math.round(Math.abs(c.gain) * 100) / 100)} c/u (${pct}%)`;
}

function _qtUpdateGain(row, l) {
  const c = _qtLineCalc(l, _qtTierState().index);
  const g = row.querySelector('.qt-gain');
  if (!g) return;
  g.textContent = _qtGainText(c);
  g.classList.toggle('is-loss', c.gain < 0);
}

function _qtRenderLines() {
  const el = document.getElementById('qtLines');
  if (!el) return;
  const count = _qt.lines.reduce((s, l) => s + l.qty, 0);
  const countEl = document.getElementById('qtCount');
  if (countEl) countEl.textContent = count ? `${count} frasco${count !== 1 ? 's' : ''}` : '';

  if (!_qt.lines.length) {
    el.innerHTML = '<p class="qt-empty">Agrega perfumes con el botón <strong>+</strong> de la lista.</p>';
  } else {
    const tier = _qtTierState().index;
    el.innerHTML = _qt.lines.map(l => {
      const c = _qtLineCalc(l, tier);
      const p = c.p;
      const missing = _qt.products.length && !_qt.byId.has(l.id);
      const shop = _qtShopLabel(p);
      return `
      <div class="qt-line" data-line="${escapeAttr(l.id)}">
        ${_qtImg(p, 'qt-thumb')}
        <div class="qt-line-body">
          <div class="qt-line-name">${sanitize(p.display)}</div>
          <div class="qt-line-meta">${sanitize(p.category)} · ${_qtUsdTxt(c.usd)} → costo ${_qtPen(Math.round(c.cost * 100) / 100)}${c.perMl ? ` · ${_qtPen(Math.round(c.perMl * 100) / 100)} por ml` : ''}</div>
          ${missing ? '<div class="qt-line-warn">Ya no figura en tu lista de Zimaxx: confirma con la vendedora.</div>' : ''}
          <div class="qt-line-row">
            <div class="qt-qty" role="group" aria-label="Cantidad">
              <button type="button" data-qty="-1" aria-label="Uno menos">−</button>
              <span>${l.qty}</span>
              <button type="button" data-qty="1" aria-label="Uno más">+</button>
            </div>
            <label class="qt-price"><span>S/</span>
              <input type="number" data-price min="0" step="1" inputmode="decimal" value="${c.sale}" aria-label="Precio por frasco para el cliente"></label>
            <span class="qt-gain${c.gain < 0 ? ' is-loss' : ''}">${_qtGainText(c)}</span>
          </div>
          <div class="qt-line-links">
            ${l.price != null ? '<button type="button" data-reset>Volver al precio sugerido</button>' : ''}
            ${c.decantable ? '<button type="button" data-decants>Precios en decants</button>' : ''}
            ${shop ? `<span class="qt-tag qt-tag-shop" title="Así lo vendes hoy en MICHT">${sanitize(shop)}</span>` : ''}
          </div>
        </div>
        <button type="button" class="qt-remove" data-remove aria-label="Quitar de la cotización">×</button>
      </div>`;
    }).join('');
  }
  _qtRenderTotals();
}

function _qtTotals() {
  const tier = _qtTierState().index;
  return _qt.lines.reduce((t, l) => {
    const c = _qtLineCalc(l, tier);
    t.sale += c.sale * l.qty;
    t.cost += c.cost * l.qty;
    t.usd += c.usd * l.qty;
    return t;
  }, { sale: 0, cost: 0, usd: 0 });
}

function _qtRenderTotals() {
  const el = document.getElementById('qtTotals');
  if (!el) return;
  const jump = document.getElementById('qtJump');
  if (!_qt.lines.length) {
    el.innerHTML = '';
    if (jump) jump.hidden = true;
    return;
  }
  const t = _qtTotals();
  const gain = t.sale - t.cost;
  const pct = t.cost > 0 ? Math.round(gain / t.cost * 100) : 0;
  const ts = _qtTierState();
  const min = Number(_qt.client?.min_order) || 0;
  const missing = Math.max(0, min - t.usd);

  el.innerHTML = `
    <div class="qt-total-main"><span>Total para el cliente</span><strong>${_qtPen(t.sale)}</strong></div>
    <div class="qt-total-row"><span>Tu costo puesto en Perú</span><span>${_qtPen(Math.round(t.cost * 100) / 100)}</span></div>
    <div class="qt-total-row"><span>Tu ganancia</span><span class="${gain < 0 ? 'qt-neg' : 'qt-pos'}">${_qtPen(Math.round(gain * 100) / 100)} (${pct}%)</span></div>
    <div class="qt-total-row"><span>Compra a Zimaxx</span><span>${_qtUsdTxt(t.usd)}</span></div>
    ${min ? `
    <div class="qt-min">
      <div class="qt-min-bar"><span style="width:${Math.min(100, t.usd / min * 100).toFixed(1)}%"></span></div>
      <p>${missing > 0
        ? `Pedido mínimo de tu lista: ${_qtUsdTxt(min)}. Te faltan ${_qtUsdTxt(missing)} (puedes juntar varias cotizaciones en una compra).`
        : `Llegas al pedido mínimo de tu lista (${_qtUsdTxt(min)}).`}</p>
    </div>` : ''}
    ${ts.index > 0 && ts.tier ? `<p class="qt-tier">Precios ${sanitize(ts.tier.label || '')} activos por el tamaño del pedido.</p>` : ''}
    ${ts.next ? `<p class="qt-tier">Con ${_qtUsdTxt(Number(ts.next.threshold))} de compra se activan los precios ${sanitize(ts.next.label || '')}.</p>` : ''}`;

  if (jump) {
    jump.hidden = false;
    jump.textContent = `Ver cotización · ${_qtPen(t.sale)}`;
  }
}

// ── Mensaje para el cliente ───────────────────────────────────────────────────

function _qtMessage() {
  const tier = _qtTierState().index;
  const name = _qt.customer.name.trim();
  const rows = _qt.lines.map(l => {
    const c = _qtLineCalc(l, tier);
    const brand = c.p.category ? ` (${c.p.category})` : '';
    return l.qty > 1
      ? `• ${c.p.display}${brand} x${l.qty}: ${_qtPen(c.sale * l.qty)} (${_qtPen(c.sale)} c/u)`
      : `• ${c.p.display}${brand}: ${_qtPen(c.sale)}`;
  });
  const total = _qtTotals().sale;
  const note = (_qt.cfg.nota || '').trim();
  return [
    `Hola${name ? ' ' + name : ''} 👋`,
    'Te paso tu cotización de *MICHT Perfumes*:',
    '',
    ...rows,
    '',
    `*Total: ${_qtPen(total)}*`,
    ...(note ? ['', note] : []),
  ].join('\n');
}

function _qtWaPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 9 && d.startsWith('9')) return '51' + d;   // celular peruano sin el 51
  return d.length >= 10 ? d : null;
}

function _qtSendWhatsApp() {
  if (!_qt.lines.length) { showToast('Agrega al menos un perfume a la cotización.'); return; }
  const phone = _qtWaPhone(_qt.customer.phone);
  if (phone === null) { showToast('Revisa el WhatsApp del cliente (9 dígitos, ej. 987654321).'); return; }
  const text = encodeURIComponent(_qtMessage());
  window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, '_blank', 'noopener');
}

async function _qtCopyMessage() {
  if (!_qt.lines.length) { showToast('Agrega al menos un perfume a la cotización.'); return; }
  const text = _qtMessage();
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* sin portapapeles */ }
    ta.remove();
  }
  showToast('Mensaje copiado ✓ Pégalo en WhatsApp.');
}

// ── Decants: abre la calculadora de Herramientas con el costo del frasco ──────

function _qtOpenDecants(cost, ml) {
  document.querySelector('.admin-nav-btn[data-section="tools"]')?.click();
  const price = document.getElementById('calcBottlePrice');
  const mlInput = document.getElementById('calcBottleMl');
  if (!price || !mlInput) return;
  price.value = cost.toFixed(2);
  mlInput.value = ml;
  price.dispatchEvent(new Event('input', { bubbles: true }));
  price.closest('.tool-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
