// ─── MICHT Decants — Capa de datos ───────────────────────────────────────────

const STORAGE_KEY  = 'micht_products_v2';
const ORDERS_KEY   = 'micht_orders';
const SITE_THEME_KEY = 'micht_site_theme';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildProductImage(product) {
  const seed = hashString(`${product.brand}::${product.name}`);
  const primaryHue = seed % 360;
  const accentHue = (primaryHue + 24) % 360;
  const label = product.type === 'arabe' ? 'Colección árabe' : 'Colección diseñador';

  const background = product.type === 'arabe'
    ? `hsl(${primaryHue} 36% 12%)`
    : `hsl(${primaryHue} 26% 14%)`;
  const glow = product.type === 'arabe'
    ? `hsl(${accentHue} 60% 58%)`
    : `hsl(${accentHue} 38% 72%)`;
  const surface = product.type === 'arabe'
    ? `hsl(${accentHue} 56% 28%)`
    : `hsl(${accentHue} 24% 32%)`;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 900" role="img" aria-label="${escapeXml(product.brand)} ${escapeXml(product.name)}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${background}"/>
          <stop offset="100%" stop-color="hsl(${(primaryHue + 18) % 360} 42% 20%)"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="24%" r="70%">
          <stop offset="0%" stop-color="${glow}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="bottle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fff8e1"/>
          <stop offset="100%" stop-color="${surface}"/>
        </linearGradient>
      </defs>
      <rect width="720" height="900" rx="48" fill="url(#bg)"/>
      <rect width="720" height="900" rx="48" fill="url(#glow)"/>
      <circle cx="126" cy="146" r="84" fill="${glow}" fill-opacity="0.12"/>
      <circle cx="604" cy="206" r="112" fill="#ffffff" fill-opacity="0.05"/>
      <circle cx="580" cy="720" r="150" fill="${glow}" fill-opacity="0.08"/>

      <text x="54" y="92" fill="#f6e6b5" fill-opacity="0.92" font-family="Inter, Arial, sans-serif" font-size="26" letter-spacing="3">MICHT DECANTS</text>
      <text x="54" y="136" fill="#ffffff" fill-opacity="0.74" font-family="Inter, Arial, sans-serif" font-size="18" letter-spacing="2">${escapeXml(label)}</text>

      <g transform="translate(140 180)">
        <rect x="112" y="0" width="196" height="72" rx="30" fill="url(#bottle)" fill-opacity="0.92"/>
        <rect x="88" y="60" width="244" height="520" rx="48" fill="url(#bottle)"/>
        <rect x="108" y="88" width="204" height="68" rx="24" fill="#ffffff" fill-opacity="0.16"/>
        <rect x="132" y="150" width="156" height="228" rx="28" fill="#0f0f0f" fill-opacity="0.18"/>
        <ellipse cx="210" cy="606" rx="142" ry="22" fill="#000000" fill-opacity="0.24"/>
        <rect x="160" y="-42" width="100" height="56" rx="16" fill="#e7d29a"/>
        <rect x="176" y="-72" width="68" height="42" rx="10" fill="#f4e1aa"/>
        <path d="M172 176h76c16 0 28 12 28 28v136c0 16-12 28-28 28h-76c-16 0-28-12-28-28V204c0-16 12-28 28-28z" fill="#ffffff" fill-opacity="0.10"/>
        <path d="M164 176h92c12 0 22 10 22 22v158c0 12-10 22-22 22h-92c-12 0-22-10-22-22V198c0-12 10-22 22-22z" fill="#ffffff" fill-opacity="0.06"/>
      </g>

      <text x="360" y="720" text-anchor="middle" fill="#fff6df" font-family="Playfair Display, Georgia, serif" font-size="56" font-weight="700">${escapeXml(product.name)}</text>
      <text x="360" y="772" text-anchor="middle" fill="#f6e6b5" fill-opacity="0.94" font-family="Inter, Arial, sans-serif" font-size="24" letter-spacing="2">${escapeXml(product.brand)}</text>
      <text x="360" y="824" text-anchor="middle" fill="#ffffff" fill-opacity="0.64" font-family="Inter, Arial, sans-serif" font-size="18" letter-spacing="1.8">${escapeXml(product.olfFamily || '')}</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// ─── Catálogo inicial ─────────────────────────────────────────────────────────
// Nuevos campos: gender, occasion, olfFamily, topNotes, heartNotes, baseNotes

const DEFAULT_PRODUCTS = [

  // ─── DISEÑADOR ALTA GAMA ──────────────────────────────────────────────────
  {
    id: 0,
    name: "L'Immensité",
    brand: 'Louis Vuitton',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Oriental Especiado',
    topNotes: 'Toronja, Bergamota, Jengibre',
    heartNotes: 'Romero, Salvia, Geranio, Notas acuáticas',
    baseNotes: 'Ambroxan, Ámbar, Ládano',
    accords: [ { name: 'aromático', pct: 100 }, { name: 'fresco especiado', pct: 95 }, { name: 'cítrico', pct: 78 }, { name: 'ámbar', pct: 47 }, { name: 'herbal', pct: 37 }, { name: 'acuático', pct: 28 }, { name: 'almizclado', pct: 22 }, { name: 'fresco', pct: 21 } ],
    description: "L'Immensité de Louis Vuitton: pomelo y jengibre sobre un corazón acuático de romero y salvia, cerrando en ambroxan y ámbar. Inmensidad marina con la firma de alta perfumería de la Maison.",
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 29, '5ml': 45, '10ml': 89 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 1,
    name: 'Creed Aventus',
    brand: 'Creed',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Amaderado Frutal',
    topNotes: 'Piña, Grosella negra, Manzana, Bergamota',
    heartNotes: 'Abedul, Pachulí, Jazmín, Geranio',
    baseNotes: 'Musgo de roble, Ámbar gris, Almizcle, Vetiver',
    accords: [ { name: 'afrutados', pct: 100 }, { name: 'dulce', pct: 69 }, { name: 'amaderado', pct: 68 }, { name: 'cuero', pct: 64 }, { name: 'cítrico', pct: 59 }, { name: 'ahumado', pct: 57 }, { name: 'almizclado', pct: 55 }, { name: 'fresco', pct: 52 }, { name: 'tropical', pct: 52 }, { name: 'musgoso', pct: 47 } ],
    description: 'El rey de los perfumes masculinos. Piña fresca sobre madera ahumada de abedul con ámbar gris. Poder y elegancia en estado puro.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 29, '5ml': 45, '10ml': 89 },
    inStock: true,
    featured: true,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 2,
    name: 'Erba Pura',
    brand: 'Xerjoff',
    type: 'diseñador',
    gender: 'unisex',
    occasion: 'ambas',
    olfFamily: 'Floral Amaderado',
    topNotes: 'Naranja de Sicilia, Pomelo, Limón',
    heartNotes: 'Flor de naranja, Jazmín, Gardenia',
    baseNotes: 'Almizcle blanco, Ámbar, Sándalo, Cedro',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'afrutados', pct: 99 }, { name: 'dulce', pct: 83 }, { name: 'almizclado', pct: 74 }, { name: 'atalcado', pct: 67 }, { name: 'avainillado', pct: 62 }, { name: 'ámbar', pct: 55 }, { name: 'fresco especiado', pct: 46 } ],
    description: 'Frescura mediterránea con flor de naranja de Sicilia y base almizcleña. Luminoso, sensual y deliciosamente único.',
    imageUrl: '',
    sizes: { '2ml': 25, '3ml': 29, '5ml': 45, '10ml': 89 },
    inStock: true,
    featured: true,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── JEAN PAUL GAULTIER ───────────────────────────────────────────────────
  {
    id: 3,
    name: 'Le Beau Le Parfum',
    brand: 'Jean Paul Gaultier',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Oriental Cítrico',
    topNotes: 'Bergamota, Mandarina',
    heartNotes: 'Coco, Frangipani',
    baseNotes: 'Cedro, Vainilla, Tonka',
    accords: [ { name: 'dulce', pct: 100 }, { name: 'amaderado', pct: 97 }, { name: 'coco', pct: 91 }, { name: 'ámbar', pct: 78 }, { name: 'avainillado', pct: 72 }, { name: 'tropical', pct: 68 }, { name: 'afrutados', pct: 68 }, { name: 'atalcado', pct: 58 }, { name: 'iris', pct: 52 }, { name: 'lactónico', pct: 52 } ],
    description: 'Versión intensa y solar de Le Beau. Coco tropical y vainilla envueltos en cítricos brillantes. Verano eterno en un frasco.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: true,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 4,
    name: 'Le Male Elixir',
    brand: 'Jean Paul Gaultier',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Especiado',
    topNotes: 'Lavanda, Bergamota',
    heartNotes: 'Cardamomo, Miel, Flor de naranja',
    baseNotes: 'Vainilla, Ámbar, Pachulí, Almizcle',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'dulce', pct: 81 }, { name: 'amielado', pct: 71 }, { name: 'aromático', pct: 60 }, { name: 'ámbar', pct: 59 }, { name: 'lavanda', pct: 54 }, { name: 'tabaco', pct: 50 }, { name: 'verde', pct: 48 }, { name: 'fresco especiado', pct: 46 }, { name: 'atalcado', pct: 46 } ],
    description: 'La evolución más oscura y seductora de Le Male. Lavanda especiada con miel y un fondo ambarino irresistible.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 5,
    name: 'Le Male Le Parfum',
    brand: 'Jean Paul Gaultier',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Lavanda, Menta',
    heartNotes: 'Flor de naranja, Vetiver',
    baseNotes: 'Vainilla, Almizcle negro, Sándalo',
    accords: [ { name: 'cálido especiado', pct: 100 }, { name: 'avainillado', pct: 80 }, { name: 'lavanda', pct: 66 }, { name: 'aromático', pct: 65 }, { name: 'atalcado', pct: 65 }, { name: 'iris', pct: 64 }, { name: 'amaderado', pct: 59 }, { name: 'ámbar', pct: 55 }, { name: 'violeta', pct: 47 } ],
    description: 'La versión Parfum de Le Male. Más profundo y sensual. Lavanda nocturna con madera oscura y vainilla envolvente.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── OTROS DISEÑADOR ─────────────────────────────────────────────────────
  {
    id: 6,
    name: 'Valentino Intense',
    brand: 'Valentino',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Pimienta negra, Bergamota',
    heartNotes: 'Rosa, Geranio, Lavanda',
    baseNotes: 'Vetiver, Cedro, Ámbar',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'iris', pct: 89 }, { name: 'atalcado', pct: 79 }, { name: 'cuero', pct: 69 }, { name: 'violeta', pct: 59 }, { name: 'dulce', pct: 54 }, { name: 'terrosos', pct: 54 }, { name: 'aromático', pct: 52 }, { name: 'animálico', pct: 49 }, { name: 'ámbar', pct: 47 } ],
    description: 'Born in Roma Intense: la versión oscura y especiada de Valentino. Pimienta negra y rosa sobre vetiver y ámbar dorado.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 7,
    name: 'The Most Wanted',
    brand: 'Azzaro',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Amaderado Especiado',
    topNotes: 'Pimienta rosa, Cardamomo',
    heartNotes: 'Lavanda, Bergamota especiada',
    baseNotes: 'Cedro, Vetiver, Cuero',
    accords: [ { name: 'cálido especiado', pct: 100 }, { name: 'dulce', pct: 89 }, { name: 'ámbar', pct: 82 }, { name: 'amaderado', pct: 71 }, { name: 'caramelo', pct: 59 }, { name: 'aromático', pct: 57 } ],
    description: 'Seductor y atrevido. Cardamomo y pimienta rosa se funden con vetiver y cuero para crear una fragancia de poder magnético.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 8,
    name: 'Stronger With You Intensely',
    brand: 'Giorgio Armani',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Pimienta rosa, Jengibre, Cardamomo',
    heartNotes: 'Lavanda, Castañas, Salvia',
    baseNotes: 'Vainilla, Cedro, Musgo, Cuero',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'dulce', pct: 92 }, { name: 'ámbar', pct: 72 }, { name: 'canela', pct: 70 }, { name: 'cálido especiado', pct: 67 }, { name: 'atalcado', pct: 59 }, { name: 'aromático', pct: 56 }, { name: 'especiado suave', pct: 55 }, { name: 'caramelo', pct: 48 } ],
    description: 'La versión más oscura e intensa de Stronger With You. Especiado y ambarino con calidez de castaña asada y cuero.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 9,
    name: 'Bleu de Chanel Parfum',
    brand: 'Chanel',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Aromático Amaderado',
    topNotes: 'Limón, Menta, Bergamota',
    heartNotes: 'Jazmín, Incienso, Nuez moscada',
    baseNotes: 'Cedro, Sándalo, Vetiver, Ámbar',
    accords: [ { name: 'amaderado', pct: 100 }, { name: 'cítrico', pct: 71 }, { name: 'aromático', pct: 64 }, { name: 'ámbar', pct: 58 }, { name: 'fresco especiado', pct: 56 }, { name: 'atalcado', pct: 49 }, { name: 'cálido especiado', pct: 48 }, { name: 'verde', pct: 47 }, { name: 'lavanda', pct: 47 } ],
    description: 'La expresión más pura de Bleu de Chanel. Aromático fresco con madera noble y un seco final de cedro y sándalo.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: true,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 10,
    name: 'Y EDP',
    brand: 'Yves Saint Laurent',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Aromático Frutal',
    topNotes: 'Manzana, Jengibre, Bergamota',
    heartNotes: 'Salvia, Geranio, Flor de naranja',
    baseNotes: 'Cedro, Ambroxan, Almizcle',
    accords: [ { name: 'aromático', pct: 100 }, { name: 'fresco especiado', pct: 98 }, { name: 'amaderado', pct: 81 }, { name: 'afrutados', pct: 71 }, { name: 'fresco', pct: 67 }, { name: 'ámbar', pct: 66 }, { name: 'cítrico', pct: 62 }, { name: 'herbal', pct: 58 }, { name: 'verde', pct: 55 }, { name: 'cálido especiado', pct: 45 } ],
    description: 'Y EDP de YSL: dinámico y moderno. Manzana jugosa y jengibre sobre cedro y ambroxan. El perfume del hombre actual.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 11,
    name: 'Homme Intense',
    brand: 'Dior',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Lavanda, Bergamota',
    heartNotes: 'Iris, Notas de cuero',
    baseNotes: 'Vainilla, Cedro, Vetiver',
    accords: [ { name: 'atalcado', pct: 100 }, { name: 'iris', pct: 97 }, { name: 'avainillado', pct: 96 }, { name: 'amaderado', pct: 76 }, { name: 'ámbar', pct: 68 }, { name: 'terrosos', pct: 67 }, { name: 'violeta', pct: 64 }, { name: 'aromático', pct: 44 } ],
    description: 'Dior Homme Intense: el glamour masculino en su máxima expresión. Iris empolvado con vainilla cálida y un toque de cuero noble.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 12,
    name: 'Dior Sauvage',
    brand: 'Dior',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Aromático Amaderado',
    topNotes: 'Bergamota de Calabria, Pimienta de Sichuan',
    heartNotes: 'Lavanda, Geranio',
    baseNotes: 'Ambroxan, Cedro, Vetiver',
    accords: [ { name: 'fresco especiado', pct: 100 }, { name: 'ámbar', pct: 71 }, { name: 'cítrico', pct: 69 }, { name: 'aromático', pct: 64 }, { name: 'almizclado', pct: 57 }, { name: 'amaderado', pct: 55 }, { name: 'lavanda', pct: 47 }, { name: 'herbal', pct: 46 } ],
    description: 'El perfume masculino más vendido del mundo. Bergamota brillante con ambroxan y madera de cedro. Fresco, salvaje e irresistible.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: true,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 13,
    name: 'Eros Flame',
    brand: 'Versace',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Limón, Naranja sanguina, Pomelo',
    heartNotes: 'Geranio, Pimiento negro, Rosa turca',
    baseNotes: 'Cedro de Virginia, Sándalo',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'fresco especiado', pct: 71 }, { name: 'avainillado', pct: 70 }, { name: 'aromático', pct: 70 }, { name: 'amaderado', pct: 63 }, { name: 'cálido especiado', pct: 53 }, { name: 'dulce', pct: 46 }, { name: 'atalcado', pct: 46 } ],
    description: 'La llama de Eros: pasión mediterránea con cítricos ardientes, especias y madera de cedro. Seductor y ardiente.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 13, '5ml': 23, '10ml': 43 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 14,
    name: 'Invictus Parfum',
    brand: 'Paco Rabanne',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Amaderado Marino',
    topNotes: 'Pomelo, Laurel',
    heartNotes: 'Cardamomo negro, Hoja de violeta',
    baseNotes: 'Guayaco, Almizcle, Ámbar',
    accords: [ { name: 'almizclado', pct: 100 }, { name: 'aromático', pct: 99 }, { name: 'jabonoso', pct: 89 }, { name: 'marino', pct: 89 }, { name: 'atalcado', pct: 83 }, { name: 'amaderado', pct: 79 }, { name: 'lavanda', pct: 75 }, { name: 'acuático', pct: 66 }, { name: 'ozónico', pct: 55 }, { name: 'salado', pct: 53 } ],
    description: 'Invictus Parfum: la versión más oscura y poderosa. Cardamomo negro y madera de guayaco crean un ganador sin igual.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 55 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 81,
    name: 'Invictus Victory Elixir',
    brand: 'Paco Rabanne',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Pomelo, Pimienta rosada',
    heartNotes: 'Cardamomo negro, Guayaco',
    baseNotes: 'Vainilla oscura, Ámbar, Almizcle',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'cálido especiado', pct: 70 }, { name: 'ámbar', pct: 63 }, { name: 'aromático', pct: 57 }, { name: 'dulce', pct: 54 }, { name: 'balsámico', pct: 53 }, { name: 'lavanda', pct: 48 }, { name: 'fresco especiado', pct: 47 }, { name: 'ahumado', pct: 45 }, { name: 'atalcado', pct: 44 } ],
    description: 'Invictus Victory Elixir: la versión más intensa e hipnótica del ganador. Cardamomo oscuro y guayaco sobre una base de vainilla y ámbar. Próximamente en MICHT.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 22, '5ml': 33, '10ml': 60 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── FEMENINOS DISEÑADOR ──────────────────────────────────────────────────
  {
    id: 15,
    name: 'Rose N Roses',
    brand: 'Dior',
    type: 'diseñador',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Floral',
    topNotes: 'Rosa de mayo, Rosa damascena, Bergamota',
    heartNotes: 'Rosa de Grasse, Rosa centifolia',
    baseNotes: 'Almizcle, Cedro, Sándalo',
    accords: [ { name: 'rosas', pct: 100 }, { name: 'almizclado', pct: 58 }, { name: 'fresco especiado', pct: 52 }, { name: 'cítrico', pct: 48 }, { name: 'aromático', pct: 39 }, { name: 'atalcado', pct: 31 }, { name: 'florales', pct: 27 }, { name: 'herbáceo', pct: 17 } ],
    description: 'Miss Dior Rose N Roses: un bouquet de rosas luminosas del amanecer. Fresco, radiante y eternamente femenino.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: true,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 16,
    name: 'Q',
    brand: 'Dolce & Gabbana',
    type: 'diseñador',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Floral Amaderado',
    topNotes: 'Bergamota, Mandarina, Pimienta rosa',
    heartNotes: 'Iris, Jazmín, Rosa',
    baseNotes: 'Sándalo, Ámbar, Almizcle',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'atalcado', pct: 48 }, { name: 'acerezado', pct: 44 }, { name: 'almizclado', pct: 41 }, { name: 'amaderado', pct: 38 }, { name: 'dulce', pct: 30 }, { name: 'aromático', pct: 21 }, { name: 'floral blanco', pct: 20 } ],
    description: 'Q by Dolce & Gabbana: sensualidad italiana en cristal. Iris y sándalo se unen en una fragancia femenina sofisticada.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 17,
    name: 'Miss Dior Blooming Bouquet',
    brand: 'Dior',
    type: 'diseñador',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Floral',
    topNotes: 'Mandarina italiana, Peonia',
    heartNotes: 'Rosa de mayo, Peonia',
    baseNotes: 'Almizcle blanco, Cedro, Pachulí',
    accords: [ { name: 'florales', pct: 100 }, { name: 'rosas', pct: 100 }, { name: 'fresco', pct: 66 }, { name: 'afrutados', pct: 44 }, { name: 'almizclado', pct: 38 }, { name: 'cítrico', pct: 35 }, { name: 'atalcado', pct: 34 }, { name: 'dulce', pct: 22 } ],
    description: 'Un bouquet floral delicado y femenino. Peonia y rosa de mayo envueltas en almizcle blanco. Romántico y etéreo.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 18,
    name: 'N°5',
    brand: 'Chanel',
    type: 'diseñador',
    gender: 'mujer',
    occasion: 'ambas',
    olfFamily: 'Floral Aldehídico',
    topNotes: 'Bergamota, Limón, Neroli, Ylang-Ylang',
    heartNotes: 'Jazmín de Grasse, Rosa, Iris',
    baseNotes: 'Vetiver, Sándalo, Vainilla, Almizcle',
    accords: [ { name: 'amaderado', pct: 100 }, { name: 'aldehídico', pct: 79 }, { name: 'fresco', pct: 71 }, { name: 'floral blanco', pct: 68 }, { name: 'atalcado', pct: 56 }, { name: 'terrosos', pct: 53 }, { name: 'floral amarillo', pct: 51 }, { name: 'iris', pct: 43 } ],
    description: 'El perfume más icónico de la historia. Floral aldehídico con jazmín de Grasse y un fondo cálido de sándalo y vainilla.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── ÁRABES — BHARARA, SCEPTRE, AL HARAMAIN ──────────────────────────────
  {
    id: 19,
    name: 'Bharara King',
    brand: 'Bharara Beauty',
    type: 'arabe',
    gender: 'unisex',
    occasion: 'ambas',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Bergamota, Toronja, Nuez moscada',
    heartNotes: 'Pachulí, Cardamomo, Madera de Oud',
    baseNotes: 'Cedro, Almizcle, Ámbar, Vainilla',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'afrutados', pct: 73 }, { name: 'dulce', pct: 62 }, { name: 'avainillado', pct: 53 }, { name: 'atalcado', pct: 45 }, { name: 'almizclado', pct: 43 }, { name: 'ámbar', pct: 35 }, { name: 'fresco especiado', pct: 23 } ],
    description: 'Bharara King: fragancia unisex regia y opulenta. Oud y madera de cedro sobre cítricos brillantes. Para quienes exigen lo mejor.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 20,
    name: 'Sceptre Malachite',
    brand: 'Alhambra',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Aromático Acuático',
    topNotes: 'Menta, Bergamota, Manzana',
    heartNotes: 'Lavanda, Geranio, Especias verdes',
    baseNotes: 'Cedro, Vetiver, Madera de cachemira',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'aromático', pct: 70 }, { name: 'amaderado', pct: 45 }, { name: 'fresco especiado', pct: 33 }, { name: 'afrutados', pct: 33 }, { name: 'almizclado', pct: 31 }, { name: 'ámbar', pct: 29 }, { name: 'especiado suave', pct: 29 } ],
    description: 'Sceptre Malachite: frescura aristocrática con notas acuáticas y especias verdes. Elegante alternativa a fragancias de lujo.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 21,
    name: 'Amber Oud Gold Edition',
    brand: 'Al Haramain',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Azafrán, Rosa',
    heartNotes: 'Oud, Alcanfor',
    baseNotes: 'Ámbar, Sándalo, Almizcle dorado',
    accords: [ { name: 'dulce', pct: 100 }, { name: 'afrutados', pct: 88 }, { name: 'ozónico', pct: 63 }, { name: 'avainillado', pct: 59 }, { name: 'atalcado', pct: 58 }, { name: 'almizclado', pct: 57 }, { name: 'fresco', pct: 56 }, { name: 'acuático', pct: 54 } ],
    description: 'Amber Oud Gold: la esencia del lujo árabe. Azafrán y oud con ámbar dorado. Imponente y sofisticado.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 22,
    name: 'Liquid Brun',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Especiado',
    topNotes: 'Canela, Nuez moscada',
    heartNotes: 'Oud, Rosa',
    baseNotes: 'Ámbar, Vainilla, Almizcle',
    accords: [ { name: 'dulce', pct: 100 }, { name: 'cálido especiado', pct: 98 }, { name: 'avainillado', pct: 95 }, { name: 'canela', pct: 71 }, { name: 'floral blanco', pct: 45 }, { name: 'atalcado', pct: 44 }, { name: 'cítrico', pct: 40 }, { name: 'aromático', pct: 40 } ],
    description: 'Liquid Brun: intensidad oriental con canela encendida, oud ahumado y un fondo de vainilla y ámbar. Irresistiblemente oscuro.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── AFNAN — SERIE 9PM / 9AM ──────────────────────────────────────────────
  {
    id: 23,
    name: '9PM',
    brand: 'Afnan',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Manzana, Bergamota, Especias',
    heartNotes: 'Lavanda, Pachulí, Madera de cachemira',
    baseNotes: 'Vainilla, Ámbar, Almizcle',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'ámbar', pct: 47 }, { name: 'cálido especiado', pct: 43 }, { name: 'afrutados', pct: 39 }, { name: 'canela', pct: 36 }, { name: 'dulce', pct: 36 }, { name: 'lavanda', pct: 34 }, { name: 'fresco', pct: 30 } ],
    description: '9PM: el clon árabe de Stronger With You. Manzana y castaña sobre vainilla cálida. Perfección nocturna a precio accesible.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 24,
    name: '9PM Night Out',
    brand: 'Afnan',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Especiado',
    topNotes: 'Bergamota, Pimienta negra',
    heartNotes: 'Cardamomo, Rosa, Madera especiada',
    baseNotes: 'Oud, Ámbar, Almizcle',
    accords: [ { name: 'amaderado', pct: 100 }, { name: 'afrutados', pct: 88 }, { name: 'cálido especiado', pct: 85 }, { name: 'dulce', pct: 83 }, { name: 'tropical', pct: 67 }, { name: 'aromático', pct: 61 }, { name: 'lavanda', pct: 46 }, { name: 'florales', pct: 44 } ],
    description: '9PM Night Out: versión más oscura y especiada. Pimienta negra y cardamomo con oud y ámbar. La esencia de la noche.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 25,
    name: '9AM Dive',
    brand: 'Afnan',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Acuático Aromático',
    topNotes: 'Cítricos, Menta acuática',
    heartNotes: 'Notas marinas, Lavanda',
    baseNotes: 'Cedro, Almizcle blanco, Ámbar',
    accords: [ { name: 'afrutados', pct: 100 }, { name: 'verde', pct: 96 }, { name: 'amaderado', pct: 94 }, { name: 'cítrico', pct: 81 }, { name: 'fresco especiado', pct: 80 }, { name: 'aromático', pct: 80 }, { name: 'fresco', pct: 73 }, { name: 'especiado suave', pct: 36 } ],
    description: '9AM Dive: frescura oceánica para el día. Menta acuática y notas marinas sobre cedro limpio. Energizante y vigorizante.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 26,
    name: '9PM Elixir',
    brand: 'Afnan',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Cardamomo, Especias oscuras',
    heartNotes: 'Oud, Madera de sándalo',
    baseNotes: 'Ámbar oscuro, Vainilla, Almizcle',
    accords: [ { name: 'cálido especiado', pct: 100 }, { name: 'avainillado', pct: 60 }, { name: 'aromático', pct: 54 }, { name: 'fresco especiado', pct: 50 }, { name: 'cuero', pct: 37 }, { name: 'lavanda', pct: 33 }, { name: 'balsámico', pct: 31 }, { name: 'pachulí', pct: 27 } ],
    description: '9PM Elixir: la versión más intensa de la serie. Especias oscuras y oud con elixir de ámbar y vainilla. Adictivo.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 27,
    name: '9PM Rebel',
    brand: 'Afnan',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Amaderado Especiado',
    topNotes: 'Jengibre, Pimienta roja',
    heartNotes: 'Madera de guayaco, Incienso',
    baseNotes: 'Cuero, Ámbar, Almizcle ahumado',
    accords: [ { name: 'afrutados', pct: 100 }, { name: 'dulce', pct: 88 }, { name: 'amaderado', pct: 73 }, { name: 'tropical', pct: 43 }, { name: 'fresco', pct: 38 }, { name: 'musgoso', pct: 32 }, { name: 'ámbar', pct: 29 }, { name: 'caramelo', pct: 28 } ],
    description: '9PM Rebel: espíritu rebelde con jengibre y cuero ahumado. Amaderado e incandescente. Próximamente disponible.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 28,
    name: 'His Confession',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Especiado',
    topNotes: 'Bergamota, Cardamomo, Pimienta',
    heartNotes: 'Oud, Rosa, Incienso',
    baseNotes: 'Ámbar, Almizcle, Madera',
    accords: [ { name: 'ámbar', pct: 100 }, { name: 'avainillado', pct: 93 }, { name: 'cálido especiado', pct: 63 }, { name: 'atalcado', pct: 59 }, { name: 'iris', pct: 56 }, { name: 'amaderado', pct: 51 }, { name: 'aromático', pct: 34 }, { name: 'balsámico', pct: 33 } ],
    description: 'His Confession Lattafa: una confesión de intensidad oriental. Cardamomo y oud con rosa y ámbar. Declaración de sofisticación.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── LATTAFA — SERIE KHAMRAH ──────────────────────────────────────────────
  {
    id: 29,
    name: 'Khamrah Qahwa',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'unisex',
    occasion: 'ambas',
    olfFamily: 'Oriental Gourmand',
    topNotes: 'Café árabe, Cardamomo',
    heartNotes: 'Incienso, Oud',
    baseNotes: 'Ámbar dorado, Vainilla, Almizcle',
    accords: [ { name: 'cálido especiado', pct: 100 }, { name: 'dulce', pct: 82 }, { name: 'avainillado', pct: 73 }, { name: 'canela', pct: 49 }, { name: 'café', pct: 44 }, { name: 'ámbar', pct: 31 }, { name: 'atalcado', pct: 21 }, { name: 'aromático', pct: 19 } ],
    description: 'Khamrah Qahwa: inspirado en el café árabe tradicional. Cardamomo y café con oud y ámbar dorado. Cálido y reconfortante.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 30,
    name: 'Khamrah Dukhan',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'unisex',
    occasion: 'noche',
    olfFamily: 'Oriental Ahumado',
    topNotes: 'Rosa, Azafrán',
    heartNotes: 'Oud ahumado, Incienso',
    baseNotes: 'Ámbar, Madera de oud, Almizcle',
    accords: [ { name: 'ámbar', pct: 100 }, { name: 'especiado cálido', pct: 92 }, { name: 'dulce', pct: 75 }, { name: 'tabaco', pct: 52 }, { name: 'balsámico', pct: 48 }, { name: 'vainilla', pct: 47 }, { name: 'ahumado', pct: 46 } ],
    description: 'Khamrah Dukhan: el humo del oud árabe en su forma más pura. Rosa y azafrán sobre oud ahumado. Misterioso y poderoso.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 31,
    name: 'Khamrah',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'unisex',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Manzana, Bergamota, Canela',
    heartNotes: 'Rosa, Oud, Sándalo',
    baseNotes: 'Ámbar, Vainilla, Almizcle',
    accords: [ { name: 'dulce', pct: 100 }, { name: 'especiado cálido', pct: 82 }, { name: 'vainilla', pct: 80 }, { name: 'ámbar', pct: 76 }, { name: 'canela', pct: 69 }, { name: 'amaderado', pct: 49 }, { name: 'fresco especiado', pct: 48 }, { name: 'afrutado', pct: 44 } ],
    description: 'Khamrah: el clásico oriental de Lattafa. Manzana y canela sobre rosa y oud. Un viaje sensorial al corazón de Arabia.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  {
    id: 75,
    name: 'Khamrah Waha',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'unisex',
    occasion: 'ambas',
    olfFamily: 'Oriental Frutal Floral',
    topNotes: 'Sandía, Durazno, Cítricos',
    heartNotes: 'Rosa, Jazmín, Lila',
    baseNotes: 'Almizcle, Sándalo, Ámbar',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'vainilla', pct: 94 }, { name: 'fresco especiado', pct: 92 }, { name: 'aromático', pct: 83 }, { name: 'empolvado', pct: 65 }, { name: 'amaderado', pct: 65 }, { name: 'dulce', pct: 62 }, { name: 'ozónico', pct: 57 }, { name: 'verde', pct: 57 }, { name: 'almizclado', pct: 55 } ],
    description: 'Khamrah Waha: la versión fresca y frutal de la icónica línea Khamrah de Lattafa. "Waha" significa oasis — un refugio fragante con frutas jugosas y flores delicadas sobre una base oriental suave. Ideal para el día.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── RASASI — SERIE HAWAS ─────────────────────────────────────────────────
  {
    id: 32,
    name: 'Hawas Fire',
    brand: 'Rasasi',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Especiado',
    topNotes: 'Pimienta roja, Bergamota',
    heartNotes: 'Cardamomo, Vetiver ahumado',
    baseNotes: 'Ámbar, Madera oscura, Almizcle',
    accords: [ { name: 'ámbar', pct: 100 }, { name: 'aromático', pct: 85 }, { name: 'mineral', pct: 66 }, { name: 'marino', pct: 62 }, { name: 'especiado suave', pct: 59 }, { name: 'animal', pct: 55 }, { name: 'floral blanco', pct: 55 }, { name: 'salado', pct: 45 } ],
    description: 'Hawas Fire: la pasión ardiente del oriente. Pimienta roja y cardamomo sobre vetiver ahumado. Intenso, fogoso e irresistible.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 33,
    name: 'Hawas Elixir',
    brand: 'Rasasi',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Bergamota, Lavanda',
    heartNotes: 'Oud, Sándalo',
    baseNotes: 'Ámbar oscuro, Almizcle',
    accords: [ { name: 'vainilla', pct: 100 }, { name: 'aromático', pct: 82 }, { name: 'verde', pct: 70 }, { name: 'dulce', pct: 65 }, { name: 'fresco especiado', pct: 65 }, { name: 'especiado cálido', pct: 59 }, { name: 'ámbar', pct: 59 }, { name: 'chocolate', pct: 56 }, { name: 'lavanda', pct: 54 }, { name: 'empolvado', pct: 51 } ],
    description: 'Hawas Elixir: la esencia más profunda de la línea Hawas. Oud y sándalo con ámbar oscuro. Actualmente agotado.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 34,
    name: 'Hawas Ice',
    brand: 'Rasasi',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Acuático Aromático',
    topNotes: 'Menta ártica, Bergamota, Lima',
    heartNotes: 'Notas acuáticas, Lavanda de hielo',
    baseNotes: 'Cedro, Almizcle blanco, Ambroxan',
    accords: [ { name: 'afrutado', pct: 100 }, { name: 'cítrico', pct: 92 }, { name: 'dulce', pct: 57 }, { name: 'fresco', pct: 54 }, { name: 'aromático', pct: 52 }, { name: 'almizclado', pct: 51 }, { name: 'empolvado', pct: 49 }, { name: 'fresco especiado', pct: 49 }, { name: 'verde', pct: 47 }, { name: 'ámbar', pct: 46 } ],
    description: 'Hawas Ice: frescura glacial del oriente. Menta ártica y bergamota sobre notas acuáticas y cedro limpio. Próximamente.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 13, '5ml': 19, '10ml': 29 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 35,
    name: 'Hawas For Him',
    brand: 'Rasasi',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Acuático Aromático',
    topNotes: 'Limón, Menta, Bergamota',
    heartNotes: 'Geranio, Cardamomo, Notas acuáticas',
    baseNotes: 'Cedro, Vetiver, Almizcle',
    accords: [ { name: 'afrutado', pct: 100 }, { name: 'cítrico', pct: 97 }, { name: 'acuático', pct: 86 }, { name: 'fresco', pct: 80 }, { name: 'especiado cálido', pct: 64 }, { name: 'dulce', pct: 58 }, { name: 'ámbar', pct: 57 }, { name: 'almizclado', pct: 55 }, { name: 'aromático', pct: 55 }, { name: 'animal', pct: 53 } ],
    description: 'Hawas For Him: la fragancia acuática árabe por excelencia. Cítrica y fresca con un corazón especiado. Próximamente.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  {
    id: 76,
    name: 'Hawas Kobra',
    brand: 'Rasasi',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Especiado Amaderado',
    topNotes: 'Bergamota, Cardamomo, Pimienta negra',
    heartNotes: 'Oud, Rosa, Vetiver ahumado',
    baseNotes: 'Ámbar oscuro, Sándalo, Almizcle',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'fresco especiado', pct: 97 }, { name: 'fresco', pct: 75 }, { name: 'almizclado', pct: 70 }, { name: 'amaderado', pct: 61 }, { name: 'verde', pct: 59 }, { name: 'empolvado', pct: 57 }, { name: 'ámbar', pct: 56 }, { name: 'canela', pct: 55 }, { name: 'especiado cálido', pct: 50 } ],
    description: 'Hawas Kobra: la joya más oscura y venenosa de la línea Hawas. Cardamomo y pimienta negra abren paso a un corazón de oud y vetiver ahumado, sellado por ámbar oscuro y sándalo. Intenso, misterioso e hipnótico.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 77,
    name: 'Hawas Chrome',
    brand: 'Rasasi',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Aromático Amaderado',
    topNotes: 'Bergamota, Limón, Mandarina',
    heartNotes: 'Geranio, Cardamomo, Notas metálicas',
    baseNotes: 'Cedro, Sándalo, Almizcle plateado',
    accords: [ { name: 'afrutado', pct: 100 }, { name: 'dulce', pct: 81 }, { name: 'tropical', pct: 67 }, { name: 'almizclado', pct: 56 }, { name: 'empolvado', pct: 53 }, { name: 'ámbar', pct: 53 }, { name: 'acuático', pct: 50 }, { name: 'fresco', pct: 49 } ],
    description: 'Hawas Chrome: la elegancia metálica de la serie Hawas. Fresco y sofisticado con un corazón aromático sobre base amaderada. Próximamente en MICHT.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 78,
    name: 'Hawas Malibu',
    brand: 'Rasasi',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Acuático Frutal',
    topNotes: 'Coco, Piña, Bergamota',
    heartNotes: 'Flor de tiaré, Jazmín tropical',
    baseNotes: 'Almizcle blanco, Sándalo, Ámbar suave',
    accords: [ { name: 'dulce', pct: 100 }, { name: 'ámbar', pct: 84 }, { name: 'cítrico', pct: 80 }, { name: 'afrutado', pct: 77 }, { name: 'empolvado', pct: 69 }, { name: 'vainilla', pct: 61 }, { name: 'almizclado', pct: 59 }, { name: 'iris', pct: 58 }, { name: 'aromático', pct: 58 }, { name: 'amaderado', pct: 56 } ],
    description: 'Hawas Malibu: el paraíso tropical en un frasco. Coco y piña sobre flores de tiaré y un fondo de almizcle cálido. Próximamente en MICHT.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 79,
    name: 'Hawas Tropical',
    brand: 'Rasasi',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Frutal Acuático',
    topNotes: 'Mango, Maracuyá, Lima',
    heartNotes: 'Flor de hibisco, Frangipani',
    baseNotes: 'Almizcle, Cedro, Vainilla tropical',
    accords: [ { name: 'dulce', pct: 100 }, { name: 'verde', pct: 99 }, { name: 'amaderado', pct: 93 }, { name: 'coco', pct: 92 }, { name: 'vainilla', pct: 77 }, { name: 'fresco', pct: 66 }, { name: 'aromático', pct: 66 }, { name: 'empolvado', pct: 65 }, { name: 'lactónico', pct: 64 }, { name: 'afrutado', pct: 61 } ],
    description: 'Hawas Tropical: una explosión de frutas exóticas y flores del trópico. Alegre y fresco, ideal para el clima cálido. Próximamente en MICHT.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 80,
    name: 'Hawas Verde',
    brand: 'Rasasi',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Aromático Verde',
    topNotes: 'Menta, Bergamota, Hoja verde',
    heartNotes: 'Lavanda, Geranio, Salvia',
    baseNotes: 'Vetiver, Cedro, Almizcle fresco',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'aromático', pct: 86 }, { name: 'fresco especiado', pct: 85 }, { name: 'amaderado', pct: 83 }, { name: 'pachulí', pct: 65 }, { name: 'afrutado', pct: 61 }, { name: 'verde', pct: 59 }, { name: 'ámbar', pct: 55 }, { name: 'conífero', pct: 51 }, { name: 'fresco', pct: 49 } ],
    description: 'Hawas Verde: la naturaleza salvaje capturada en un frasco. Menta y hojas verdes sobre lavanda y vetiver limpio. Próximamente en MICHT.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── LATTAFA — SERIE NITRO ────────────────────────────────────────────────
  {
    id: 36,
    name: 'Nitro Red',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Especiado',
    topNotes: 'Pimienta roja, Bergamota',
    heartNotes: 'Rosa, Madera especiada',
    baseNotes: 'Ámbar, Cuero, Almizcle',
    accords: [ { name: 'amaderado', pct: 100 }, { name: 'ozónico', pct: 96 }, { name: 'acuático', pct: 94 }, { name: 'afrutado', pct: 84 }, { name: 'lavanda', pct: 69 }, { name: 'ámbar', pct: 68 }, { name: 'fresco especiado', pct: 65 }, { name: 'cítrico', pct: 61 }, { name: 'aromático', pct: 60 }, { name: 'especiado cálido', pct: 59 } ],
    description: 'Nitro Red: potencia y pasión en cada spray. Pimienta roja y cuero sobre ámbar oscuro. Próximamente.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 37,
    name: 'Nitro Elixir',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Especias oscuras, Bergamota',
    heartNotes: 'Oud, Incienso',
    baseNotes: 'Ámbar líquido, Almizcle, Vainilla',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'ámbar', pct: 94 }, { name: 'aromático', pct: 84 }, { name: 'dulce', pct: 83 }, { name: 'fresco especiado', pct: 77 }, { name: 'floral blanco', pct: 72 }, { name: 'especiado cálido', pct: 65 }, { name: 'verde', pct: 60 }, { name: 'animal', pct: 59 }, { name: 'afrutado', pct: 51 } ],
    description: 'Nitro Elixir: el más intenso de la serie Nitro. Oud e incienso sobre ámbar líquido. Próximamente en MICHT.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 14, '5ml': 19, '10ml': 29 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 38,
    name: 'Nitro Gold',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Bergamota, Especias doradas',
    heartNotes: 'Sándalo, Madera de oud',
    baseNotes: 'Ámbar dorado, Almizcle',
    accords: [ { name: 'amaderado', pct: 100 }, { name: 'marino', pct: 73 }, { name: 'afrutado', pct: 70 }, { name: 'salado', pct: 69 }, { name: 'dulce', pct: 63 }, { name: 'aromático', pct: 62 }, { name: 'cítrico', pct: 59 }, { name: 'especiado cálido', pct: 54 }, { name: 'fresco especiado', pct: 53 }, { name: 'ámbar', pct: 53 } ],
    description: 'Nitro Gold: elegancia dorada con sándalo y ámbar. Opulento y distinguido.',
    imageUrl: '/img PERFUMES/Nitro Gold.jpg',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── LATTAFA — ASAD ───────────────────────────────────────────────────────
  {
    id: 39,
    name: 'Asad Elixir',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Especiado',
    topNotes: 'Pimienta negra, Bergamota',
    heartNotes: 'Vetiver, Oud ahumado',
    baseNotes: 'Cuero, Ámbar, Almizcle',
    accords: [ { name: 'ámbar', pct: 100 }, { name: 'amaderado', pct: 90 }, { name: 'tabaco', pct: 83 }, { name: 'avainillado', pct: 69 }, { name: 'dulce', pct: 67 }, { name: 'cálido especiado', pct: 66 }, { name: 'atalcado', pct: 61 }, { name: 'especiado suave', pct: 54 }, { name: 'pachulí', pct: 52 }, { name: 'fresco especiado', pct: 49 } ],
    description: 'Asad Elixir: el rugido del oriente. Pimienta negra sobre vetiver y oud ahumado. Actualmente agotado.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 40,
    name: 'Asad Bourbon',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Gourmand',
    topNotes: 'Bourbon, Especias',
    heartNotes: 'Madera de cedro, Pachulí',
    baseNotes: 'Vainilla ahumada, Cuero, Ámbar',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'cacao', pct: 91 }, { name: 'dulce', pct: 76 }, { name: 'lavanda', pct: 76 }, { name: 'fresco especiado', pct: 70 }, { name: 'cálido especiado', pct: 66 }, { name: 'ámbar', pct: 65 }, { name: 'aromático', pct: 63 }, { name: 'atalcado', pct: 59 }, { name: 'especiado suave', pct: 57 } ],
    description: 'Asad Bourbon: notas de bourbon, cuero y vainilla ahumada. Masculino y opulento. Próximamente.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── ARMAF — SERIE ODYSSEY ────────────────────────────────────────────────
  {
    id: 41,
    name: 'Mandarin Sky',
    brand: 'Armaf Odyssey',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Cítrico Aromático',
    topNotes: 'Mandarina, Naranja, Bergamota',
    heartNotes: 'Lavanda, Geranio',
    baseNotes: 'Cedro, Almizcle, Ámbar',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'caramelo', pct: 75 }, { name: 'dulce', pct: 73 }, { name: 'ámbar', pct: 57 }, { name: 'aromático', pct: 54 }, { name: 'avainillado', pct: 48 }, { name: 'amaderado', pct: 46 } ],
    description: 'Odyssey Mandarin Sky: cítricos solares y mandarina brillante. Fresco y energético para el día a día.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 42,
    name: 'Odyssey Mega',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Aromático Amaderado',
    topNotes: 'Bergamota, Limón, Grosella negra',
    heartNotes: 'Lavanda, Madera de oud',
    baseNotes: 'Cedro, Vetiver, Almizcle',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'aromático', pct: 85 }, { name: 'fresco especiado', pct: 80 }, { name: 'dulce', pct: 54 }, { name: 'amaderado', pct: 54 }, { name: 'fresco', pct: 49 }, { name: 'verde', pct: 47 }, { name: 'almizclado', pct: 46 }, { name: 'afrutados', pct: 46 } ],
    description: 'Odyssey Mega: potencia y frescura combinadas. Inspirado en Aventus, a precio accesible. Popular y muy versátil.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 43,
    name: 'Odyssey Aqua',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Acuático Aromático',
    topNotes: 'Lima, Bergamota, Notas marinas',
    heartNotes: 'Notas acuáticas, Lavanda',
    baseNotes: 'Cedro, Almizcle blanco, Ámbar',
    accords: [ { name: 'aromático', pct: 100 }, { name: 'cítrico', pct: 89 }, { name: 'fresco especiado', pct: 88 }, { name: 'verde', pct: 74 }, { name: 'amaderado', pct: 61 }, { name: 'ámbar', pct: 58 }, { name: 'herbal', pct: 53 }, { name: 'lavanda', pct: 51 }, { name: 'pachulí', pct: 48 }, { name: 'almizclado', pct: 47 } ],
    description: 'Odyssey Aqua: la versión más fresca y marina. Lima y notas acuáticas sobre cedro limpio. Perfecto para el calor.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 44,
    name: 'Odyssey White',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Aromático Amaderado',
    topNotes: 'Bergamota, Manzana, Cedro',
    heartNotes: 'Madera de cachemira, Especias blancas',
    baseNotes: 'Almizcle blanco, Ámbar, Sándalo',
    accords: [ { name: 'amaderado', pct: 100 }, { name: 'aromático', pct: 82 }, { name: 'avainillado', pct: 80 }, { name: 'ámbar', pct: 79 }, { name: 'cálido especiado', pct: 78 }, { name: 'especiado suave', pct: 64 }, { name: 'dulce', pct: 52 }, { name: 'atalcado', pct: 51 }, { name: 'marino', pct: 46 } ],
    description: 'Odyssey White: elegancia limpia con especias blancas y madera de cachemira. Sofisticado y versátil.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 45,
    name: 'Odyssey Limoni',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Cítrico Aromático',
    topNotes: 'Limón siciliano, Bergamota',
    heartNotes: 'Hierbas aromáticas, Geranio',
    baseNotes: 'Cedro, Almizcle, Vetiver',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'fresco especiado', pct: 46 }, { name: 'aromático', pct: 46 }, { name: 'fresco', pct: 43 }, { name: 'verde', pct: 42 } ],
    description: 'Odyssey Limoni: explosión de limón siciliano con hierbas aromáticas frescas. Actualmente agotado.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 46,
    name: 'Odyssey Mango',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'unisex',
    occasion: 'dia',
    olfFamily: 'Frutal Floral',
    topNotes: 'Mango tropical, Melocotón, Bergamota',
    heartNotes: 'Flor de mango, Jazmín',
    baseNotes: 'Almizcle, Cedro, Ámbar suave',
    accords: [ { name: 'tropical', pct: 100 }, { name: 'afrutados', pct: 89 }, { name: 'dulce', pct: 86 }, { name: 'amaderado', pct: 65 }, { name: 'cítrico', pct: 57 }, { name: 'avainillado', pct: 57 }, { name: 'ámbar', pct: 54 }, { name: 'terpénico', pct: 52 }, { name: 'floral blanco', pct: 48 }, { name: 'almizclado', pct: 48 } ],
    description: 'Odyssey Mango: tropical y jugoso. Mango fresco y melocotón sobre flores tropicales. Fresco y alegre para el día.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 87,
    name: 'Odyssey Bahamas',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'unisex',
    occasion: 'dia',
    olfFamily: 'Frutal Floral',
    topNotes: 'Piña, Coco, Bergamota',
    heartNotes: 'Flor de tiaré, Jazmín',
    baseNotes: 'Almizcle, Ámbar suave, Sándalo',
    accords: [ { name: 'marino', pct: 100 }, { name: 'acuático', pct: 96 }, { name: 'afrutados', pct: 81 }, { name: 'dulce', pct: 67 }, { name: 'salado', pct: 67 }, { name: 'fresco', pct: 65 }, { name: 'ozónico', pct: 58 }, { name: 'aromático', pct: 56 }, { name: 'ámbar', pct: 49 }, { name: 'almizclado', pct: 48 } ],
    description: 'Odyssey Bahamas: un viaje tropical caribeño — piña y coco sobre flores blancas. Fresco, dulce y veraniego.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 88,
    name: 'Odyssey Artisto',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Amaderado Especiado',
    topNotes: 'Bergamota, Pimienta rosa',
    heartNotes: 'Especias, Cuero',
    baseNotes: 'Oud, Ámbar, Almizcle',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'coco', pct: 79 }, { name: 'dulce', pct: 74 }, { name: 'ámbar', pct: 72 }, { name: 'tropical', pct: 71 }, { name: 'cítrico', pct: 63 }, { name: 'aromático', pct: 61 }, { name: 'nueces', pct: 60 }, { name: 'cálido especiado', pct: 54 }, { name: 'canela', pct: 53 } ],
    description: 'Odyssey Artisto: una composición amaderada y especiada con carácter. Elegante y magnético para el día a día.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 89,
    name: 'Odyssey Mandarin Sky Elixir',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Cítrico',
    topNotes: 'Mandarina, Naranja sanguina, Bergamota',
    heartNotes: 'Azafrán, Geranio, Lavanda',
    baseNotes: 'Ámbar intenso, Oud, Almizcle cálido',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'avainillado', pct: 85 }, { name: 'dulce', pct: 75 }, { name: 'caramelo', pct: 66 }, { name: 'cálido especiado', pct: 59 }, { name: 'aromático', pct: 59 }, { name: 'ámbar', pct: 52 }, { name: 'balsámico', pct: 50 }, { name: 'fresco especiado', pct: 50 }, { name: 'lavanda', pct: 50 } ],
    description: 'Odyssey Mandarin Sky Elixir: la versión intensificada de Mandarin Sky — el mismo cítrico solar, ahora con más cuerpo, ámbar y profundidad para la noche.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── KING OF KINGS ────────────────────────────────────────────────────────
  {
    id: 90,
    name: 'King of Kings Chapter 1',
    brand: 'King of Kings',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Bergamota, Manzana especiada',
    heartNotes: 'Oud, Rosa oscura',
    baseNotes: 'Ámbar, Almizcle, Vainilla',
    accords: [ { name: 'dulce', pct: 100 }, { name: 'tropical', pct: 90 }, { name: 'afrutados', pct: 88 }, { name: 'coco', pct: 68 }, { name: 'ámbar', pct: 68 }, { name: 'amaderado', pct: 67 }, { name: 'aromático', pct: 65 }, { name: 'ron', pct: 64 }, { name: 'marino', pct: 64 }, { name: 'atalcado', pct: 57 } ],
    description: 'King of Kings Chapter 1: apertura de la colección — oud y ámbar con un toque especiado. Imponente y versátil.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 91,
    name: 'King of Kings Nebula',
    brand: 'King of Kings',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Ahumado',
    topNotes: 'Cardamomo, Bergamota',
    heartNotes: 'Incienso, Oud ahumado',
    baseNotes: 'Ámbar, Almizcle, Madera seca',
    description: 'King of Kings Nebula: un oriental ahumado y envolvente, como un cielo nocturno cargado de incienso y ámbar profundo.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── OTROS ÁRABES ─────────────────────────────────────────────────────────
  {
    id: 47,
    name: 'Eter Arabian Sky',
    brand: 'Eter',
    type: 'arabe',
    gender: 'unisex',
    occasion: 'ambas',
    olfFamily: 'Oriental Floral',
    topNotes: 'Bergamota, Rosa, Azafrán',
    heartNotes: 'Oud, Jazmín, Incienso',
    baseNotes: 'Ámbar, Almizcle, Sándalo dorado',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'fresco especiado', pct: 79 }, { name: 'aromático', pct: 72 }, { name: 'dulce', pct: 69 }, { name: 'amaderado', pct: 66 }, { name: 'afrutados', pct: 49 }, { name: 'caramelo', pct: 46 }, { name: 'lavanda', pct: 46 }, { name: 'ámbar', pct: 45 }, { name: 'almizclado', pct: 45 } ],
    description: 'Eter Arabian Sky: el cielo árabe en una fragancia. Rosa y azafrán sobre oud y sándalo dorado. Próximamente.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 14, '5ml': 19, '10ml': 29 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 48,
    name: 'Aruba Gold',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Floral Frutal',
    topNotes: 'Frutas tropicales, Bergamota',
    heartNotes: 'Gardenia, Jazmín, Rosa',
    baseNotes: 'Almizcle, Cedro, Vainilla',
    description: 'Aruba Gold: luminosidad tropical con flores y frutas doradas. Femenino, fresco y lleno de alegría.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── FEMENINOS ÁRABES ─────────────────────────────────────────────────────
  {
    id: 49,
    name: 'Eclaire Banoffi',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Gourmand Floral',
    topNotes: 'Caramelo, Vainilla, Bergamota',
    heartNotes: 'Toffee, Banana, Flor de durazno',
    baseNotes: 'Sándalo, Almizcle suave, Vainilla cremosa',
    accords: [ { name: 'dulce', pct: 100 }, { name: 'avainillado', pct: 42 }, { name: 'lactónico', pct: 32 }, { name: 'afrutados', pct: 31 }, { name: 'tropical', pct: 20 }, { name: 'atalcado', pct: 13 }, { name: 'almizclado', pct: 9 }, { name: 'verde', pct: 9 } ],
    description: 'Eclaire Banoffi: inspirado en el postre banoffi. Caramelo, banana y toffee en una deliciosa fragancia femenina.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 50,
    name: 'Odyssey Candee',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Gourmand Floral',
    topNotes: 'Frutas dulces, Bergamota',
    heartNotes: 'Peonia, Rosa, Jazmín',
    baseNotes: 'Almizcle, Vainilla, Sándalo',
    accords: [ { name: 'afrutados', pct: 100 }, { name: 'dulce', pct: 83 }, { name: 'pachulí', pct: 41 }, { name: 'caramelo', pct: 31 }, { name: 'amaderado', pct: 26 }, { name: 'almizclado', pct: 26 }, { name: 'cálido especiado', pct: 25 }, { name: 'fresco especiado', pct: 24 } ],
    description: 'Odyssey Candee: dulzura floral en un frasco adorable. Frutas y flores sobre almizcle suave. Alegre y femenino.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 51,
    name: 'Eclaire',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Floral Oriental',
    topNotes: 'Bergamota, Fresas',
    heartNotes: 'Jazmín, Rosa, Lila',
    baseNotes: 'Almizcle, Vainilla, Sándalo',
    accords: [ { name: 'dulce', pct: 100 }, { name: 'avainillado', pct: 58 }, { name: 'caramelo', pct: 48 }, { name: 'lactónico', pct: 43 }, { name: 'amielado', pct: 21 }, { name: 'atalcado', pct: 20 }, { name: 'almizclado', pct: 12 }, { name: 'balsámico', pct: 11 } ],
    description: 'Eclaire: flores suaves y frutas rojas sobre un fondo cálido de vainilla. Delicado y tentador.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 52,
    name: 'Eclaire Pistache',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Gourmand Floral',
    topNotes: 'Pistacho, Almendra, Bergamota',
    heartNotes: 'Flor de almendro, Jazmín',
    baseNotes: 'Vainilla, Sándalo cremoso, Almizcle',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'dulce', pct: 77 }, { name: 'lactónico', pct: 68 }, { name: 'cacao', pct: 52 }, { name: 'amaderado', pct: 32 }, { name: 'nueces', pct: 31 }, { name: 'cálido especiado', pct: 31 }, { name: 'atalcado', pct: 28 } ],
    description: 'Eclaire Pistache: gourmand irresistible con pistacho y almendra. Cremoso, floral y deliciosamente único.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 53,
    name: 'Stallion Donna Intense',
    brand: 'Stallion',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'noche',
    olfFamily: 'Oriental Floral',
    topNotes: 'Bergamota, Durazno',
    heartNotes: 'Rosa turca, Jazmín, Iris',
    baseNotes: 'Ámbar, Almizcle, Vainilla',
    description: 'Stallion Donna Intense: feminidad apasionada con rosa turca y durazno sobre ámbar. Sensual e intenso.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── LATTAFA — SERIE YARA ─────────────────────────────────────────────────
  {
    id: 54,
    name: 'Yara Elixir',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'noche',
    olfFamily: 'Oriental Floral',
    topNotes: 'Frutas rojas, Bergamota',
    heartNotes: 'Rosa, Jazmín, Oud suave',
    baseNotes: 'Ámbar, Almizcle, Vainilla',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'caramelo', pct: 92 }, { name: 'dulce', pct: 71 }, { name: 'floral blanco', pct: 69 }, { name: 'atalcado', pct: 59 }, { name: 'afrutados', pct: 56 }, { name: 'ámbar', pct: 46 }, { name: 'almizclado', pct: 43 } ],
    description: 'Yara Elixir: la versión más intensa de Yara. Rosa y oud suave sobre ámbar y vainilla. Seductora y apasionada.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 55,
    name: 'Yara Moi',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Floral Frutal',
    topNotes: 'Bergamota, Durazno, Mandarina',
    heartNotes: 'Magnolia, Jazmín, Rosa',
    baseNotes: 'Almizcle blanco, Cedro, Ámbar suave',
    accords: [ { name: 'amaderado', pct: 100 }, { name: 'floral blanco', pct: 96 }, { name: 'pachulí', pct: 73 }, { name: 'cálido especiado', pct: 59 }, { name: 'caramelo', pct: 56 }, { name: 'atalcado', pct: 46 }, { name: 'ámbar', pct: 42 }, { name: 'afrutados', pct: 42 } ],
    description: 'Yara Moi: delicadeza floral con durazno y magnolia. Fresca y romántica, ideal para el día.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 56,
    name: 'Yara Rosa',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Floral',
    topNotes: 'Rosa, Bergamota, Frutas',
    heartNotes: 'Rosa damascena, Magnolia',
    baseNotes: 'Almizcle rosado, Cedro, Ámbar',
    description: 'Yara Rosa: un homenaje a la rosa en toda su belleza. Suave, floral y eternamente femenino.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── AFNAN — FEMENINOS ────────────────────────────────────────────────────
  {
    id: 57,
    name: '9PM Pour Femme',
    brand: 'Afnan',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'noche',
    olfFamily: 'Floral Oriental',
    topNotes: 'Bergamota, Frutas, Bayas',
    heartNotes: 'Jazmín, Rosa, Peonia',
    baseNotes: 'Almizcle, Vainilla, Sándalo',
    accords: [ { name: 'amaderado', pct: 100 }, { name: 'afrutados', pct: 64 }, { name: 'rosas', pct: 64 }, { name: 'florales', pct: 57 }, { name: 'atalcado', pct: 50 }, { name: 'aromático', pct: 49 }, { name: 'violeta', pct: 49 }, { name: 'fresco', pct: 44 } ],
    description: '9PM Pour Femme: la versión femenina de 9PM. Flores suaves y frutas sobre vainilla y almizcle. Para una noche perfecta.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 58,
    name: '9AM Pour Femme',
    brand: 'Afnan',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Floral Frutal',
    topNotes: 'Mandarina, Bergamota, Pomelo',
    heartNotes: 'Rosa, Peonia, Jazmín',
    baseNotes: 'Almizcle blanco, Cedro, Ámbar',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'afrutados', pct: 87 }, { name: 'dulce', pct: 51 }, { name: 'almizclado', pct: 47 }, { name: 'ámbar', pct: 42 }, { name: 'atalcado', pct: 32 }, { name: 'fresco especiado', pct: 28 }, { name: 'animálico', pct: 20 } ],
    description: '9AM Pour Femme: frescura matutina con cítricos y flores primaverales. Ideal para empezar el día con energía.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 59,
    name: 'Delilah',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Floral Oriental',
    topNotes: 'Mandarina, Bergamota',
    heartNotes: 'Rosa, Jazmín, Iris',
    baseNotes: 'Almizcle, Vainilla, Sándalo',
    accords: [ { name: 'rosas', pct: 100 }, { name: 'florales', pct: 64 }, { name: 'afrutados', pct: 59 }, { name: 'almizclado', pct: 52 }, { name: 'fresco', pct: 47 }, { name: 'atalcado', pct: 40 }, { name: 'verde', pct: 36 }, { name: 'aromático', pct: 30 } ],
    description: 'Delilah: suavidad floral con rosa y jazmín sobre almizcle y vainilla. Femenino y delicado. Actualmente agotado.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── LATTAFA — BADEE AL OUD ───────────────────────────────────────────────
  {
    id: 82,
    name: 'Badee Al Oud Sublime',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'unisex',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Azafrán, Bergamota',
    heartNotes: 'Oud, Rosa, Incienso',
    baseNotes: 'Ámbar, Sándalo, Almizcle oscuro',
    accords: [ { name: 'afrutados', pct: 100 }, { name: 'fresco', pct: 45 }, { name: 'tropical', pct: 24 }, { name: 'rosas', pct: 23 }, { name: 'verde', pct: 21 }, { name: 'terrosos', pct: 21 }, { name: 'musgoso', pct: 21 }, { name: 'avainillado', pct: 20 } ],
    description: 'Badee Al Oud Sublime: la sublimidad del oud árabe en toda su gloria. Azafrán y rosa sobre un corazón de oud profundo con base de ámbar y sándalo. Próximamente en MICHT.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── ARMAF — CLUB DE NUIT ─────────────────────────────────────────────────
  {
    id: 83,
    name: 'Club de Nuit Intense',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Frutal Amaderado Ahumado',
    topNotes: 'Piña, Pomelo, Bergamota, Manzana',
    heartNotes: 'Rosa, Abedul, Jazmín',
    baseNotes: 'Almizcle, Ámbar, Pachulí, Cedro de Virginia',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'afrutados', pct: 58 }, { name: 'cuero', pct: 46 }, { name: 'ahumado', pct: 36 }, { name: 'amaderado', pct: 36 }, { name: 'aromático', pct: 34 }, { name: 'dulce', pct: 31 }, { name: 'fresco', pct: 30 } ],
    description: 'Club de Nuit Intense: el legendario clon de Aventus. Piña ahumada y frutas sobre abedul y cedro. Éxito rotundo, proyección bestial. Próximamente en MICHT.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },

  // ─── AL WATANIAH — GAME OF SPADES ─────────────────────────────────────────
  {
    id: 84,
    name: 'Game Of Spades Full House',
    brand: 'Al Wataniah',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Especiado Amaderado',
    topNotes: 'Bergamota, Pimienta negra, Especias',
    heartNotes: 'Oud, Rosa, Sándalo',
    baseNotes: 'Ámbar oscuro, Vainilla, Almizcle',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'fresco especiado', pct: 57 }, { name: 'ámbar', pct: 45 }, { name: 'fresco', pct: 39 }, { name: 'verde', pct: 29 }, { name: 'amaderado', pct: 22 }, { name: 'almizclado', pct: 19 }, { name: 'cálido especiado', pct: 15 } ],
    description: 'Game Of Spades Full House: la mano ganadora del oriente. Especias intensas y oud sobre una base de ámbar y vainilla. Próximamente en MICHT.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 18, '5ml': 26, '10ml': 45 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 85,
    name: 'Game Of Spades Wildcard 3.4',
    brand: 'Al Wataniah',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Pimienta, Cítricos, Cardamomo',
    heartNotes: 'Oud, Vetiver, Geranio',
    baseNotes: 'Almizcle, Ámbar, Cuero',
    accords: [ { name: 'ámbar', pct: 100 }, { name: 'avainillado', pct: 79 }, { name: 'florales', pct: 70 }, { name: 'afrutados', pct: 46 }, { name: 'amaderado', pct: 44 }, { name: 'cítrico', pct: 42 }, { name: 'aromático', pct: 40 }, { name: 'almizclado', pct: 34 } ],
    description: 'Game Of Spades Wildcard 3.4: la carta salvaje del juego. Oud y vetiver sobre cuero y ámbar. Audaz, impredecible y magnético. Próximamente en MICHT.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 17, '5ml': 24, '10ml': 40 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 86,
    name: 'Acqua di Giò Profondo',
    brand: 'Giorgio Armani',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'dia',
    olfFamily: 'Aromático Acuático',
    topNotes: 'Notas marinas, Aquozone, Mandarina verde, Bergamota',
    heartNotes: 'Romero, Lavanda, Ciprés, Lentisco',
    baseNotes: 'Pachulí, Almizcle, Ámbar mineral',
    accords: [ { name: 'marino', pct: 100 }, { name: 'aromático', pct: 98 }, { name: 'cítrico', pct: 81 }, { name: 'fresco especiado', pct: 67 }, { name: 'fresco', pct: 65 }, { name: 'amaderado', pct: 61 }, { name: 'mineral', pct: 59 }, { name: 'salado', pct: 47 }, { name: 'lavanda', pct: 45 } ],
    description: 'Acqua di Giò Profondo: la intensidad del mar en una botella. Notas marinas y mandarina verde sobre un fondo mineral de pachulí y almizcle. Fresco, profundo y sumamente masculino.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 92,
    name: 'Maleka',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'ambas',
    olfFamily: 'Floral Oriental',
    topNotes: 'Pera, Grosella negra, Bergamota',
    heartNotes: 'Rosa turca, Fresia, Jazmín',
    baseNotes: 'Vainilla, Almizcle, Sándalo, Ámbar',
    description: 'Maleka: elegancia floral oriental digna de una reina. Pera y grosella negra sobre rosa turca y jazmín, con un fondo cálido de vainilla y ámbar. Femenino y sofisticado.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 93,
    name: 'The Kingdom Dama',
    brand: 'Ard Al Zaafaran',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Amaderado',
    topNotes: 'Bergamota, Manzana, Especias',
    heartNotes: 'Oud, Rosa, Azafrán',
    baseNotes: 'Ámbar, Almizcle, Madera de sándalo',
    description: 'The Kingdom Dama: un oriental amaderado con porte real. Especias y manzana sobre oud y rosa, cerrando con ámbar y sándalo profundo. Imponente y elegante.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 94,
    name: 'Nebras',
    brand: 'Lattafa',
    type: 'arabe',
    gender: 'unisex',
    occasion: 'ambas',
    olfFamily: 'Oriental Frutal',
    topNotes: 'Pera, Manzana, Canela',
    heartNotes: 'Rosa, Oud',
    baseNotes: 'Ámbar, Vainilla, Almizcle',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'dulce', pct: 96 }, { name: 'cacao', pct: 64 }, { name: 'cálido especiado', pct: 55 }, { name: 'ámbar', pct: 54 }, { name: 'afrutados', pct: 54 }, { name: 'atalcado', pct: 51 } ],
    description: 'Nebras: un oriental frutal cálido y acogedor. Pera y canela sobre rosa y oud, con un fondo de ámbar y vainilla. Versátil para cualquier ocasión.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 95,
    name: 'Valentino Extradose',
    brand: 'Valentino',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Amaderado Aromático',
    topNotes: 'Bergamota, Pimienta rosa',
    heartNotes: 'Salvia, Geranio',
    baseNotes: 'Cedro, Ámbar, Almizcle',
    accords: [ { name: 'lavanda', pct: 100 }, { name: 'amaderado', pct: 69 }, { name: 'cálido especiado', pct: 67 }, { name: 'aromático', pct: 58 }, { name: 'fresco especiado', pct: 51 } ],
    description: 'Valentino Extradose: una dosis concentrada de la elegancia Born in Roma. Bergamota y pimienta rosa sobre un fondo amaderado de cedro y ámbar. Fresco e intenso a la vez.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 96,
    name: 'Yum Yum',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'mujer',
    occasion: 'dia',
    olfFamily: 'Gourmand Frutal',
    topNotes: 'Pera, Bergamota, Piña',
    heartNotes: 'Algodón de azúcar, Jazmín, Lavanda',
    baseNotes: 'Vainilla, Almizcle, Maderas suaves',
    accords: [ { name: 'afrutados', pct: 100 }, { name: 'atalcado', pct: 96 }, { name: 'acerezado', pct: 71 }, { name: 'amaderado', pct: 70 }, { name: 'rosas', pct: 66 }, { name: 'dulce', pct: 65 }, { name: 'avainillado', pct: 62 }, { name: 'cítrico', pct: 61 }, { name: 'floral blanco', pct: 59 }, { name: 'almizclado', pct: 57 } ],
    description: 'Yum Yum: un gourmand dulce y juguetón. Piña y algodón de azúcar sobre flores suaves, cerrando con vainilla y almizcle. Divertido, fresco y delicioso.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 97,
    name: 'Scandal Le Parfum',
    brand: 'Jean Paul Gaultier',
    type: 'diseñador',
    gender: 'mujer',
    occasion: 'noche',
    olfFamily: 'Ambarado Floral',
    topNotes: 'Naranja sanguina',
    heartNotes: 'Miel, Tuberosa',
    baseNotes: 'Pachulí, Cera de abejas',
    accords: [ { name: 'caramelo', pct: 100 }, { name: 'avainillado', pct: 96 }, { name: 'floral blanco', pct: 79 }, { name: 'dulce', pct: 71 }, { name: 'salado', pct: 54 }, { name: 'atalcado', pct: 50 }, { name: 'balsámico', pct: 47 } ],
    description: 'Scandal Le Parfum: la versión más intensa y sensual de Scandal. Naranja sanguina sobre miel y tuberosa, cerrando con pachulí y cera de abejas. Seductor y magnético.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 100,
    bottleTotalMl: 100
  },
  {
    id: 98,
    name: 'Tag',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Aromático Especiado',
    topNotes: 'Manzana, Bergamota, Pimienta rosa',
    heartNotes: 'Canela, Salvia, Geranio',
    baseNotes: 'Ámbar, Almizcle, Madera de cedro',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'cálido especiado', pct: 90 }, { name: 'aromático', pct: 61 }, { name: 'ámbar', pct: 61 }, { name: 'dulce', pct: 54 }, { name: 'fresco especiado', pct: 52 }, { name: 'lavanda', pct: 52 }, { name: 'balsámico', pct: 51 } ],
    description: 'Armaf Tag Uomo Rosso: audaz y especiado desde la primera rociada, con un fondo amaderado y ambarino envolvente. Versátil para cualquier ocasión.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 99,
    name: '1 Million Night Elixir',
    brand: 'Paco Rabanne',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Especiado',
    topNotes: 'Mandarina, Pomelo rosa',
    heartNotes: 'Canela, Rosa, Especias oscuras',
    baseNotes: 'Cuero, Pachulí, Ámbar dorado',
    accords: [ { name: 'ámbar', pct: 100 }, { name: 'dulce', pct: 96 }, { name: 'avainillado', pct: 94 }, { name: 'cálido especiado', pct: 84 }, { name: 'canela', pct: 72 }, { name: 'cítrico', pct: 65 }, { name: 'afrutados', pct: 57 }, { name: 'balsámico', pct: 51 }, { name: 'atalcado', pct: 46 } ],
    description: '1 Million Night Elixir: la versión más intensa y nocturna del icónico 1 Million. Especias cálidas y cuero envuelven un fondo ambarino dorado, para una noche de poder absoluto.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 100,
    name: 'Odyssey Nexus',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'ambas',
    olfFamily: 'Aromático Amaderado',
    topNotes: 'Bergamota, Manzana verde, Menta',
    heartNotes: 'Lavanda, Geranio, Especias',
    baseNotes: 'Cedro, Vetiver, Almizcle',
    accords: [ { name: 'aromático', pct: 100 }, { name: 'fresco especiado', pct: 84 }, { name: 'amaderado', pct: 77 }, { name: 'cítrico', pct: 76 }, { name: 'marino', pct: 73 }, { name: 'pachulí', pct: 56 }, { name: 'ámbar', pct: 52 }, { name: 'cálido especiado', pct: 51 }, { name: 'salado', pct: 47 }, { name: 'herbal', pct: 45 } ],
    description: 'Odyssey Nexus: fresco y aromático con un carácter urbano y auténtico, inspirado en el estilo denim de su frasco. Ideal para el día a día.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 101,
    name: 'Uomo Intense',
    brand: 'Stallion',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Amaderado Aromático',
    topNotes: 'Bergamota, Pimienta negra',
    heartNotes: 'Lavanda, Salvia',
    baseNotes: 'Almizcle, Ámbar, Cedro',
    accords: [ { name: 'amaderado', pct: 100 }, { name: 'aromático', pct: 89 }, { name: 'lavanda', pct: 87 }, { name: 'avainillado', pct: 55 }, { name: 'ámbar', pct: 54 }, { name: 'fresco especiado', pct: 51 }, { name: 'marino', pct: 49 }, { name: 'terrosos', pct: 49 }, { name: 'atalcado', pct: 47 }, { name: 'acuático', pct: 45 } ],
    description: 'Uomo Intense by Stallion: masculinidad pura e intensa. Bergamota y pimienta negra se funden con lavanda sobre una base amaderada envolvente.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 102,
    name: 'Club de Nuit Urban Man Elixir',
    brand: 'Armaf',
    type: 'arabe',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Aromático Amaderado',
    topNotes: 'Bergamota, Lima, Manzana',
    heartNotes: 'Jazmín, Flor de azahar, Especias',
    baseNotes: 'Ámbar, Almizcle, Maderas oscuras',
    accords: [ { name: 'ámbar', pct: 100 }, { name: 'aromático', pct: 82 }, { name: 'cítrico', pct: 74 }, { name: 'fresco especiado', pct: 73 }, { name: 'almizclado', pct: 67 }, { name: 'amaderado', pct: 66 }, { name: 'lavanda', pct: 58 }, { name: 'especiado suave', pct: 54 }, { name: 'cálido especiado', pct: 46 }, { name: 'herbal', pct: 46 } ],
    description: 'Club de Nuit Urban Man Elixir: la versión intensificada y urbana de Club de Nuit. Cítricos vibrantes sobre un corazón floral-especiado, cerrando con ámbar y maderas oscuras. Elegante y con gran proyección.',
    imageUrl: '',
    sizes: { '2ml': 0, '3ml': 12, '5ml': 17, '10ml': 27 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 103,
    name: '212 VIP Black Elixir',
    brand: 'Carolina Herrera',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Oriental Fougère',
    topNotes: 'Lavanda',
    heartNotes: 'Regaliz negro',
    baseNotes: 'Vainilla',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'especiado suave', pct: 80 }, { name: 'dulce', pct: 54 }, { name: 'lavanda', pct: 53 }, { name: 'balsámico', pct: 31 }, { name: 'atalcado', pct: 30 }, { name: 'anís', pct: 23 }, { name: 'aromático', pct: 21 } ],
    description: '212 VIP Black Elixir de Carolina Herrera: la versión más intensa y envolvente del icónico 212 VIP, con vainilla cálida, especias suaves y un toque de regaliz negro.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  },
  {
    id: 104,
    name: 'Forever Wanted Elixir',
    brand: 'Azzaro',
    type: 'diseñador',
    gender: 'hombre',
    occasion: 'noche',
    olfFamily: 'Cuero',
    topNotes: 'Frambuesa, Mandarina verde, Bergamota',
    heartNotes: 'Cardamomo, Lavanda, Esclarea',
    baseNotes: 'Cuero, Wolfwood, Vetiver',
    accords: [ { name: 'cuero', pct: 100 }, { name: 'afrutados', pct: 95 }, { name: 'dulce', pct: 67 }, { name: 'aromático', pct: 62 }, { name: 'animálico', pct: 49 }, { name: 'cítrico', pct: 42 }, { name: 'cálido especiado', pct: 36 }, { name: 'ahumado', pct: 30 } ],
    description: 'Forever Wanted Elixir de Azzaro: frambuesa jugosa y especias cálidas sobre un fondo de cuero envolvente. La evolución más intensa y sofisticada de la línea Wanted.',
    imageUrl: '',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  }
];

const PRODUCT_IMAGE_MAP = {
  "L'Immensité":                 '/img PERFUMES/limmensite.webp',
  '212 VIP Black Elixir':        '/img PERFUMES/212 vip black elixir.webp',
  'Forever Wanted Elixir':       '/img PERFUMES/azzaro forever wanted elixir.png',
  'Acqua di Giò Profondo':       '/img PERFUMES/Acqua_di_gio_profondo.webp',
  'Creed Aventus':              '/img PERFUMES/Aventus_Creed.png',
  'Erba Pura':                  '/img PERFUMES/erba_pura.png',
  'Le Beau Le Parfum':          '/img PERFUMES/Le_Beau_Le_Parfum.png',
  'Le Male Elixir':             '/img PERFUMES/Le_Male_Elixir.png',
  'Le Male Le Parfum':          '/img PERFUMES/Le_Male_Le_Parfum.png',
  'Valentino Intense':          '/img PERFUMES/valentino_intense.png',
  'The Most Wanted':            '/img PERFUMES/The_Most_Wanted.png',
  'Stronger With You Intensely':'/img PERFUMES/Stronger_With_You_Intensely.png',
  'Bleu de Chanel Parfum':      '/img PERFUMES/Bleu_de_Chanel_Parfum.png',
  'Y EDP':                      '/img PERFUMES/Y_EDP.png',
  'Homme Intense':              '/img PERFUMES/Homme_Intense.png',
  'Dior Sauvage':               '/img PERFUMES/Dior_Sauvage.png',
  'Eros Flame':                 '/img PERFUMES/Eros_Flame.png',
  'Invictus Parfum':            '/img PERFUMES/Invictus_Parfum.png',
  'Invictus Victory Elixir':   '/img PERFUMES/Invictus_Victory_Elixir.png',
  'Rose N Roses':               '/img PERFUMES/Rose_N_Roses.png',
  'Q':                          '/img PERFUMES/Q.png',
  'Miss Dior Blooming Bouquet': '/img PERFUMES/Miss_Dior_Blooming_Bouquet.png',
  'N°5':                        '/img PERFUMES/N_5.png',
  'Bharara King':               '/img PERFUMES/Bharara_King.png',
  'Sceptre Malachite':          '/img PERFUMES/Sceptre_Malachite.png',
  'Amber Oud Gold Edition':     '/img PERFUMES/Amber_Oud_Gold_Edition.png',
  'Liquid Brun':                '/img PERFUMES/Liquid_Brun.png',
  '9PM':                        '/img PERFUMES/9PM.png',
  '9PM Night Out':              '/img PERFUMES/9PM_Night_Out.png',
  '9AM Dive':                   '/img PERFUMES/9AM Dive.png',
  '9PM Elixir':                 '/img PERFUMES/9PM_Elixir.png',
  '9PM Rebel':                  '/img PERFUMES/9PM_Rebel.png',
  'His Confession':             '/img PERFUMES/His_Confession.png',
  'Khamrah Qahwa':              '/img PERFUMES/Khamrah_Qahwa.png',
  'Khamrah Dukhan':             '/img PERFUMES/Khamrah_Dukhan.png',
  'Khamrah':                    '/img PERFUMES/Khamrah.png',
  'Khamrah Waha':               '/img PERFUMES/Khamrah_Waha.png',
  'Hawas Fire':                 '/img PERFUMES/Hawas_Fire.png',
  'Hawas Elixir':               '/img PERFUMES/Hawas_Elixir.png',
  'Hawas Ice':                  '/img PERFUMES/Hawas_Ice.png',
  'Hawas For Him':              '/img PERFUMES/Hawas_For_Him.png',
  'Hawas Kobra':                '/img PERFUMES/HAWAS KOBRA.webp',
  'Hawas Chrome':               '/img PERFUMES/Hawas_Chrome.png',
  'Hawas Malibu':               '/img PERFUMES/Hawas_Malibu.png',
  'Hawas Tropical':             '/img PERFUMES/Hawas_Tropical.png',
  'Hawas Verde':                '/img PERFUMES/Hawas_Verde.webp',
  'Nitro Red':                  '/img PERFUMES/Nitro_Red.png',
  'Nitro Elixir':               '/img PERFUMES/Nitro_Elixir.png',
  'Nitro Gold':                 '/img PERFUMES/Nitro_Gold.png',
  'Nitro Red Intensely':        '/img PERFUMES/Nitro_Red_Intensely.png',
  'Asad Elixir':                '/img PERFUMES/Asad_Elixir.png',
  'Asad Bourbon':               '/img PERFUMES/Asad_Bourbon.png',
  'Mandarin Sky':               '/img PERFUMES/Mandarin_Sky.png',
  'Odyssey Mega':               '/img PERFUMES/Odyssey_Mega.png',
  'Odyssey Aqua':               '/img PERFUMES/Odyssey_Aqua.png',
  'Odyssey White':              '/img PERFUMES/Odyssey_White.png',
  'Odyssey Limoni':             '/img PERFUMES/Odyssey_Limoni.png',
  'Odyssey Mango':              '/img PERFUMES/Odyssey_Mango-removebg-preview.png',
  'Eter Arabian Sky':           '/img PERFUMES/Eter_Arabian_Sky.png',
  'Aruba Gold':                 '/img PERFUMES/Aruba_Gold.png',
  'Eclaire Banoffi':            '/img PERFUMES/Eclaire_Banoffi.png',
  'Odyssey Candee':             '/img PERFUMES/Odyssey_Candee.png',
  'Eclaire':                    '/img PERFUMES/Eclaire.png',
  'Eclaire Pistache':           '/img PERFUMES/Eclaire_Pistache.png',
  'Stallion Donna Intense':     '/img PERFUMES/Stallion_Donna_Intense.png',
  'Yara Elixir':                '/img PERFUMES/Yara_Elixir.png',
  'Yara Moi':                   '/img PERFUMES/Yara_Moi.png',
  'Yara Rosa':                  '/img PERFUMES/Yara_Rosa.png',
  '9PM Pour Femme':             '/img PERFUMES/9PM_Pour_Femme.png',
  '9AM Pour Femme':             '/img PERFUMES/9AM_Pour_Femme.png',
  'Delilah':                    '/img PERFUMES/Delilah.png',
  'Valentino Uomo Born in Roma':'/img PERFUMES/Valentino_Uomo_Born_in_Roma.png',
  'Badee Al Oud Sublime':       '/img PERFUMES/sublime.webp',
  'Club de Nuit Intense':       '/img PERFUMES/Club_de_Nuit_Intense.png',
  'Game Of Spades Full House':  '/img PERFUMES/Game_Of_Spades_Full_House.png',
  'Game Of Spades Wildcard 3.4':'/img PERFUMES/Game_Of_Spades_Wildcard.png',
  'Odyssey Bahamas':             '/img PERFUMES/Odyssey BA HA MAS.png',
  'Odyssey Artisto':             '/img PERFUMES/odyssey artisto.png',
  'Odyssey Mandarin Sky Elixir': '/img PERFUMES/odyssey mandarin sky elixir.webp',
  'King of Kings Chapter 1':     '/img PERFUMES/king of kings chapter 1.png',
  'King of Kings Nebula':        '/img PERFUMES/king of kings Nebula.png',
  'Maleka':                      '/img PERFUMES/MALEKA.webp',
  'The Kingdom Dama':            '/img PERFUMES/the kingdom dama.png',
  'Nebras':                      '/img PERFUMES/nebras.webp',
  'Valentino Extradose':         '/img PERFUMES/valentino extradose.webp',
  'Yum Yum':                     '/img PERFUMES/yum yum armaf.webp',
  'Scandal Le Parfum':           '/img PERFUMES/SCANDAL_LE_PARFUM.webp',
  'Tag':                         '/img PERFUMES/tag.webp',
  '1 Million Night Elixir':      '/img PERFUMES/one million night elixir.png',
  'Odyssey Nexus':               '/img PERFUMES/nexus.avif',
  'Uomo Intense':                '/img PERFUMES/uomo intense stallion.avif',
  'Club de Nuit Urban Man Elixir':'/img PERFUMES/Club de Nuit Intense urban.png'
};

DEFAULT_PRODUCTS.forEach(p => {
  if (PRODUCT_IMAGE_MAP[p.name]) p.imageUrl = PRODUCT_IMAGE_MAP[p.name];
});

DEFAULT_PRODUCTS.forEach(product => {
  if (!product.imageUrl) {
    product.imageUrl = buildProductImage(product);
  }
});

// ─── Perfumes Enteros ─────────────────────────────────────────────────────────
DEFAULT_PRODUCTS.push(
  {
    id: 60, name: '9AM', brand: 'Afnan', type: 'entero',
    gender: 'hombre', occasion: 'dia', olfFamily: 'Cítrico Aromático',
    topNotes: 'Pomelo, Bergamota, Cítricos', heartNotes: 'Lavanda, Albahaca', baseNotes: 'Cedro, Almizcle, Vetiver',
    description: 'Frasco completo de 9AM Afnan. Fragancia fresca y cítrica ideal para el día.',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'almizclado', pct: 63 }, { name: 'aromático', pct: 59 }, { name: 'amaderado', pct: 59 }, { name: 'cálido especiado', pct: 53 }, { name: 'lavanda', pct: 51 }, { name: 'atalcado', pct: 47 }, { name: 'musgoso', pct: 47 }, { name: 'afrutados', pct: 47 }, { name: 'terrosos', pct: 47 } ],
    contentDescription: 'Perfume entero · Frasco original Afnan',
    imageUrl: '/imgPerfumesEnteros/9am.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 61, name: '9PM Night Out', brand: 'Afnan', type: 'entero',
    gender: 'hombre', occasion: 'noche', olfFamily: 'Oriental Especiado',
    topNotes: 'Bergamota, Pimienta negra', heartNotes: 'Cardamomo, Rosa', baseNotes: 'Oud, Ámbar, Almizcle',
    accords: [ { name: 'amaderado', pct: 100 }, { name: 'afrutados', pct: 88 }, { name: 'cálido especiado', pct: 85 }, { name: 'dulce', pct: 83 }, { name: 'tropical', pct: 67 }, { name: 'aromático', pct: 61 }, { name: 'lavanda', pct: 46 }, { name: 'florales', pct: 44 } ],
    description: 'Frasco completo de 9PM Night Out Afnan. Versión oscura y especiada, ideal para la noche.',
    contentDescription: 'Perfume entero · Frasco original Afnan',
    imageUrl: '/imgPerfumesEnteros/9pm_night_out.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 62, name: '9PM', brand: 'Afnan', type: 'entero',
    gender: 'hombre', occasion: 'noche', olfFamily: 'Oriental Amaderado',
    topNotes: 'Manzana, Bergamota', heartNotes: 'Lavanda, Pachulí', baseNotes: 'Vainilla, Ámbar, Almizcle',
    accords: [ { name: 'avainillado', pct: 100 }, { name: 'ámbar', pct: 47 }, { name: 'cálido especiado', pct: 43 }, { name: 'afrutados', pct: 39 }, { name: 'canela', pct: 36 }, { name: 'dulce', pct: 36 }, { name: 'lavanda', pct: 34 }, { name: 'fresco', pct: 30 } ],
    description: 'Frasco completo de 9PM Afnan. El clásico oriental nocturno inspirado en Stronger With You.',
    contentDescription: 'Perfume entero · Frasco original Afnan',
    imageUrl: '/imgPerfumesEnteros/9pm.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 63, name: 'Khamrah Clásico', brand: 'Lattafa', type: 'entero',
    gender: 'unisex', occasion: 'noche', olfFamily: 'Oriental Amaderado',
    topNotes: 'Manzana, Bergamota, Canela', heartNotes: 'Rosa, Oud, Sándalo', baseNotes: 'Ámbar, Vainilla, Almizcle',
    accords: [ { name: 'dulce', pct: 100 }, { name: 'especiado cálido', pct: 82 }, { name: 'vainilla', pct: 80 }, { name: 'ámbar', pct: 76 }, { name: 'canela', pct: 69 }, { name: 'amaderado', pct: 49 }, { name: 'fresco especiado', pct: 48 }, { name: 'afrutado', pct: 44 } ],
    description: 'Frasco completo del Khamrah clásico de Lattafa. Oriental y especiado, viaje sensorial a Arabia.',
    contentDescription: 'Perfume entero · Frasco original Lattafa',
    imageUrl: '/imgPerfumesEnteros/Khamrah_clasico.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 64, name: 'Odyssey Mega Gift Set', brand: 'Armaf', type: 'entero',
    gender: 'hombre', occasion: 'ambas', olfFamily: 'Aromático Amaderado',
    topNotes: 'Bergamota, Grosella negra', heartNotes: 'Lavanda, Oud', baseNotes: 'Cedro, Vetiver, Almizcle',
    description: 'Set de regalo Odyssey Mega de Armaf. Incluye perfume y complementos de la línea Odyssey.',
    contentDescription: 'Gift Set · Incluye perfume + accesorios Armaf',
    imageUrl: '/imgPerfumesEnteros/ODYSSEYMEGAGIFTSET.png',
    sizes: { 'Set': 0 }, inStock: true, featured: true, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 65, name: 'Aruba Gold Entero', brand: 'Armaf', type: 'entero',
    gender: 'mujer', occasion: 'dia', olfFamily: 'Floral Frutal',
    topNotes: 'Frutas tropicales, Bergamota', heartNotes: 'Gardenia, Jazmín, Rosa', baseNotes: 'Almizcle, Cedro, Vainilla',
    description: 'Frasco completo de Aruba Gold Armaf. Luminoso y tropical, ideal para el día.',
    contentDescription: 'Perfume entero · Frasco original Armaf',
    imageUrl: '/imgPerfumesEnteros/aruba_gold.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 66, name: 'Erba Pura Entero', brand: 'Xerjoff', type: 'entero',
    gender: 'unisex', occasion: 'ambas', olfFamily: 'Floral Amaderado',
    topNotes: 'Naranja de Sicilia, Pomelo, Limón', heartNotes: 'Flor de naranja, Jazmín', baseNotes: 'Almizcle blanco, Ámbar, Sándalo',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'afrutados', pct: 99 }, { name: 'dulce', pct: 83 }, { name: 'almizclado', pct: 74 }, { name: 'atalcado', pct: 67 }, { name: 'avainillado', pct: 62 }, { name: 'ámbar', pct: 55 }, { name: 'fresco especiado', pct: 46 } ],
    description: 'Frasco completo de Erba Pura de Xerjoff. Frescura mediterránea de alta perfumería italiana.',
    contentDescription: 'Perfume entero · Frasco original Xerjoff',
    imageUrl: '/imgPerfumesEnteros/erba_pura.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: true, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 67, name: 'Khamrah Dukhan Entero', brand: 'Lattafa', type: 'entero',
    gender: 'unisex', occasion: 'noche', olfFamily: 'Oriental Ahumado',
    topNotes: 'Rosa, Azafrán', heartNotes: 'Oud ahumado, Incienso', baseNotes: 'Ámbar, Madera de oud, Almizcle',
    accords: [ { name: 'ámbar', pct: 100 }, { name: 'especiado cálido', pct: 92 }, { name: 'dulce', pct: 75 }, { name: 'tabaco', pct: 52 }, { name: 'balsámico', pct: 48 }, { name: 'vainilla', pct: 47 }, { name: 'ahumado', pct: 46 } ],
    description: 'Frasco completo de Khamrah Dukhan Lattafa. El humo del oud árabe en su forma más pura.',
    contentDescription: 'Perfume entero · Frasco original Lattafa',
    imageUrl: '/imgPerfumesEnteros/khamrah_dukan.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 68, name: 'Khamrah Qahwa Entero', brand: 'Lattafa', type: 'entero',
    gender: 'unisex', occasion: 'ambas', olfFamily: 'Oriental Gourmand',
    topNotes: 'Café árabe, Cardamomo', heartNotes: 'Incienso, Oud', baseNotes: 'Ámbar dorado, Vainilla, Almizcle',
    accords: [ { name: 'cálido especiado', pct: 100 }, { name: 'dulce', pct: 82 }, { name: 'avainillado', pct: 73 }, { name: 'canela', pct: 49 }, { name: 'café', pct: 44 }, { name: 'ámbar', pct: 31 }, { name: 'atalcado', pct: 21 }, { name: 'aromático', pct: 19 } ],
    description: 'Frasco completo de Khamrah Qahwa Lattafa. Inspirado en el café árabe con oud y ámbar dorado.',
    contentDescription: 'Perfume entero · Frasco original Lattafa',
    imageUrl: '/imgPerfumesEnteros/khamrah_qahwa.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 69, name: 'Odyssey Mandarin Sky Entero', brand: 'Armaf', type: 'entero',
    gender: 'hombre', occasion: 'dia', olfFamily: 'Cítrico Aromático',
    topNotes: 'Mandarina, Naranja, Bergamota', heartNotes: 'Lavanda, Geranio', baseNotes: 'Cedro, Almizcle, Ámbar',
    accords: [ { name: 'cítrico', pct: 100 }, { name: 'caramelo', pct: 75 }, { name: 'dulce', pct: 73 }, { name: 'ámbar', pct: 57 }, { name: 'aromático', pct: 54 }, { name: 'avainillado', pct: 48 }, { name: 'amaderado', pct: 46 } ],
    description: 'Frasco completo de Odyssey Mandarin Sky Armaf. Cítrico solar y energético para el día.',
    contentDescription: 'Perfume entero · Frasco original Armaf',
    imageUrl: '/imgPerfumesEnteros/odyssey_mandarin_sky.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 70, name: 'Set de 9PM', brand: 'Afnan', type: 'entero',
    gender: 'hombre', occasion: 'noche', olfFamily: 'Oriental Amaderado',
    topNotes: 'Manzana, Bergamota', heartNotes: 'Lavanda, Especias', baseNotes: 'Vainilla, Ámbar, Almizcle',
    description: 'Set completo de la línea 9PM de Afnan. El regalo perfecto para los amantes de la perfumería oriental.',
    contentDescription: 'Set de regalo · Incluye fragancias de la línea 9PM',
    imageUrl: '/imgPerfumesEnteros/set_de_9pm.png',
    sizes: { 'Set': 0 }, inStock: true, featured: true, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 71, name: 'Spectre Malacrite', brand: 'Armaf', type: 'entero',
    gender: 'hombre', occasion: 'dia', olfFamily: 'Aromático Acuático',
    topNotes: 'Menta, Bergamota, Manzana', heartNotes: 'Lavanda, Especias verdes', baseNotes: 'Cedro, Vetiver, Cachemira',
    description: 'Frasco completo de Spectre Malacrite Armaf. Frescura aromática con especias verdes y madera noble.',
    contentDescription: 'Perfume entero · Frasco original Armaf',
    imageUrl: '/imgPerfumesEnteros/spectre_malacrite.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 72, name: 'Stallion Donna Intense Entero', brand: 'Stallion', type: 'entero',
    gender: 'mujer', occasion: 'noche', olfFamily: 'Oriental Floral',
    topNotes: 'Bergamota, Durazno', heartNotes: 'Rosa turca, Jazmín, Iris', baseNotes: 'Ámbar, Almizcle, Vainilla',
    description: 'Frasco completo de Stallion Donna Intense. Feminidad apasionada con rosa turca sobre ámbar.',
    contentDescription: 'Perfume entero · Frasco original Stallion',
    imageUrl: '/imgPerfumesEnteros/stallion donna intense.avif',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  // ─── VALENTINO — UOMO BORN IN ROMA ──────────────────────────────────────────
  {
    id: 74, name: 'Valentino Uomo Born in Roma', brand: 'Valentino', type: 'diseñador',
    gender: 'hombre', occasion: 'noche', olfFamily: 'Oriental Gourmand',
    topNotes: 'Limón, Bergamota, Mandarina',
    heartNotes: 'Salvia romana, Violeta, Pachulí',
    baseNotes: 'Vainilla bourbon, Ámbar, Almizcle blanco',
    accords: [ { name: 'mineral', pct: 100 }, { name: 'amaderado', pct: 95 }, { name: 'ozónico', pct: 89 }, { name: 'aromático', pct: 80 }, { name: 'acuático', pct: 73 }, { name: 'salado', pct: 64 }, { name: 'herbal', pct: 60 }, { name: 'fresco especiado', pct: 58 }, { name: 'verde', pct: 54 }, { name: 'especiado suave', pct: 49 } ],
    description: 'Valentino Uomo Born in Roma: elegancia italiana pura. Cítricos brillantes que abren paso a una salvia fresca y violeta, sobre una base caliente y adictiva de vainilla bourbon con ámbar dorado.',
    imageUrl: '/img PERFUMES/Valentino_Uomo_Born_in_Roma.png',
    sizes: { '2ml': 15, '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  // ─── LATTAFA — NITRO RED INTENSELY ───────────────────────────────────────────
  {
    id: 73, name: 'Nitro Red Intensely', brand: 'Lattafa', type: 'arabe',
    gender: 'hombre', occasion: 'noche', olfFamily: 'Oriental Especiado',
    topNotes: 'Pimienta roja, Bergamota, Azafrán',
    heartNotes: 'Rosa, Oud, Madera especiada',
    baseNotes: 'Ámbar, Cuero, Almizcle oscuro',
    accords: [ { name: 'afrutados', pct: 100 }, { name: 'amaderado', pct: 94 }, { name: 'fresco', pct: 74 }, { name: 'ámbar', pct: 66 }, { name: 'atalcado', pct: 62 }, { name: 'ozónico', pct: 61 }, { name: 'acuático', pct: 60 }, { name: 'salado', pct: 53 }, { name: 'verde', pct: 52 }, { name: 'cítrico', pct: 51 } ],
    description: 'Nitro Red Intensely: la versión más intensa y oscura de la serie Nitro. Especias ardientes sobre cuero y ámbar profundo.',
    imageUrl: '/img PERFUMES/Nitro_Red_Intensely.png',
    sizes: { '2ml': 0, '3ml': 14, '5ml': 19, '10ml': 29 },
    inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  }
);

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

  updateStatus(id, status, paymentMethod = null) {
    const orders = this.getAll().map(o => {
      if (o.id !== id) return o;
      const updated = { ...o, status, updatedAt: new Date().toISOString() };
      if (paymentMethod) updated.paymentMethod = paymentMethod;

      // Al confirmar el pago: descontar ml del inventario
      if (status === 'pagado' && o.status !== 'pagado') {
        o.items.forEach(item => {
          const product = Products.getById(item.productId);
          if (!product) return;
          const mlUsed    = parseInt(item.size) * item.quantity;
          const newRemain = Math.max(0, product.bottleRemainingMl - mlUsed);
          Products.update(item.productId, { bottleRemainingMl: newRemain });
        });
      }

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
