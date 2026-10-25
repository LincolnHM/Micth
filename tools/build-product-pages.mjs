// Genera las páginas que Google indexa a partir del catálogo real:
//   · frontend/perfume/<slug>/      una por perfume (copia de la tienda + ficha en HTML)
//   · frontend/marca/<marca>/       una por marca: "Decants de Valentino en Perú"
//   · frontend/coleccion/<tipo>/    árabes, diseñador, nicho, enteros, hombre, mujer, unisex
//   · frontend/marcas/              índice de todas las marcas y colecciones
//   · frontend/sitemap-perfumes.xml todas las anteriores, con la foto de cada perfume
//
//   Uso:  node tools/build-product-pages.mjs
//         PAGES_OFFLINE=1 node tools/build-product-pages.mjs   ← prueba sin internet,
//         con el catálogo local (js/shared/catalog.js) en vez de Supabase
//
// Lo corre GitHub Actions antes de publicar (ver .github/workflows/deploy.yml),
// en cada push y una vez al día, así los perfumes nuevos, precios y stock se
// reflejan solos. Los archivos generados NO se suben a git (.gitignore).
//
// Para qué: cada página es una copia de la tienda (index.html) con el título,
// la descripción, la foto y los datos estructurados de ESE perfume. Así:
//   · al compartir el link por WhatsApp/Facebook sale la foto del perfume, y
//   · Google puede mostrar cada perfume en sus resultados.
// Al abrirla, la tienda carga normal y abre la ficha del perfume.
//
// Para que la foto, el "se parece a", etc. salgan IGUAL que en la tienda, no se
// reimplementa nada: se ejecuta el mismo código de frontend/js/shared/ sobre los
// datos reales de Supabase (solo lectura, con la clave pública).
//
// Si Supabase no responde, NO rompe la publicación: avisa y sale sin generar
// (los links /perfume/… siguen funcionando gracias a 404.html).

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site     = path.join(root, 'frontend');
const shared   = path.join(site, 'js', 'shared');
const OUT_DIR  = path.join(site, 'perfume');
const BRAND_DIR = path.join(site, 'marca');
const COLL_DIR  = path.join(site, 'coleccion');
const INDEX_DIR = path.join(site, 'marcas');
const OFFLINE   = process.env.PAGES_OFFLINE === '1';
const SITEMAP  = path.join(site, 'sitemap-perfumes.xml');
const SITE_URL = 'https://michtdecants.com';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const clip = (s, n) => {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[\s.,;:—-]+$/, '') + '…' : s;
};
const absUrl = u => !u || u.startsWith('data:') ? `${SITE_URL}/imgGato/og-image.jpg`
  : /^https?:\/\//.test(u) ? u : SITE_URL + encodeURI(u.startsWith('/') ? u : '/' + u);

// Vacía la carpeta sin borrarla (en Windows no se puede borrar si una terminal está parada en ella)
function clearDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
}

function bail(msg) {
  console.warn(`⚠ build-product-pages: ${msg} — se publica sin páginas de perfumes.`);
  [OUT_DIR, BRAND_DIR, COLL_DIR, INDEX_DIR].forEach(clearDir);
  fs.rmSync(SITEMAP, { force: true });
  process.exit(0);
}

// ── 1. Catálogo real, con la misma lógica de la tienda ───────────────────────
const cfg = fs.readFileSync(path.join(shared, 'supabase-config.js'), 'utf8');
const SUPABASE_URL = cfg.match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1];
const SUPABASE_KEY = cfg.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)?.[1];
if (!SUPABASE_URL || !SUPABASE_KEY) bail('no encontré la URL/clave en supabase-config.js');

let reached = false;
// Imita lo mínimo del cliente de Supabase que usa CloudProducts.getAll():
// db.from(t).select(cols).order(col, { ascending }) → { data, error }
function makeDb() {
  return {
    from(table) {
      let sel = '*', ord = '';
      const q = {
        select(s) { sel = String(s).replace(/\s+/g, ''); return q; },
        order(col, o = {}) { ord = `${col}.${o.ascending === false ? 'desc' : 'asc'}`; return q; },
        then(resolve, reject) {
          const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(sel)}${ord ? `&order=${ord}` : ''}`;
          return fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
            .then(async r => {
              const body = await r.json().catch(() => null);
              if (r.ok && Array.isArray(body)) { reached = true; return { data: body, error: null }; }
              return { data: null, error: { code: body?.code || String(r.status), message: body?.message || r.statusText } };
            }, e => ({ data: null, error: { code: 'NETWORK', message: e.message } }))
            .then(resolve, reject);
        }
      };
      return q;
    },
    auth: { getSession: async () => ({ data: { session: null } }) }
  };
}

const memory = new Map();
const ctx = {
  console: { log() {}, warn() {}, error() {} },   // el código del sitio es "hablador"
  setTimeout, clearTimeout, URLSearchParams, fetch,
  localStorage: { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: k => memory.delete(k) },
  location: { pathname: '/', search: '', hash: '', hostname: 'michtdecants.com', href: SITE_URL + '/' },
  navigator: { userAgent: 'build-product-pages' },
  document: {
    createElement: () => { let t = ''; return { set textContent(v) { t = String(v); }, get innerHTML() { return esc(t); } }; },
    addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => []
  },
  addEventListener() {}
};
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(`const SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)}; const SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_KEY)};
                 const _isAdminPage = false; const USE_EDGE_CREATE_ORDER = false; var authClient = null;`, ctx);
ctx.db = makeDb();
for (const f of ['data-core.js', 'catalog.js', 'data.js', 'cloud-products.js', 'slugs.js']) {
  vm.runInContext(fs.readFileSync(path.join(shared, f), 'utf8'), ctx, { filename: f });
}

let products;
try { products = await vm.runInContext('CloudProducts.getAll()', ctx); }
catch (e) { bail('error al leer el catálogo: ' + e.message); }
if (!reached && !OFFLINE) bail('Supabase no respondió');
if (!reached) console.warn('⚠ PAGES_OFFLINE: usando el catálogo local, no el de Supabase');
if (!Array.isArray(products) || !products.length) bail('el catálogo vino vacío');
// Los que aún no llegan ("Próximamente") no tienen ficha de compra: sin página.
// Mismo filtro que la tienda (init.js), así los slugs coinciden.
products = products.filter(p => !ctx.isComingSoon(p));

const { byId: slugs } = ctx.MichtSlugs.buildProductSlugs(products);
const purchasable = p => ctx.isDecantPurchasable(p);

// ── 2. Una página por perfume a partir de index.html ─────────────────────────
const template = fs.readFileSync(path.join(site, 'index.html'), 'utf8');

function replaceOnce(html, re, value, label) {
  if (!re.test(html)) throw new Error(`index.html cambió: no encontré ${label}`);
  return html.replace(re, () => value);   // función: un "$" en el texto no se interpreta
}

// ── Ayudas comunes a todas las páginas ───────────────────────────────────────
const slugify   = s => ctx.MichtSlugs.slugify(s);
const brandSlug = p => slugify(p.brand) || 'otras';
const sizeLabel = s => String(s).replace(/(\d)\s*ml$/i, '$1 ml');
const pageImg   = u => !u ? '/imgGato/og-image.jpg' : /^(https?:|data:)/.test(u) ? u : encodeURI(u.startsWith('/') ? u : '/' + u);

function priceInfo(p) {
  const isEntero = p.type === 'entero';
  const sizes    = Object.entries(p.sizes || {}).filter(([, v]) => v > 0);
  const prices   = isEntero
    ? [p.enteroPrice > 0 ? p.enteroPrice : Math.min(...sizes.map(([, v]) => v))].filter(v => v > 0 && isFinite(v))
    : sizes.map(([, v]) => v);
  return {
    isEntero, sizes, prices,
    low:  prices.length ? Math.min(...prices) : 0,
    high: prices.length ? Math.max(...prices) : 0,
  };
}

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })),
  };
}
const ldScript = obj => `  <script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')}\n  </script>`;

// Ficha del perfume en HTML puro, debajo de la ficha visual: es lo que Google lee
// aunque no ejecute el JavaScript de la tienda (título real, notas, precios y
// enlaces a su marca). Es <aside> y no <section> para que la vista de detalle no
// la oculte (oculta "body > section"); product-detail.js la muestra solo mientras
// está abierto este mismo perfume.
function productSeoBlock(p, related) {
  const { isEntero, sizes, low } = priceInfo(p);
  const bSlug = brandSlug(p);
  const h1 = isEntero ? `${p.name} de ${p.brand} — perfume entero` : `Decant de ${p.name} — ${p.brand}`;
  const notes = [['Familia olfativa', p.olfFamily], ['Notas de salida', p.topNotes], ['Notas de corazón', p.heartNotes], ['Notas de fondo', p.baseNotes]]
    .filter(([, v]) => v);
  const dupe = p.dupeOf?.name ? `${p.dupeOf.name}${p.dupeOf.brand ? ` de ${p.dupeOf.brand}` : ''}` : '';
  const priceRows = isEntero
    ? (low ? `<li><span>Frasco original</span><strong>S/ ${low}</strong></li>` : '')
    : sizes.map(([s, v]) => `<li><span>Decant ${esc(sizeLabel(s))}</span><strong>S/ ${v}</strong></li>`).join('');
  const relatedHtml = related.length ? `
      <h2>Más de ${esc(p.brand)}</h2>
      <ul class="seo-links">${related.map(r => `<li><a href="/perfume/${slugs.get(r.id)}/">${esc(r.name)}</a></li>`).join('')}</ul>` : '';
  return `
  <!-- Ficha en HTML para buscadores (generada por tools/build-product-pages.mjs) -->
  <aside class="seo-ficha container" aria-labelledby="seoFichaTitle" data-product-id="${Number(p.id)}">
    <nav class="seo-crumbs" aria-label="Ruta"><a href="/">Inicio</a> › <a href="/marcas/">Marcas</a> › <a href="/marca/${bSlug}/">${esc(p.brand)}</a> › <span>${esc(p.name)}</span></nav>
    <h1 id="seoFichaTitle">${esc(h1)}</h1>
    ${p.description ? `<p class="seo-lead">${esc(p.description)}</p>` : ''}
    ${dupe ? `<p class="seo-dupe">Se parece a <strong>${esc(dupe)}</strong>.</p>` : ''}
    <div class="seo-ficha-grid">
      ${priceRows ? `<div><h2>Precios</h2><ul class="seo-prices">${priceRows}</ul></div>` : ''}
      ${notes.length ? `<div><h2>Notas</h2><dl class="seo-notes">${notes.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>` : ''}
    </div>
    <p class="seo-ship">${isEntero ? 'Frasco original sellado.' : 'Decants originales envasados del frasco.'} Pago con Yape · envíos a todo el Perú por Shalom · delivery gratis en Soritor.</p>
    <p><a class="seo-more" href="/marca/${bSlug}/">Ver todos los perfumes de ${esc(p.brand)} →</a></p>
    ${relatedHtml}
  </aside>
`;
}

function productPage(p) {
  const slug     = slugs.get(p.id);
  const url      = `${SITE_URL}/perfume/${slug}/`;
  const { isEntero, prices, low, high } = priceInfo(p);
  const inStock = purchasable(p);
  const sizesTxt = Object.keys(p.sizes || {}).filter(s => /ml$/i.test(s)).join(', ');

  const title = isEntero
    ? `${p.name} de ${p.brand}${low ? ` — Perfume entero S/ ${low}` : ''} | Micht Decants`
    : `${p.name} de ${p.brand} — Decant${low ? ` desde S/ ${low}` : ''} | Micht Decants`;
  const dupe  = p.dupeOf?.name ? `Se parece a ${p.dupeOf.name}${p.dupeOf.brand ? ` de ${p.dupeOf.brand}` : ''}. ` : '';
  const tail  = isEntero ? ' Frasco original. Envíos a todo el Perú.' : ` Decants de ${sizesTxt || '2 a 10 ml'}. Envíos a todo el Perú.`;
  const description = clip(`${p.name} de ${p.brand}. ${dupe}${p.description || ''}`, 160 - tail.length) + tail;
  const image = absUrl(p.imageUrl);

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${p.name} — ${p.brand}`,
    url,
    image: [image],
    description: clip(`${dupe}${p.description || ''}`, 500) || description,
    sku: `MICHT-${p.id}`,
    brand: { '@type': 'Brand', name: p.brand },
    category: isEntero ? 'Perfume entero' : 'Decant de perfume',
    ...(low ? {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'PEN',
        lowPrice: String(low),
        highPrice: String(high),
        offerCount: String(prices.length),
        availability: `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`,
        url,
        seller: { '@type': 'Organization', name: 'Micht Decants' }
      }
    } : {})
  };
  const jsonLd = JSON.stringify(product, null, 2).replace(/</g, '\\u003c');

  let html = template;
  // <base>: la página vive en /perfume/<slug>/ pero sus rutas relativas (css/, js/…) son de la raíz
  if (!/<base href="\/">/.test(html)) html = replaceOnce(html, /<meta charset="UTF-8">/, '<meta charset="UTF-8">\n  <base href="/">', 'meta charset');
  // Ojo: un comentario de index.html menciona "<title>"; solo vale la etiqueta real, sola en su línea
  html = replaceOnce(html, /\n[ \t]*<title>[^<\n]*<\/title>/, `\n  <title>${esc(title)}</title>`, '<title>');
  html = replaceOnce(html, /<meta name="description"[^>]*>/, `<meta name="description"    content="${esc(description)}">`, 'meta description');
  html = replaceOnce(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical"       href="${url}">`, 'canonical');
  html = replaceOnce(html, /<meta property="og:type"[^>]*>/, '<meta property="og:type"        content="product">', 'og:type');
  html = replaceOnce(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url"         content="${url}">`, 'og:url');
  html = replaceOnce(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title"       content="${esc(title.replace(/ \| Micht Decants$/, ''))}">`, 'og:title');
  html = replaceOnce(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(description)}">`, 'og:description');
  html = replaceOnce(html, /<meta property="og:image"\s[^>]*>/, `<meta property="og:image"       content="${esc(image)}">`, 'og:image');
  html = html.replace(/\s*<meta property="og:image:(type|width|height)"[^>]*>/g, '');
  html = replaceOnce(html, /<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt"   content="${esc(`${p.name} de ${p.brand}`)}">`, 'og:image:alt');
  html = replaceOnce(html, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title"       content="${esc(title.replace(/ \| Micht Decants$/, ''))}">`, 'twitter:title');
  html = replaceOnce(html, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(description)}">`, 'twitter:description');
  html = replaceOnce(html, /<meta name="twitter:image"\s[^>]*>/, `<meta name="twitter:image"       content="${esc(image)}">`, 'twitter:image');
  html = replaceOnce(html, /<meta name="twitter:image:alt"[^>]*>/, `<meta name="twitter:image:alt"   content="${esc(`${p.name} de ${p.brand}`)}">`, 'twitter:image:alt');
  // Datos estructurados: los de la tienda (Store/WebSite/Organization) → el del perfume
  html = html.replace(/\s*<!-- ── Schema[^\n]*\n/g, '\n');
  html = html.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  // Un solo <h1> por página, el del perfume (el logo de la tienda pasa a <p>)
  html = html.replace(/<h1 class="logo-text">([\s\S]*?)<\/h1>/, '<p class="logo-text">$1</p>');
  const related = products.filter(r => r.id !== p.id && brandSlug(r) === brandSlug(p) && slugs.get(r.id)).slice(0, 8);
  html = replaceOnce(html, /\n[ \t]*<footer class="footer">/, `\n${productSeoBlock(p, related)}\n  <footer class="footer">`, '<footer>');
  const crumbs = breadcrumbLd([['Inicio', SITE_URL + '/'], ['Marcas', SITE_URL + '/marcas/'], [p.brand, `${SITE_URL}/marca/${brandSlug(p)}/`], [p.name, url]]);
  html = replaceOnce(html, /<\/head>/, `${ldScript(crumbs)}\n  <script type="application/ld+json">\n${jsonLd}\n  </script>\n  <!-- Página del perfume: la tienda abre esta ficha al cargar (js/store/catalog-view.js) -->\n  <script>window.__MICHT_PRODUCT_ID = ${Number(p.id)};</script>\n</head>`, '</head>');
  return { slug, url, html, image, title: `${p.name} de ${p.brand}` };
}

clearDir(OUT_DIR);
const pages = [];
for (const p of products) {
  if (!slugs.get(p.id)) continue;
  let page;
  try { page = productPage(p); }
  catch (e) { bail(e.message); }
  fs.mkdirSync(path.join(OUT_DIR, page.slug), { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, page.slug, 'index.html'), page.html);
  pages.push(page);
}

// ── 3. Páginas de marca y de colección ───────────────────────────────────────
// Para búsquedas como "decants de Valentino" o "perfumes árabes Perú": cada una
// tiene su título, su texto y enlaces reales (<a href>) a la página de cada
// perfume, que es como Google descubre y entiende el catálogo.
// Se arman sobre nosotros/index.html para usar el mismo encabezado y pie.
const shell = fs.readFileSync(path.join(site, 'nosotros', 'index.html'), 'utf8')
  .replace(/(href|src)="\.\.\//g, '$1="/')                       // rutas desde la raíz
  .replace(/ style="color:var\(--gold\)"/g, '');                   // "Nosotros" ya no va resaltado

function shellPage({ url, title, description, image, body, jsonLd }) {
  let html = shell;
  const head = `<title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="author" content="MICHT Decants">
  <link rel="canonical" href="${url}">

  <meta property="og:type"        content="website">
  <meta property="og:url"         content="${url}">
  <meta property="og:site_name"   content="MICHT Decants">
  <meta property="og:locale"      content="es_PE">
  <meta property="og:title"       content="${esc(title.replace(/ \| Micht Decants$/, ''))}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image"       content="${esc(image)}">
${jsonLd.map(ldScript).join('\n')}`;
  html = replaceOnce(html, /<title>[\s\S]*?<meta property="og:image"[^>]*>/, head, 'cabecera SEO de nosotros/index.html');
  html = replaceOnce(html, /<div class="page-sep page-sep-top"[\s\S]*?<div class="page-sep page-sep-bottom"[^>]*><\/div>/,
    `<div class="page-sep page-sep-top" aria-hidden="true"></div>\n${body}\n  <div class="page-sep page-sep-bottom" aria-hidden="true"></div>`, 'contenido de nosotros/index.html');
  // Las animaciones de Nosotros apuntan a sus propias secciones: no aplican aquí
  html = html.replace(/\s*<script>\s*if \(typeof gsap !== 'undefined'\)[\s\S]*?<\/script>/, '');
  return html;
}

function card(p) {
  const { isEntero, sizes, low } = priceInfo(p);
  const dupe = p.dupeOf?.name ? `Se parece a ${p.dupeOf.name}` : '';
  const sold = !purchasable(p);
  return `<li><a class="seo-card" href="/perfume/${slugs.get(p.id)}/">
          <span class="seo-card-img"><img src="${esc(pageImg(p.imageUrl))}" alt="${esc(`${isEntero ? 'Perfume' : 'Decant'} ${p.name} de ${p.brand}`)}" loading="lazy" decoding="async"></span>
          <span class="seo-card-brand">${esc(p.brand)}</span>
          <h3>${esc(p.name)}</h3>
          ${dupe ? `<span class="seo-card-dupe">${esc(dupe)}</span>` : ''}
          <span class="seo-card-price">${low ? `${isEntero ? '' : 'Desde '}S/ ${low}` : 'Consultar precio'}${sold ? ' · <em>Agotado</em>' : ''}</span>
          ${!isEntero && sizes.length ? `<span class="seo-card-sizes">${sizes.map(([s]) => esc(sizeLabel(s))).join(' · ')}</span>` : ''}
        </a></li>`;
}
const cardGrid = list => `<ul class="seo-grid">\n        ${list.map(card).join('\n        ')}\n      </ul>`;
const byName = (a, b) => a.name.localeCompare(b.name, 'es');
const minPrice = list => Math.min(...list.map(p => priceInfo(p).low).filter(v => v > 0));
const listed = products.filter(p => slugs.get(p.id)).sort(byName);

// Marcas: se agrupan por slug ("Lattafa" y "lattafa" son la misma) y se muestra
// la forma de escribirla más usada
const brands = new Map();
for (const p of listed) {
  const k = brandSlug(p);
  if (!brands.has(k)) brands.set(k, { slug: k, names: new Map(), items: [] });
  const b = brands.get(k);
  b.items.push(p);
  b.names.set(p.brand, (b.names.get(p.brand) || 0) + 1);
}
for (const b of brands.values()) b.name = [...b.names].sort((x, y) => y[1] - x[1])[0][0];
const brandList = [...brands.values()].sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, 'es'));

const COLLECTIONS = [
  { slug: 'decants-arabes',     test: p => p.type === 'arabe',     h1: 'Decants de perfumes árabes en Perú',        short: 'Perfumes árabes',     lead: 'Lattafa, Armaf, Afnan, Rasasi y más casas árabes en decants: fragancias intensas, muchas inspiradas en perfumes de diseñador.' },
  { slug: 'decants-disenador',  test: p => p.type === 'diseñador', h1: 'Decants de perfumes de diseñador en Perú',   short: 'Perfumes de diseñador', lead: 'Dior, Valentino, Jean Paul Gaultier, Paco Rabanne y más: prueba los perfumes de diseñador en decant antes de comprar el frasco.' },
  { slug: 'perfumes-nicho',     test: p => p.type === 'nicho',     h1: 'Decants de perfumes nicho en Perú',          short: 'Perfumes nicho',      lead: 'Alta perfumería en decants: prueba perfumes nicho sin pagar el frasco completo.' },
  { slug: 'perfumes-enteros',   test: p => p.type === 'entero',    h1: 'Perfumes enteros originales en Perú',        short: 'Perfumes enteros',    lead: 'Frascos originales sellados, para regalar o para tu colección.' },
  { slug: 'decants-para-hombre', test: p => p.type !== 'entero' && p.gender === 'hombre', h1: 'Decants de perfumes para hombre en Perú', short: 'Para hombre', lead: 'Perfumes masculinos árabes y de diseñador en decants de 2, 3, 5, 10 y 30 ml.' },
  { slug: 'decants-para-mujer',  test: p => p.type !== 'entero' && p.gender === 'mujer',  h1: 'Decants de perfumes para mujer en Perú',  short: 'Para mujer',  lead: 'Perfumes femeninos árabes y de diseñador en decants de 2, 3, 5, 10 y 30 ml.' },
  { slug: 'decants-unisex',      test: p => p.type !== 'entero' && p.gender === 'unisex', h1: 'Decants de perfumes unisex en Perú',      short: 'Unisex',      lead: 'Fragancias para todos, en decants de 2, 3, 5, 10 y 30 ml.' },
].map(c => ({ ...c, items: listed.filter(c.test) })).filter(c => c.items.length);

const WA = 'https://wa.me/51917452643';
const HOW_TO_BUY = `
    <section class="seo-section seo-info">
      <h2>Cómo comprar en MICHT Decants</h2>
      <ul>
        <li><strong>Decants originales</strong> envasados del frasco, en 2, 3, 5, 10 y 30 ml.</li>
        <li><strong>Pago con Yape</strong> y confirmación por WhatsApp.</li>
        <li><strong>Envíos a todo el Perú</strong> por Shalom · delivery gratis en Soritor desde 2 decants o 1 perfume entero.</li>
      </ul>
    </section>`;
const chips = (items, current) => `<ul class="seo-chips">${items.filter(i => i.slug !== current)
  .map(i => `<li><a href="${i.href}">${esc(i.label)}</a></li>`).join('')}</ul>`;
const brandChips = current => chips(brandList.map(b => ({ slug: b.slug, href: `/marca/${b.slug}/`, label: b.name })), current);
const collChips  = current => chips(COLLECTIONS.map(c => ({ slug: c.slug, href: `/coleccion/${c.slug}/`, label: c.short })), current);

function itemListLd(name, url, list) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name, url, inLanguage: 'es-PE',
    isPartOf: { '@type': 'WebSite', name: 'Micht Decants', url: SITE_URL + '/' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: list.length,
      itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/perfume/${slugs.get(p.id)}/`, name: `${p.name} — ${p.brand}` })),
    },
  };
}

const extraPages = [];   // { url, dir, html } → se escriben al final y van al sitemap

for (const b of brandList) {
  const url = `${SITE_URL}/marca/${b.slug}/`;
  const decants = b.items.filter(p => p.type !== 'entero');
  const enteros = b.items.filter(p => p.type === 'entero');
  // Perfumes (de otras marcas) que se parecen a uno de esta marca: "alternativas a Valentino"
  const dupes = listed.filter(p => brandSlug(p) !== b.slug && p.dupeOf?.brand && slugify(p.dupeOf.brand) === b.slug);
  const low = minPrice(b.items);
  const word = decants.length ? 'Decants' : 'Perfumes';
  const h1 = `${word} de ${b.name} en Perú`;
  const top = b.items.slice(0, 3).map(p => p.name).join(', ');
  const title = `${h1}${isFinite(low) ? ` — desde S/ ${low}` : ''} | Micht Decants`;
  const tail = ` ${decants.length ? 'En 2, 3, 5, 10 y 30 ml. ' : ''}Envíos a todo el Perú.`;
  const description = clip(`${word} originales de ${b.name} en Perú: ${top}${b.items.length > 3 ? ' y más' : ''}.`, 158 - tail.length) + tail;
  const body = `
  <main class="seo-page container">
    <nav class="seo-crumbs" aria-label="Ruta"><a href="/">Inicio</a> › <a href="/marcas/">Marcas</a> › <span>${esc(b.name)}</span></nav>
    <header class="seo-hero">
      <span class="section-tag">Marca</span>
      <h1>${esc(h1)}</h1>
      <p class="seo-lead">${b.items.length} ${b.items.length === 1 ? 'fragancia' : 'fragancias'} de ${esc(b.name)}${isFinite(low) ? ` desde <strong>S/ ${low}</strong>` : ''}. ${decants.length ? `Prueba tu ${esc(b.name)} favorito en decant antes de comprar el frasco completo.` : 'Frascos originales con envío a todo el Perú.'}</p>
      <div class="seo-hero-actions">
        <a class="btn-store" href="/?q=${encodeURIComponent(b.name)}#catalogo">Comprar en la tienda →</a>
        <a class="seo-wa" href="${WA}?text=${encodeURIComponent(`Hola, quiero información sobre los perfumes de ${b.name}`)}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a>
      </div>
    </header>
    ${decants.length ? `<section class="seo-section"><h2>Decants de ${esc(b.name)}</h2>\n      ${cardGrid(decants)}\n    </section>` : ''}
    ${enteros.length ? `<section class="seo-section"><h2>Perfumes enteros de ${esc(b.name)}</h2>\n      ${cardGrid(enteros)}\n    </section>` : ''}
    ${dupes.length ? `<section class="seo-section"><h2>Alternativas que se parecen a ${esc(b.name)}</h2>
      <p class="seo-sub">Perfumes árabes inspirados en fragancias de ${esc(b.name)}, a menor precio.</p>
      ${cardGrid(dupes)}\n    </section>` : ''}
    ${HOW_TO_BUY}
    <section class="seo-section"><h2>Otras marcas</h2>${brandChips(b.slug)}</section>
  </main>`;
  const crumbs = breadcrumbLd([['Inicio', SITE_URL + '/'], ['Marcas', SITE_URL + '/marcas/'], [b.name, url]]);
  extraPages.push({ url, dir: path.join(BRAND_DIR, b.slug), html: shellPage({
    url, title, description, image: absUrl(b.items[0].imageUrl), body,
    jsonLd: [itemListLd(h1, url, [...b.items, ...dupes]), crumbs] }) });
}

for (const c of COLLECTIONS) {
  const url = `${SITE_URL}/coleccion/${c.slug}/`;
  const low = minPrice(c.items);
  const title = `${c.h1}${isFinite(low) ? ` — desde S/ ${low}` : ''} | Micht Decants`;
  const description = clip(`${c.lead}`, 158 - 24) + ' Envíos a todo el Perú.';
  const body = `
  <main class="seo-page container">
    <nav class="seo-crumbs" aria-label="Ruta"><a href="/">Inicio</a> › <a href="/marcas/">Marcas y colecciones</a> › <span>${esc(c.short)}</span></nav>
    <header class="seo-hero">
      <span class="section-tag">Colección</span>
      <h1>${esc(c.h1)}</h1>
      <p class="seo-lead">${esc(c.lead)}${isFinite(low) ? ` Desde <strong>S/ ${low}</strong>.` : ''}</p>
      <div class="seo-hero-actions"><a class="btn-store" href="/#catalogo">Ver el catálogo →</a></div>
    </header>
    <section class="seo-section"><h2>${c.items.length} perfumes</h2>\n      ${cardGrid(c.items)}\n    </section>
    ${HOW_TO_BUY}
    <section class="seo-section"><h2>Más colecciones</h2>${collChips(c.slug)}</section>
  </main>`;
  const crumbs = breadcrumbLd([['Inicio', SITE_URL + '/'], ['Marcas y colecciones', SITE_URL + '/marcas/'], [c.short, url]]);
  extraPages.push({ url, dir: path.join(COLL_DIR, c.slug), html: shellPage({
    url, title, description, image: absUrl(c.items[0].imageUrl), body, jsonLd: [itemListLd(c.h1, url, c.items), crumbs] }) });
}

{ // Índice: /marcas/
  const url = `${SITE_URL}/marcas/`;
  const body = `
  <main class="seo-page container">
    <nav class="seo-crumbs" aria-label="Ruta"><a href="/">Inicio</a> › <span>Marcas</span></nav>
    <header class="seo-hero">
      <span class="section-tag">Catálogo</span>
      <h1>Marcas de perfumes en decants</h1>
      <p class="seo-lead">${listed.length} perfumes de ${brandList.length} marcas, en decants y frascos enteros, con envío a todo el Perú.</p>
    </header>
    <section class="seo-section"><h2>Colecciones</h2>${collChips(null)}</section>
    <section class="seo-section"><h2>Todas las marcas</h2>
      <ul class="seo-brands">${brandList.map(b => `<li><a href="/marca/${b.slug}/"><strong>${esc(b.name)}</strong><span>${b.items.length} ${b.items.length === 1 ? 'perfume' : 'perfumes'}</span></a></li>`).join('')}</ul>
    </section>
    ${HOW_TO_BUY}
  </main>`;
  extraPages.push({ url, dir: INDEX_DIR, html: shellPage({
    url, title: 'Marcas de perfumes en decants — Lattafa, Armaf, Dior, Valentino y más | Micht Decants',
    description: clip(`Todas las marcas de MICHT Decants: ${brandList.slice(0, 6).map(b => b.name).join(', ')} y más. Decants y perfumes enteros, envíos a todo el Perú.`, 158),
    image: `${SITE_URL}/imgGato/og-image.jpg`, body,
    jsonLd: [breadcrumbLd([['Inicio', SITE_URL + '/'], ['Marcas', url]])] }) });
}

[BRAND_DIR, COLL_DIR, INDEX_DIR].forEach(clearDir);
for (const pg of extraPages) {
  fs.mkdirSync(pg.dir, { recursive: true });
  fs.writeFileSync(path.join(pg.dir, 'index.html'), pg.html);
}

// ── 4. Sitemap: perfumes (con su foto), marcas y colecciones ─────────────────
const today = new Date().toISOString().slice(0, 10);
const xml = s => esc(s);
fs.writeFileSync(SITEMAP, `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generado por tools/build-product-pages.mjs al publicar. No editar a mano. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${extraPages.map(pg => `  <url>
    <loc>${pg.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`).join('\n')}
${pages.map(pg => `  <url>
    <loc>${pg.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${/^https?:/.test(pg.image) ? `
    <image:image>
      <image:loc>${xml(pg.image)}</image:loc>
      <image:title>${xml(pg.title)}</image:title>
    </image:image>` : ''}
  </url>`).join('\n')}
</urlset>
`);

console.log(`✓ ${pages.length} perfumes, ${brandList.length} marcas y ${COLLECTIONS.length} colecciones + sitemap-perfumes.xml`);
