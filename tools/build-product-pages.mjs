// Genera una página por perfume: frontend/perfume/<slug>/index.html
// y el sitemap frontend/sitemap-perfumes.xml.
//
//   Uso:  node tools/build-product-pages.mjs
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
  clearDir(OUT_DIR);
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
if (!reached) bail('Supabase no respondió');
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
  return html.replace(re, value);
}

function productPage(p) {
  const slug     = slugs.get(p.id);
  const url      = `${SITE_URL}/perfume/${slug}/`;
  const isEntero = p.type === 'entero';
  const prices   = isEntero
    ? [p.enteroPrice > 0 ? p.enteroPrice : Math.min(...Object.values(p.sizes || {}).filter(v => v > 0))].filter(v => v > 0 && isFinite(v))
    : Object.entries(p.sizes || {}).filter(([, v]) => v > 0).map(([, v]) => v);
  const low  = prices.length ? Math.min(...prices) : 0;
  const high = prices.length ? Math.max(...prices) : 0;
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
  html = replaceOnce(html, /<\/head>/, `  <script type="application/ld+json">\n${jsonLd}\n  </script>\n  <!-- Página del perfume: la tienda abre esta ficha al cargar (js/store/catalog-view.js) -->\n  <script>window.__MICHT_PRODUCT_ID = ${Number(p.id)};</script>\n</head>`, '</head>');
  return { slug, url, html };
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

// ── 3. Sitemap de perfumes ───────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(SITEMAP, `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generado por tools/build-product-pages.mjs al publicar. No editar a mano. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(pg => `  <url>
    <loc>${pg.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>
`);

console.log(`✓ ${pages.length} páginas de perfumes en frontend/perfume/ + sitemap-perfumes.xml`);
