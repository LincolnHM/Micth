// ═══════════════════════════════════════════════════════════════════════════════
// ─── COTIZADOR (proveedor Zimaxx) ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Fórmula:  (precio US$ + cargo 1 + cargo 2) × tipo de cambio = costo puesto en Perú
//           costo × (1 + ganancia %) → redondeado hacia arriba = precio de venta
//
// La lista del proveedor vive en Supabase (`cotizador_proveedor`, solo admin).
// Si la tabla aún no existe, se guarda en este navegador (localStorage).
// El tipo de cambio se trae solo una vez al día; si lo corriges a mano, tu valor
// manda durante ese día y al siguiente vuelve el automático.

const QUOTER_TABLE     = 'cotizador_proveedor';
const QUOTER_PROVIDER  = 'zimaxx';
const QUOTER_LOCAL_KEY = 'micht_cotizador_items';
const QUOTER_CFG_KEY   = 'micht_cotizador_cfg';
const QUOTER_FX_KEY    = 'micht_cotizador_tc';
const QUOTER_DEFAULTS  = { cargo1: 2, cargo2: 7, margen: 30, redondeo: 5, tcFallback: 3.44 };

const _quoter = {
  items: [],
  cloud: false,        // true = la lista está en Supabase
  cfg: { ...QUOTER_DEFAULTS },
  fx: null,            // { rate, source, date, manual }
  search: '',
  sort: 'nombre',
  bound: false,
};

function _qEsc(v) { return typeof escapeXml === 'function' ? escapeXml(v ?? '') : String(v ?? ''); }
function _qToday() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); }
function _qNum(v) { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; }
function _qMoney(n) { return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function _qUsd(n) { return 'US$ ' + n.toFixed(2); }
function _qLsGet(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
function _qLsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

// ── Cálculo ──────────────────────────────────────────────────────────────────

function quoterRate() {
  return _quoter.fx?.rate || QUOTER_DEFAULTS.tcFallback;
}

function quoterCalc(usd) {
  const { cargo1, cargo2, margen, redondeo } = _quoter.cfg;
  const costoUsd = usd + cargo1 + cargo2;
  const costo    = costoUsd * quoterRate();
  const bruto    = costo * (1 + margen / 100);
  const venta    = redondeo > 0 ? Math.ceil(bruto / redondeo - 1e-9) * redondeo : bruto;
  return { costoUsd, costo, venta, ganancia: venta - costo };
}

// ── Tipo de cambio del día ───────────────────────────────────────────────────

async function _qFetchRate() {
  // 1) open.er-api.com (gratis, sin clave)  2) respaldo en jsDelivr
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
    const j = await r.json();
    if (j.result === 'success' && j.rates?.PEN) return { rate: +j.rates.PEN.toFixed(3), source: 'ExchangeRate-API' };
  } catch (e) {}
  try {
    const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', { cache: 'no-store' });
    const j = await r.json();
    if (j.usd?.pen) return { rate: +j.usd.pen.toFixed(3), source: 'Currency API' };
  } catch (e) {}
  return null;
}

async function quoterLoadRate(force = false) {
  const today = _qToday();
  const saved = _qLsGet(QUOTER_FX_KEY) || {};

  // Corrección manual de hoy: manda sobre el automático
  if (!force && saved.manual && saved.manual.date === today) {
    _quoter.fx = { ...saved.manual, manual: true };
    return;
  }
  if (!force && saved.auto && saved.auto.date === today) {
    _quoter.fx = { ...saved.auto, manual: false };
    return;
  }
  const got = await _qFetchRate();
  if (got) {
    saved.auto = { ...got, date: today };
    if (force) delete saved.manual;
    _qLsSet(QUOTER_FX_KEY, saved);
    _quoter.fx = { ...saved.auto, manual: false };
  } else {
    // Sin internet o servicio caído: último conocido, o 3.44
    const last = saved.auto || { rate: QUOTER_DEFAULTS.tcFallback, source: 'valor por defecto', date: null };
    _quoter.fx = { ...last, manual: false, stale: true };
  }
}

function quoterSetManualRate(rate) {
  const saved = _qLsGet(QUOTER_FX_KEY) || {};
  saved.manual = { rate, source: 'corregido a mano', date: _qToday() };
  _qLsSet(QUOTER_FX_KEY, saved);
  _quoter.fx = { ...saved.manual, manual: true };
}

// ── Datos: Supabase con respaldo local ───────────────────────────────────────

function _qIsMissingTable(error) {
  const msg = (error?.message || '') + (error?.code || '');
  return /42P01|PGRST205|does not exist|schema cache/i.test(msg);
}

async function quoterLoadItems() {
  if (typeof db !== 'undefined' && db) {
    const { data, error } = await db.from(QUOTER_TABLE)
      .select('*').eq('proveedor', QUOTER_PROVIDER).order('nombre');
    if (!error) {
      _quoter.cloud = true;
      _quoter.items = data.map(r => ({ ...r, precio_usd: +r.precio_usd }));
      return;
    }
    if (!_qIsMissingTable(error)) console.warn('Cotizador:', error.message);
  }
  _quoter.cloud = false;
  _quoter.items = _qLsGet(QUOTER_LOCAL_KEY) || [];
}

function _qSaveLocal() { _qLsSet(QUOTER_LOCAL_KEY, _quoter.items); }

async function quoterImport(rows, replace) {
  const now = new Date().toISOString();
  const clean = rows.map(r => ({
    proveedor: QUOTER_PROVIDER,
    nombre: r.nombre.trim().slice(0, 200),
    marca: r.marca ? String(r.marca).trim().slice(0, 100) : null,
    presentacion: r.presentacion ? String(r.presentacion).trim().slice(0, 40) : null,
    precio_usd: Math.round(r.precio_usd * 100) / 100,
    imagen: r.imagen || null,
    actualizado: now,
  }));

  if (_quoter.cloud) {
    if (replace) {
      const { error } = await db.from(QUOTER_TABLE).delete().eq('proveedor', QUOTER_PROVIDER);
      if (error) throw error;
    }
    for (let i = 0; i < clean.length; i += 500) {
      const { error } = await db.from(QUOTER_TABLE).insert(clean.slice(i, i + 500));
      if (error) throw error;
    }
    await quoterLoadItems();
  } else {
    const withIds = clean.map((r, i) => ({ ...r, id: 'l' + Date.now().toString(36) + i }));
    _quoter.items = replace ? withIds : _quoter.items.concat(withIds);
    _qSaveLocal();
  }
}

async function quoterUpdatePrice(id, precio) {
  const item = _quoter.items.find(i => String(i.id) === String(id));
  if (!item) return;
  item.precio_usd = precio;
  item.actualizado = new Date().toISOString();
  if (_quoter.cloud) {
    const { error } = await db.from(QUOTER_TABLE)
      .update({ precio_usd: precio, actualizado: item.actualizado }).eq('id', item.id);
    if (error) throw error;
  } else {
    _qSaveLocal();
  }
}

async function quoterDelete(id) {
  if (_quoter.cloud) {
    const { error } = await db.from(QUOTER_TABLE).delete().eq('id', id);
    if (error) throw error;
  }
  _quoter.items = _quoter.items.filter(i => String(i.id) !== String(id));
  if (!_quoter.cloud) _qSaveLocal();
}

// ── Lectura de la lista pegada ───────────────────────────────────────────────
// Acepta: JSON [{nombre, precio_usd, marca?, presentacion?}], o una línea por
// perfume con el precio en dólares en cualquier parte:
//   "Club de Nuit Intense Man 105ml - $25.50"   "Asad Lattafa;18"   "Khamrah	$22"

function quoterParse(text) {
  const t = text.trim();
  if (!t) return [];
  if (t.startsWith('[')) {
    try {
      return JSON.parse(t)
        .map(o => ({
          nombre: String(o.nombre ?? o.name ?? ''),
          marca: o.marca ?? o.brand ?? null,
          presentacion: o.presentacion ?? null,
          precio_usd: _qNum(o.precio_usd ?? o.precio ?? o.price),
          imagen: o.imagen ?? null,
        }))
        .filter(o => o.nombre && o.precio_usd >= 0);
    } catch (e) { /* no es JSON válido: se lee como texto */ }
  }
  const out = [];
  t.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line) return;
    // Precio: el que lleva $ o US$; si no hay, el último número de la línea
    let m = line.match(/(?:US\s?\$|\$|USD\s?)\s*(\d+(?:[.,]\d{1,2})?)/i);
    if (!m) m = line.match(/(?:^|[\s;,\t|])(\d+(?:[.,]\d{1,2})?)\s*(?:usd|dólares|dolares)?\s*$/i);
    if (!m) return;
    const precio = _qNum(m[1]);
    let nombre = line.replace(m[0], ' ').replace(/[\s;,\t|\-–:]+$/,'').replace(/^[\s;,\t|\-–:]+/, '').replace(/\s{2,}/g, ' ').trim();
    if (!nombre || !(precio >= 0)) return;
    const ml = nombre.match(/(\d{2,4})\s?ml\b/i);
    out.push({ nombre, precio_usd: precio, presentacion: ml ? ml[1] + ' ml' : null });
  });
  return out;
}

// ── Interfaz ─────────────────────────────────────────────────────────────────

function _qRenderConfig() {
  const fx = _quoter.fx || { rate: QUOTER_DEFAULTS.tcFallback };
  const rateInput = document.getElementById('qRate');
  if (rateInput && document.activeElement !== rateInput) rateInput.value = fx.rate.toFixed(3);

  const badge = document.getElementById('qRateInfo');
  if (badge) {
    let txt;
    if (fx.manual) txt = '✏️ Corregido a mano hoy';
    else if (fx.stale) txt = '⚠️ No se pudo traer el de hoy · usando ' + (fx.date ? 'el del ' + fx.date : '3.44');
    else txt = '🌐 Del día (' + _qEsc(fx.source || '') + ')';
    badge.innerHTML = txt;
    badge.className = 'quoter-rate-info' + (fx.manual ? ' is-manual' : fx.stale ? ' is-stale' : '');
  }
  const { cargo1, cargo2, margen, redondeo } = _quoter.cfg;
  const f = document.getElementById('qFormula');
  if (f) {
    f.innerHTML = `(Precio + <b>$${cargo1}</b> + <b>$${cargo2}</b>) × <b>${quoterRate().toFixed(3)}</b> = costo puesto en Perú
      &nbsp;→&nbsp; + <b>${margen}%</b> de ganancia${redondeo ? `, redondeado a S/ ${redondeo}` : ''} = precio de venta`;
  }
  _qRenderQuick();
}

function _qRenderQuick() {
  const out = document.getElementById('qQuickOut');
  const usd = _qNum(document.getElementById('qQuickUsd')?.value);
  if (!out) return;
  if (!(usd >= 0) || document.getElementById('qQuickUsd').value === '') { out.innerHTML = ''; return; }
  const c = quoterCalc(usd);
  out.innerHTML = `
    <div class="quoter-quick-cell"><span>Puesto en Perú</span><strong>${_qMoney(c.costo)}</strong><small>${_qUsd(c.costoUsd)}</small></div>
    <div class="quoter-quick-cell is-sale"><span>Precio de venta</span><strong>${_qMoney(c.venta)}</strong></div>
    <div class="quoter-quick-cell is-gain"><span>Tu ganancia</span><strong>+${_qMoney(c.ganancia)}</strong></div>`;
}

function _qFiltered() {
  const q = _quoter.search.trim().toLowerCase();
  let list = q
    ? _quoter.items.filter(i => `${i.nombre} ${i.marca || ''} ${i.presentacion || ''}`.toLowerCase().includes(q))
    : _quoter.items.slice();
  const by = {
    nombre:      (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
    precio_asc:  (a, b) => a.precio_usd - b.precio_usd,
    precio_desc: (a, b) => b.precio_usd - a.precio_usd,
  }[_quoter.sort];
  return list.sort(by);
}

// Marca y presentación debajo del nombre, sin repetir lo que el nombre ya dice
function _qSubtitle(i) {
  const name = i.nombre.toLowerCase().replace(/\s+/g, '');
  const parts = [i.marca, i.presentacion].filter(p => p && !name.includes(String(p).toLowerCase().replace(/\s+/g, '')));
  return parts.length ? `<small>${_qEsc(parts.join(' · '))}</small>` : '';
}

function _qRenderList() {
  const box = document.getElementById('qList');
  if (!box) return;

  const storage = document.getElementById('qStorage');
  if (storage) {
    storage.innerHTML = _quoter.cloud
      ? '☁️ Guardado en Supabase (solo tú lo ves)'
      : '💾 Guardado solo en este navegador · corre <code>2026-10-22-cotizador-zimaxx.sql</code> para tenerlo en todos tus equipos';
  }

  if (!_quoter.items.length) {
    document.getElementById('qCount').textContent = '';
    box.innerHTML = `<div class="quoter-empty">
      <p>Aún no hay perfumes del proveedor.</p>
      <p>Toca <b>Importar lista</b> y pega los perfumes con su precio en dólares.</p></div>`;
    return;
  }
  const list = _qFiltered();
  const last = _quoter.items.reduce((m, i) => (i.actualizado > m ? i.actualizado : m), '');
  document.getElementById('qCount').textContent =
    `${list.length} de ${_quoter.items.length} perfumes` + (last ? ` · actualizado ${new Date(last).toLocaleDateString('es-PE')}` : '');

  box.innerHTML = `
    <div class="quoter-row quoter-head" role="row">
      <span>Perfume</span><span>Precio US$</span><span>Puesto en Perú</span><span>Venta</span><span>Ganancia</span><span></span>
    </div>
    ${list.map(i => {
      const c = quoterCalc(i.precio_usd);
      return `<div class="quoter-row" role="row" data-id="${_qEsc(i.id)}">
        <span class="quoter-name">${_qEsc(i.nombre)}${_qSubtitle(i)}</span>
        <span class="quoter-usd" data-label="US$"><input type="number" min="0" step="0.01" value="${i.precio_usd.toFixed(2)}" aria-label="Precio en dólares de ${_qEsc(i.nombre)}"></span>
        <span class="quoter-cost" data-label="Puesto en Perú">${_qMoney(c.costo)}</span>
        <span class="quoter-sale" data-label="Venta">${_qMoney(c.venta)}</span>
        <span class="quoter-gain" data-label="Ganancia">+${_qMoney(c.ganancia)}</span>
        <span><button type="button" class="quoter-del" title="Quitar" aria-label="Quitar ${_qEsc(i.nombre)}">✕</button></span>
      </div>`;
    }).join('')}`;
}

function quoterRender() { _qRenderConfig(); _qRenderList(); }

function _qExportCsv() {
  const rows = [['Perfume', 'Marca', 'Presentación', 'Precio US$', 'Puesto en Perú S/', 'Venta S/', 'Ganancia S/']];
  _qFiltered().forEach(i => {
    const c = quoterCalc(i.precio_usd);
    rows.push([i.nombre, i.marca || '', i.presentacion || '', i.precio_usd.toFixed(2), c.costo.toFixed(2), c.venta.toFixed(2), c.ganancia.toFixed(2)]);
  });
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `cotizacion-zimaxx-${_qToday()}-tc${quoterRate().toFixed(2)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function _qBind() {
  if (_quoter.bound) return;
  _quoter.bound = true;
  const $ = id => document.getElementById(id);

  // Configuración (cargos, ganancia, redondeo): se recuerda en este navegador
  ['qCargo1', 'qCargo2', 'qMargen', 'qRedondeo'].forEach(id => {
    const el = $(id);
    const key = { qCargo1: 'cargo1', qCargo2: 'cargo2', qMargen: 'margen', qRedondeo: 'redondeo' }[id];
    el.value = _quoter.cfg[key];
    el.addEventListener('input', () => {
      const v = _qNum(el.value);
      if (!(v >= 0)) return;
      _quoter.cfg[key] = v;
      _qLsSet(QUOTER_CFG_KEY, _quoter.cfg);
      quoterRender();
    });
  });

  $('qRate').addEventListener('change', () => {
    const v = _qNum($('qRate').value);
    if (!(v > 1 && v < 10)) { showToast('Tipo de cambio no válido.'); _qRenderConfig(); return; }
    quoterSetManualRate(v);
    quoterRender();
    showToast(`Tipo de cambio corregido a ${v.toFixed(3)} para hoy ✓`);
  });
  $('qRateRefresh').addEventListener('click', async () => {
    $('qRateRefresh').disabled = true;
    await quoterLoadRate(true);
    $('qRateRefresh').disabled = false;
    quoterRender();
    showToast(_quoter.fx.stale ? 'No se pudo traer el tipo de cambio.' : `Tipo de cambio del día: ${_quoter.fx.rate.toFixed(3)} ✓`);
  });

  $('qQuickUsd').addEventListener('input', _qRenderQuick);

  $('qSearch').addEventListener('input', e => { _quoter.search = e.target.value; _qRenderList(); });
  $('qSort').addEventListener('change', e => { _quoter.sort = e.target.value; _qRenderList(); });
  $('qExport').addEventListener('click', _qExportCsv);

  // Importar
  const panel = $('qImportPanel');
  $('qImportOpen').addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) $('qImportText').focus(); });
  $('qImportCancel').addEventListener('click', () => { panel.hidden = true; });
  $('qImportText').addEventListener('input', () => {
    const n = quoterParse($('qImportText').value).length;
    $('qImportPreview').textContent = n ? `Se encontraron ${n} perfumes con precio.` : '';
  });
  $('qImportSave').addEventListener('click', async () => {
    const rows = quoterParse($('qImportText').value);
    if (!rows.length) { showToast('No encontré perfumes con precio en dólares.'); return; }
    const replace = $('qImportReplace').checked;
    if (replace && _quoter.items.length && !confirm(`Se reemplazarán los ${_quoter.items.length} perfumes actuales por ${rows.length}. ¿Continuar?`)) return;
    $('qImportSave').disabled = true;
    try {
      await quoterImport(rows, replace);
      $('qImportText').value = '';
      $('qImportPreview').textContent = '';
      panel.hidden = true;
      quoterRender();
      showToast(`${rows.length} perfumes importados ✓`);
    } catch (e) {
      showToast('No se pudo guardar: ' + (e.message || e));
    } finally {
      $('qImportSave').disabled = false;
    }
  });

  // Editar precio / quitar (delegado)
  $('qList').addEventListener('change', async e => {
    if (!e.target.matches('.quoter-usd input')) return;
    const row = e.target.closest('.quoter-row');
    const v = _qNum(e.target.value);
    if (!(v >= 0)) return;
    try { await quoterUpdatePrice(row.dataset.id, v); _qRenderList(); showToast('Precio actualizado ✓'); }
    catch (err) { showToast('No se pudo guardar: ' + (err.message || err)); }
  });
  $('qList').addEventListener('click', async e => {
    const btn = e.target.closest('.quoter-del');
    if (!btn) return;
    const row = btn.closest('.quoter-row');
    const name = row.querySelector('.quoter-name').firstChild.textContent;
    if (!confirm(`¿Quitar "${name}" de la lista?`)) return;
    try { await quoterDelete(row.dataset.id); _qRenderList(); }
    catch (err) { showToast('No se pudo quitar: ' + (err.message || err)); }
  });
}

async function renderQuoterSection() {
  _quoter.cfg = { ...QUOTER_DEFAULTS, ...(_qLsGet(QUOTER_CFG_KEY) || {}) };
  _qBind();
  _qRenderConfig();
  document.getElementById('qList').innerHTML = '<p class="quoter-empty">Cargando…</p>';
  await Promise.all([quoterLoadRate(), quoterLoadItems()]);
  quoterRender();
}
