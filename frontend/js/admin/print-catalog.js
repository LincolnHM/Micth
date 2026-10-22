// ─── Catálogo de decants para imprimir (admin/catalogo/) ─────────────────────
// Arma hojas A4 listas para imprimir con los perfumes de decant del catálogo
// real (los sellados no entran), agrupados por casa: foto, acordes principales,
// nombre y precios por talla. Como las fichas y los títulos miden lo mismo
// siempre (en mm), las hojas se reparten aquí (pcPaginate) y lo que se ve en
// pantalla es exactamente lo que sale impreso.

const PC_PREFS_KEY = 'micht_print_catalog';

// Tipos, en el orden en que se imprimen
const PC_TYPES = [
  { key: 'arabe',     label: 'Árabes',    one: 'Árabe' },
  { key: 'diseñador', label: 'Diseñador', one: 'Diseñador' },
  { key: 'nicho',     label: 'Nicho',     one: 'Nicho' }
];

// Tamaños de ficha: columnas, alto en mm y cuántos acordes entran. Estos altos y
// los de PC_MM deben coincidir con el CSS de admin/catalogo/index.html.
const PC_SIZES = {
  l: { cols: 1, cardH: 74, bars: 10 },
  m: { cols: 2, cardH: 74, bars: 10 },
  s: { cols: 2, cardH: 55, bars: 7 }
};
const PC_MM = { usable: 273, cover: 26, houseHead: 11, rowGap: 4 };

// Líneas que se imprimen como casa aparte (el usuario pidió "los Odyssey juntos").
// Para separar otra línea basta agregarla aquí.
const PC_HOUSE_LINES = [{ brand: 'armaf', line: 'Odyssey' }];

// Colores de los acordes para papel blanco, con texto oscuro encima (los de la
// tienda, accordColor, están pensados para el fondo oscuro del sitio)
const PC_ACCORD_COLORS = {
  'citrico': '#f4f25a', 'afrutados': '#fb6a45', 'afrutado': '#fb6a45', 'frutal': '#fb6a45',
  'dulce': '#f27a7c', 'amaderado': '#b08d66', 'cuero': '#b3978a', 'ahumado': '#b5a8b5',
  'almizclado': '#e9daec', 'fresco especiado': '#b2dc7c', 'fresco': '#b4e9f0', 'tropical': '#fbc670',
  'musgoso': '#a9b592', 'atalcado': '#efe0d8', 'empolvado': '#efe0d8', 'avainillado': '#fff6b8',
  'vainilla': '#fff6b8', 'ambar': '#dc9566', 'calido especiado': '#e88463', 'especiado calido': '#e88463',
  'especiado suave': '#eba99d', 'amielado': '#fdbd52', 'aromatico': '#86c5b3', 'lavanda': '#c3b2e3',
  'tabaco': '#c0b295', 'verde': '#86cb88', 'floral blanco': '#eef2fb', 'floral amarillo': '#ffe97c',
  'florales': '#ff9fbb', 'floral': '#ff9fbb', 'rosas': '#ff86ae', 'rosa': '#ff86ae',
  'acuatico': '#93e2ea', 'marino': '#8cc5e3', 'ozonico': '#bdeef4', 'canela': '#d98f61',
  'caramelo': '#e2b272', 'balsamico': '#c8a987', 'pachuli': '#b09a85', 'iris': '#cdbfe8',
  'herbal': '#a1c9ac', 'herbaceo': '#a1c9ac', 'terrosos': '#a89c8b', 'lactonico': '#f6efe3',
  'violeta': '#c595ec', 'cacao': '#b58868', 'chocolate': '#aa8068', 'cafe': '#a98875',
  'animalico': '#c0915f', 'animal': '#c0915f', 'oud': '#ad8f7c', 'nueces': '#c6aa8e',
  'acerezado': '#e96c7b', 'ron': '#d0935f', 'jabonoso': '#e2f3f7', 'conifero': '#84b594',
  'anis': '#cfe0ec', 'aldehidico': '#dbe6ef', 'coco': '#f2ecdf', 'mineral': '#cdd6da',
  'salado': '#dfecee', 'terpenico': '#cfdf95'
};

const PC = {
  products: [],          // decants del catálogo (sin "próximamente")
  size: 'l',
  soldOut: false,        // incluir agotados
  housePage: false,      // cada casa en hoja nueva
  hidden: new Set()      // casas que NO se imprimen (claves de pcGroups)
};

const pcEsc  = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pcNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const pcByText = (a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });

function pcAccordColor(name) {
  const key = pcNorm(name);
  if (PC_ACCORD_COLORS[key]) return PC_ACCORD_COLORS[key];
  const partial = Object.keys(PC_ACCORD_COLORS).find(k => key.includes(k));
  return partial ? PC_ACCORD_COLORS[partial] : '#ddd6e6';
}

// Casa a la que pertenece un perfume: su marca, salvo las líneas de PC_HOUSE_LINES
function pcHouse(p) {
  const brand = (p.brand || 'Sin marca').trim();
  const b = pcNorm(brand);
  for (const l of PC_HOUSE_LINES) {
    const line = pcNorm(l.line);
    if (b.startsWith(l.brand) && (b.includes(line) || pcNorm(p.name).startsWith(line))) {
      return { name: `${brand.replace(new RegExp(`\\s*${l.line}\\s*`, 'i'), ' ').trim()} ${l.line}`, line: l.line };
    }
  }
  return { name: brand, line: '' };
}

// Nombre en la ficha: dentro de una línea siempre con su nombre delante
// ("Mandarin Sky" de la marca "Armaf Odyssey" → "Odyssey Mandarin Sky")
function pcDisplayName(p) {
  const { line } = pcHouse(p);
  return line && !pcNorm(p.name).startsWith(pcNorm(line)) ? `${line} ${p.name}` : p.name;
}

// Perfumes que entran con las opciones actuales (sin mirar qué casas están elegidas)
function pcVisibleProducts() {
  return PC.products.filter(p => PC.soldOut || isDecantPurchasable(p));
}

// Casas en orden de impresión. Las que tienen un solo perfume van juntas en
// "Otras casas" al final de su tipo, para no gastar un título por cada una.
function pcGroups(products) {
  const groups = [];
  PC_TYPES.forEach(type => {
    const byHouse = new Map();
    products.filter(p => p.type === type.key).forEach(p => {
      const name = pcHouse(p).name;
      if (!byHouse.has(name)) byHouse.set(name, []);
      byHouse.get(name).push(p);
    });
    const houses  = [...byHouse].map(([name, items]) => ({ name, items }));
    const big     = houses.filter(h => h.items.length > 1).sort((a, b) => pcByText(a.name, b.name));
    const singles = houses.filter(h => h.items.length === 1).map(h => h.items[0])
      .sort((a, b) => pcByText(a.brand, b.brand) || pcByText(a.name, b.name));
    big.forEach(h => groups.push({
      key: `${type.key}|${h.name}`, type, name: h.name,
      items: h.items.sort((a, b) => pcByText(pcDisplayName(a), pcDisplayName(b)))
    }));
    if (singles.length) groups.push({
      key: `${type.key}|*`, type, name: big.length ? 'Otras casas' : type.label, others: true, items: singles
    });
  });
  return groups;
}

// ─── Ficha de un perfume ─────────────────────────────────────────────────────
function pcCardHtml(p) {
  const out = !isDecantPurchasable(p);
  const accords = (p.accords || []).slice(0, PC_SIZES[PC.size].bars);
  const maxPct  = Math.max(...accords.map(a => a.pct || 0), 1);
  const bars = accords.length
    ? `<p class="bars-title">acordes principales</p>
       <div class="bars">${accords.map(a =>
         `<div class="bar-acc" style="width:${Math.max(34, Math.round((a.pct || 0) / maxPct * 100))}%;background:${pcAccordColor(a.name)}">${pcEsc(a.name)}</div>`).join('')}</div>`
    : `<p class="bars-title">notas</p>
       <p class="card-notes">${pcEsc([p.topNotes, p.heartNotes, p.baseNotes].filter(Boolean).join(' · '))}</p>`;

  const prices = Object.entries(p.sizes || {})
    .filter(([, price]) => price > 0)
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([ml, price]) => `<li><span>${pcEsc(ml)}</span><b>S/${Number.isInteger(+price) ? +price : (+price).toFixed(2)}</b></li>`).join('');

  const when = [
    p.occasion !== 'noche' ? '☀ Día' : '',
    p.occasion !== 'dia'   ? '☾ Noche' : '',
    { hombre: 'Hombre', mujer: 'Mujer', unisex: 'Unisex' }[p.gender] || ''
  ].filter(Boolean).map(t => `<span>${t}</span>`).join('');

  const photo = (p.imageUrl || '').startsWith('data:image/svg') || !p.imageUrl
    ? `<span>${pcEsc((p.brand || '?').charAt(0))}</span>`
    : `<img src="${pcEsc(p.imageUrl)}" alt="">`;

  return `
    <article class="card${out ? ' is-out' : ''}">
      <div class="card-photo">${photo}</div>
      <div class="card-bars">${bars}</div>
      <div class="card-info">
        <p class="card-brand">${pcEsc(p.brand)}</p>
        <h3 class="card-name">${pcEsc(pcDisplayName(p))}</h3>
        <ul class="card-prices">${prices || '<li><span>Precio</span><b>a consultar</b></li>'}</ul>
        <div class="card-when">${when}</div>
        ${p.dupeOf?.name ? `<p class="card-dupe">Se parece a <b>${pcEsc(p.dupeOf.name)}</b>${p.dupeOf.brand ? ` de ${pcEsc(p.dupeOf.brand)}` : ''}</p>` : ''}
      </div>
      ${out ? '<span class="card-out">Agotado</span>' : ''}
    </article>`;
}

// ─── Repartir en hojas ───────────────────────────────────────────────────────
// Devuelve las hojas como listas de bloques { head, cont } (título de casa) y
// { row } (fila de fichas). Un título nunca queda solo al pie de una hoja, y si
// una casa sigue en la hoja siguiente se repite su título con "(continúa)".
function pcPaginate(groups) {
  const { cols, cardH } = PC_SIZES[PC.size];
  const rowH = cardH + PC_MM.rowGap;
  const pages = [];
  let page, left;
  const newPage = () => {
    page = [];
    left = PC_MM.usable - (pages.length ? 0 : PC_MM.cover);
    pages.push(page);
  };
  newPage();
  groups.forEach((group, gi) => {
    if (PC.housePage && gi > 0 && page.length) newPage();
    for (let i = 0; i < group.items.length; i += cols) {
      const first = i === 0;
      if (rowH + (first ? PC_MM.houseHead : 0) > left) newPage();
      if (first || !page.length) {
        page.push({ head: group, cont: !first });
        left -= PC_MM.houseHead;
      }
      page.push({ row: group.items.slice(i, i + cols) });
      left -= rowH;
    }
  });
  return pages;
}

function pcRender() {
  const sheets  = document.getElementById('pcSheets');
  const all     = pcGroups(pcVisibleProducts());
  const groups  = all.filter(g => !PC.hidden.has(g.key));
  const count   = groups.reduce((n, g) => n + g.items.length, 0);
  const summary = document.getElementById('pcSummary');
  const print   = document.getElementById('pcPrintBtn');
  pcRenderHouses(all);

  if (!count) {
    sheets.innerHTML = `<p class="msg">${PC.products.length
      ? 'No hay perfumes para imprimir con estas opciones. Elige alguna casa o marca "Incluir agotados".'
      : 'Todavía no hay perfumes de decant en el catálogo.'}</p>`;
    summary.textContent = 'Nada que imprimir';
    print.disabled = true;
    return;
  }

  const pages = pcPaginate(groups);
  const date  = new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  const cover = `
    <div class="cover">
      <img src="../../imgGato/gato-removebg-preview.png" alt="">
      <div class="cover-brand">
        <strong>Micht <span>Decants</span></strong>
        <small>Perfumería Árabe &amp; Diseñador</small>
      </div>
      <div class="cover-info">
        <b>Catálogo de decants</b>
        ${pcEsc(date.charAt(0).toUpperCase() + date.slice(1))} · Perfumes 100% originales<br>
        WhatsApp 917 452 643 · michtdecants.com
      </div>
    </div>`;

  sheets.innerHTML = pages.map((blocks, i) => `
    <section class="page size-${PC.size}">
      ${i === 0 ? cover : ''}
      <div class="page-body">
        ${blocks.map(b => b.head
          ? `<div class="house-head">
               <h2>${pcEsc(b.head.name)}</h2>
               ${b.head.others && b.head.name === b.head.type.label ? '' : `<span class="house-type">${pcEsc(b.head.type.one)}</span>`}
               <i></i>
               <span class="house-count">${b.cont ? '(continúa)' : `${b.head.items.length} perfume${b.head.items.length !== 1 ? 's' : ''}`}</span>
             </div>`
          : `<div class="row">${b.row.map(pcCardHtml).join('')}</div>`).join('')}
      </div>
      <div class="page-foot">
        <span>Micht Decants · WhatsApp 917 452 643 · michtdecants.com · Precios en soles (S/)</span>
        <span>Hoja ${i + 1} de ${pages.length}</span>
      </div>
    </section>`).join('');

  pcFit();
  summary.textContent = `${count} perfume${count !== 1 ? 's' : ''} · ${groups.length} casa${groups.length !== 1 ? 's' : ''} · ${pages.length} hoja${pages.length !== 1 ? 's' : ''}`;
  print.disabled = false;
}

// Red de seguridad: a la ficha que no le entra el texto (nombre muy largo, cuatro
// tallas…) se le va quitando lo menos importante hasta que entre: primero el
// "Se parece a", luego se achica el nombre y al final salen las etiquetas.
function pcFit() {
  document.querySelectorAll('#pcSheets .card').forEach(card => {
    const info = card.querySelector('.card-info');
    for (const cls of ['fit-1', 'fit-2', 'fit-3']) {
      if (info.scrollHeight <= info.clientHeight + 1) break;
      card.classList.add(cls);
    }
  });
}

// ─── Panel "Elegir casas" ────────────────────────────────────────────────────
// Para reimprimir solo una casa (ej. cuando llega un perfume nuevo de esa marca)
function pcRenderHouses(all) {
  const panel = document.getElementById('pcHousesPanel');
  const btn   = document.getElementById('pcHousesBtn');
  const shown = all.filter(g => !PC.hidden.has(g.key)).length;
  btn.textContent = `Elegir casas (${shown} de ${all.length}) ▾`;
  panel.innerHTML = `
    <p class="hp-hint">Marca solo las casas que quieres imprimir. Sirve para reimprimir una sola hoja cuando agregas un perfume.</p>
    <div class="hp-actions">
      <button type="button" data-all="1">Todas</button>
      <button type="button" data-all="0">Ninguna</button>
    </div>
    ${PC_TYPES.map(type => {
      const list = all.filter(g => g.type.key === type.key);
      return list.length ? `
        <div class="hp-group">
          <h3>${pcEsc(type.label)}</h3>
          <div class="hp-list">
            ${list.map(g => `<label><input type="checkbox" data-house="${pcEsc(g.key)}" ${PC.hidden.has(g.key) ? '' : 'checked'}> ${pcEsc(g.name)} <small>${g.items.length}</small></label>`).join('')}
          </div>
        </div>` : '';
    }).join('')}`;
}

// ─── Opciones ────────────────────────────────────────────────────────────────
function pcSavePrefs() {
  try { localStorage.setItem(PC_PREFS_KEY, JSON.stringify({ size: PC.size, soldOut: PC.soldOut, housePage: PC.housePage })); } catch {}
}

function pcSyncControls() {
  document.querySelectorAll('#pcSizes button').forEach(b => b.classList.toggle('active', b.dataset.size === PC.size));
  document.getElementById('pcSoldOut').checked   = PC.soldOut;
  document.getElementById('pcHousePage').checked = PC.housePage;
}

// La vista previa se achica para entrar en pantallas angostas (una hoja A4 mide ~794px)
function pcFitScreen() {
  document.getElementById('pcSheets').style.setProperty('--zoom', Math.min(1, (window.innerWidth - 16) / 794).toFixed(3));
}

async function pcPrint() {
  // Esperar las fotos: una foto a medio cargar saldría en blanco en el papel
  const imgs = [...document.querySelectorAll('#pcSheets img')].filter(img => !img.complete);
  await Promise.all(imgs.map(img => new Promise(resolve => { img.onload = img.onerror = resolve; })));
  window.print();
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PC_PREFS_KEY) || '{}');
    if (PC_SIZES[saved.size]) PC.size = saved.size;
    PC.soldOut   = !!saved.soldOut;
    PC.housePage = !!saved.housePage;
  } catch {}
  pcSyncControls();
  pcFitScreen();
  window.addEventListener('resize', pcFitScreen);

  document.getElementById('pcSizes').addEventListener('click', e => {
    const b = e.target.closest('button[data-size]');
    if (!b) return;
    PC.size = b.dataset.size;
    pcSyncControls(); pcSavePrefs(); pcRender();
  });
  document.getElementById('pcSoldOut').addEventListener('change', e => { PC.soldOut = e.target.checked; pcSavePrefs(); pcRender(); });
  document.getElementById('pcHousePage').addEventListener('change', e => { PC.housePage = e.target.checked; pcSavePrefs(); pcRender(); });
  document.getElementById('pcPrintBtn').addEventListener('click', pcPrint);

  const panel = document.getElementById('pcHousesPanel');
  document.getElementById('pcHousesBtn').addEventListener('click', e => {
    panel.hidden = !panel.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
  });
  panel.addEventListener('change', e => {
    const key = e.target.dataset.house;
    if (!key) return;
    if (e.target.checked) PC.hidden.delete(key); else PC.hidden.add(key);
    pcRender();
  });
  panel.addEventListener('click', e => {
    const b = e.target.closest('button[data-all]');
    if (!b) return;
    PC.hidden = b.dataset.all === '1' ? new Set() : new Set(pcGroups(pcVisibleProducts()).map(g => g.key));
    pcRender();
  });

  try {
    const all = await CloudProducts.getAll();
    // Solo decants que ya llegaron: ni sellados ni "próximamente"
    PC.products = all.filter(p => p.type !== 'entero' && !isComingSoon(p));
    pcRender();
  } catch (err) {
    console.error('[MICHT] Error cargando el catálogo para imprimir:', err);
    document.getElementById('pcSheets').innerHTML = '<p class="msg">No se pudo cargar el catálogo. Revisa tu conexión y vuelve a abrir esta página.</p>';
    document.getElementById('pcSummary').textContent = 'Sin conexión';
  }
});
