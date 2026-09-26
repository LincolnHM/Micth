// ─── Direcciones de cada perfume: /perfume/<slug>/ ────────────────────────────
//
// La usan la tienda (links para compartir, historial) y tools/build-product-pages.mjs
// (que genera una página por perfume al publicar). Las dos DEBEN dar el mismo
// resultado, por eso viven en este único archivo.
//
//   "Khamrah Qahwa"  → khamrah-qahwa        "L'Immensité" → limmensite
//   "9PM" (entero)   → 9pm-entero           nombre repetido → <slug>-<id>
//
// Los repetidos se resuelven por id ascendente: el perfume más antiguo se queda
// con la dirección limpia, así las direcciones ya publicadas no cambian cuando
// se agrega uno nuevo con el mismo nombre.

(function (root) {
  function slugify(text) {
    return String(text || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[°º'’]/g, '')
      .replace(/&/g, ' y ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function buildProductSlugs(products) {
    const byId = new Map(), bySlug = new Map();
    [...(products || [])].sort((a, b) => a.id - b.id).forEach(p => {
      let base = slugify(p.name) || `perfume-${p.id}`;
      if (p.type === 'entero' && !/(^|-)entero(-|$)/.test(base)) base += '-entero';
      const slug = bySlug.has(base) ? `${base}-${p.id}` : base;
      byId.set(p.id, slug);
      bySlug.set(slug, p.id);
    });
    return { byId, bySlug };
  }

  const api = { slugify, buildProductSlugs };
  root.MichtSlugs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
