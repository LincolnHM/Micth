// ─── MICHT Decants — Capa de datos ───────────────────────────────────────────

const STORAGE_KEY  = 'micht_products_v2';
const ORDERS_KEY   = 'micht_orders';
const AUTH_KEY     = 'micht_admin_hash';
const SESSION_KEY  = 'micht_session';
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
    description: 'El rey de los perfumes masculinos. Piña fresca sobre madera ahumada de abedul con ámbar gris. Poder y elegancia en estado puro.',
    imageUrl: '',
    sizes: { '3ml': 29, '5ml': 45, '10ml': 89 },
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
    description: 'Frescura mediterránea con flor de naranja de Sicilia y base almizcleña. Luminoso, sensual y deliciosamente único.',
    imageUrl: '',
    sizes: { '3ml': 29, '5ml': 45, '10ml': 89 },
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
    description: 'Versión intensa y solar de Le Beau. Coco tropical y vainilla envueltos en cítricos brillantes. Verano eterno en un frasco.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'La evolución más oscura y seductora de Le Male. Lavanda especiada con miel y un fondo ambarino irresistible.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'La versión Parfum de Le Male. Más profundo y sensual. Lavanda nocturna con madera oscura y vainilla envolvente.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'Born in Roma Intense: la versión oscura y especiada de Valentino. Pimienta negra y rosa sobre vetiver y ámbar dorado.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'Seductor y atrevido. Cardamomo y pimienta rosa se funden con vetiver y cuero para crear una fragancia de poder magnético.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'La versión más oscura e intensa de Stronger With You. Especiado y ambarino con calidez de castaña asada y cuero.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'La expresión más pura de Bleu de Chanel. Aromático fresco con madera noble y un seco final de cedro y sándalo.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'Y EDP de YSL: dinámico y moderno. Manzana jugosa y jengibre sobre cedro y ambroxan. El perfume del hombre actual.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'Dior Homme Intense: el glamour masculino en su máxima expresión. Iris empolvado con vainilla cálida y un toque de cuero noble.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'El perfume masculino más vendido del mundo. Bergamota brillante con ambroxan y madera de cedro. Fresco, salvaje e irresistible.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'La llama de Eros: pasión mediterránea con cítricos ardientes, especias y madera de cedro. Seductor y ardiente.',
    imageUrl: '',
    sizes: { '3ml': 13, '5ml': 23, '10ml': 43 },
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
    description: 'Invictus Parfum: la versión más oscura y poderosa. Cardamomo negro y madera de guayaco crean un ganador sin igual.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 55 },
    inStock: true,
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
    description: 'Miss Dior Rose N Roses: un bouquet de rosas luminosas del amanecer. Fresco, radiante y eternamente femenino.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'Q by Dolce & Gabbana: sensualidad italiana en cristal. Iris y sándalo se unen en una fragancia femenina sofisticada.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'Un bouquet floral delicado y femenino. Peonia y rosa de mayo envueltas en almizcle blanco. Romántico y etéreo.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'El perfume más icónico de la historia. Floral aldehídico con jazmín de Grasse y un fondo cálido de sándalo y vainilla.',
    imageUrl: '',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
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
    description: 'Bharara King: fragancia unisex regia y opulenta. Oud y madera de cedro sobre cítricos brillantes. Para quienes exigen lo mejor.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: 'Sceptre Malachite: frescura aristocrática con notas acuáticas y especias verdes. Elegante alternativa a fragancias de lujo.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Amber Oud Gold: la esencia del lujo árabe. Azafrán y oud con ámbar dorado. Imponente y sofisticado.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: 'Liquid Brun: intensidad oriental con canela encendida, oud ahumado y un fondo de vainilla y ámbar. Irresistiblemente oscuro.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: '9PM: el clon árabe de Stronger With You. Manzana y castaña sobre vainilla cálida. Perfección nocturna a precio accesible.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: '9PM Night Out: versión más oscura y especiada. Pimienta negra y cardamomo con oud y ámbar. La esencia de la noche.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: '9AM Dive: frescura oceánica para el día. Menta acuática y notas marinas sobre cedro limpio. Energizante y vigorizante.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: '9PM Elixir: la versión más intensa de la serie. Especias oscuras y oud con elixir de ámbar y vainilla. Adictivo.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: '9PM Rebel: espíritu rebelde con jengibre y cuero ahumado. Amaderado e incandescente. Próximamente disponible.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: 'His Confession Lattafa: una confesión de intensidad oriental. Cardamomo y oud con rosa y ámbar. Declaración de sofisticación.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Khamrah Qahwa: inspirado en el café árabe tradicional. Cardamomo y café con oud y ámbar dorado. Cálido y reconfortante.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Khamrah Dukhan: el humo del oud árabe en su forma más pura. Rosa y azafrán sobre oud ahumado. Misterioso y poderoso.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Khamrah: el clásico oriental de Lattafa. Manzana y canela sobre rosa y oud. Un viaje sensorial al corazón de Arabia.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Khamrah Waha: la versión fresca y frutal de la icónica línea Khamrah de Lattafa. "Waha" significa oasis — un refugio fragante con frutas jugosas y flores delicadas sobre una base oriental suave. Ideal para el día.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Hawas Fire: la pasión ardiente del oriente. Pimienta roja y cardamomo sobre vetiver ahumado. Intenso, fogoso e irresistible.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: 'Hawas Elixir: la esencia más profunda de la línea Hawas. Oud y sándalo con ámbar oscuro. Actualmente agotado.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: 'Hawas Ice: frescura glacial del oriente. Menta ártica y bergamota sobre notas acuáticas y cedro limpio. Próximamente.',
    imageUrl: '',
    sizes: { '3ml': 13, '5ml': 19, '10ml': 29 },
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
    description: 'Hawas For Him: la fragancia acuática árabe por excelencia. Cítrica y fresca con un corazón especiado. Próximamente.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: 'Nitro Red: potencia y pasión en cada spray. Pimienta roja y cuero sobre ámbar oscuro. Próximamente.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: 'Nitro Elixir: el más intenso de la serie Nitro. Oud e incienso sobre ámbar líquido. Próximamente en MICHT.',
    imageUrl: '',
    sizes: { '3ml': 14, '5ml': 19, '10ml': 29 },
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
    description: 'Nitro Gold: elegancia dorada con sándalo y ámbar. Opulento y distinguido.',
    imageUrl: '/img PERFUMES/Nitro Gold.jpg',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: 'Asad Elixir: el rugido del oriente. Pimienta negra sobre vetiver y oud ahumado. Actualmente agotado.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: 'Asad Bourbon: notas de bourbon, cuero y vainilla ahumada. Masculino y opulento. Próximamente.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Odyssey Mandarin Sky: cítricos solares y mandarina brillante. Fresco y energético para el día a día.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Odyssey Mega: potencia y frescura combinadas. Inspirado en Aventus, a precio accesible. Popular y muy versátil.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Odyssey Aqua: la versión más fresca y marina. Lima y notas acuáticas sobre cedro limpio. Perfecto para el calor.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Odyssey White: elegancia limpia con especias blancas y madera de cachemira. Sofisticado y versátil.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Odyssey Limoni: explosión de limón siciliano con hierbas aromáticas frescas. Actualmente agotado.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Odyssey Mango: tropical y jugoso. Mango fresco y melocotón sobre flores tropicales. Fresco y alegre para el día.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: 'Eter Arabian Sky: el cielo árabe en una fragancia. Rosa y azafrán sobre oud y sándalo dorado. Próximamente.',
    imageUrl: '',
    sizes: { '3ml': 14, '5ml': 19, '10ml': 29 },
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
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Eclaire Banoffi: inspirado en el postre banoffi. Caramelo, banana y toffee en una deliciosa fragancia femenina.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Odyssey Candee: dulzura floral en un frasco adorable. Frutas y flores sobre almizcle suave. Alegre y femenino.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Eclaire: flores suaves y frutas rojas sobre un fondo cálido de vainilla. Delicado y tentador.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Eclaire Pistache: gourmand irresistible con pistacho y almendra. Cremoso, floral y deliciosamente único.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Yara Elixir: la versión más intensa de Yara. Rosa y oud suave sobre ámbar y vainilla. Seductora y apasionada.',
    imageUrl: '',
    sizes: { '3ml': 12, '5ml': 17, '10ml': 27 },
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
    description: 'Yara Moi: delicadeza floral con durazno y magnolia. Fresca y romántica, ideal para el día.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: '9PM Pour Femme: la versión femenina de 9PM. Flores suaves y frutas sobre vainilla y almizcle. Para una noche perfecta.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: '9AM Pour Femme: frescura matutina con cítricos y flores primaverales. Ideal para empezar el día con energía.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
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
    description: 'Delilah: suavidad floral con rosa y jazmín sobre almizcle y vainilla. Femenino y delicado. Actualmente agotado.',
    imageUrl: '',
    sizes: { '3ml': 10, '5ml': 15, '10ml': 25 },
    inStock: false,
    featured: false,
    bottleRemainingMl: 0,
    bottleTotalMl: 0
  }
];

const PRODUCT_IMAGE_MAP = {
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
  'Valentino Uomo Born in Roma':'/img PERFUMES/Valentino_Uomo_Born_in_Roma.png'
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
    contentDescription: 'Perfume entero · Frasco original Afnan',
    imageUrl: '/imgPerfumesEnteros/9am.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 61, name: '9PM Night Out', brand: 'Afnan', type: 'entero',
    gender: 'hombre', occasion: 'noche', olfFamily: 'Oriental Especiado',
    topNotes: 'Bergamota, Pimienta negra', heartNotes: 'Cardamomo, Rosa', baseNotes: 'Oud, Ámbar, Almizcle',
    description: 'Frasco completo de 9PM Night Out Afnan. Versión oscura y especiada, ideal para la noche.',
    contentDescription: 'Perfume entero · Frasco original Afnan',
    imageUrl: '/imgPerfumesEnteros/9pm_night_out.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 62, name: '9PM', brand: 'Afnan', type: 'entero',
    gender: 'hombre', occasion: 'noche', olfFamily: 'Oriental Amaderado',
    topNotes: 'Manzana, Bergamota', heartNotes: 'Lavanda, Pachulí', baseNotes: 'Vainilla, Ámbar, Almizcle',
    description: 'Frasco completo de 9PM Afnan. El clásico oriental nocturno inspirado en Stronger With You.',
    contentDescription: 'Perfume entero · Frasco original Afnan',
    imageUrl: '/imgPerfumesEnteros/9pm.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 63, name: 'Khamrah Clásico', brand: 'Lattafa', type: 'entero',
    gender: 'unisex', occasion: 'noche', olfFamily: 'Oriental Amaderado',
    topNotes: 'Manzana, Bergamota, Canela', heartNotes: 'Rosa, Oud, Sándalo', baseNotes: 'Ámbar, Vainilla, Almizcle',
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
    description: 'Frasco completo de Erba Pura de Xerjoff. Frescura mediterránea de alta perfumería italiana.',
    contentDescription: 'Perfume entero · Frasco original Xerjoff',
    imageUrl: '/imgPerfumesEnteros/erba_pura.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: true, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 67, name: 'Khamrah Dukhan Entero', brand: 'Lattafa', type: 'entero',
    gender: 'unisex', occasion: 'noche', olfFamily: 'Oriental Ahumado',
    topNotes: 'Rosa, Azafrán', heartNotes: 'Oud ahumado, Incienso', baseNotes: 'Ámbar, Madera de oud, Almizcle',
    description: 'Frasco completo de Khamrah Dukhan Lattafa. El humo del oud árabe en su forma más pura.',
    contentDescription: 'Perfume entero · Frasco original Lattafa',
    imageUrl: '/imgPerfumesEnteros/khamrah_dukan.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 68, name: 'Khamrah Qahwa Entero', brand: 'Lattafa', type: 'entero',
    gender: 'unisex', occasion: 'ambas', olfFamily: 'Oriental Gourmand',
    topNotes: 'Café árabe, Cardamomo', heartNotes: 'Incienso, Oud', baseNotes: 'Ámbar dorado, Vainilla, Almizcle',
    description: 'Frasco completo de Khamrah Qahwa Lattafa. Inspirado en el café árabe con oud y ámbar dorado.',
    contentDescription: 'Perfume entero · Frasco original Lattafa',
    imageUrl: '/imgPerfumesEnteros/khamrah_qahwa.png',
    sizes: { 'Unidad': 0 }, inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  {
    id: 69, name: 'Odyssey Mandarin Sky Entero', brand: 'Armaf', type: 'entero',
    gender: 'hombre', occasion: 'dia', olfFamily: 'Cítrico Aromático',
    topNotes: 'Mandarina, Naranja, Bergamota', heartNotes: 'Lavanda, Geranio', baseNotes: 'Cedro, Almizcle, Ámbar',
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
    description: 'Valentino Uomo Born in Roma: elegancia italiana pura. Cítricos brillantes que abren paso a una salvia fresca y violeta, sobre una base caliente y adictiva de vainilla bourbon con ámbar dorado.',
    imageUrl: '/img PERFUMES/Valentino_Uomo_Born_in_Roma.png',
    sizes: { '3ml': 20, '5ml': 30, '10ml': 60 },
    inStock: true, featured: false, bottleRemainingMl: 0, bottleTotalMl: 0
  },
  // ─── LATTAFA — NITRO RED INTENSELY ───────────────────────────────────────────
  {
    id: 73, name: 'Nitro Red Intensely', brand: 'Lattafa', type: 'arabe',
    gender: 'hombre', occasion: 'noche', olfFamily: 'Oriental Especiado',
    topNotes: 'Pimienta roja, Bergamota, Azafrán',
    heartNotes: 'Rosa, Oud, Madera especiada',
    baseNotes: 'Ámbar, Cuero, Almizcle oscuro',
    description: 'Nitro Red Intensely: la versión más intensa y oscura de la serie Nitro. Especias ardientes sobre cuero y ámbar profundo.',
    imageUrl: '/img PERFUMES/Nitro_Red_Intensely.png',
    sizes: { '3ml': 14, '5ml': 19, '10ml': 29 },
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

  updateStatus(id, status) {
    const orders = this.getAll().map(o => {
      if (o.id !== id) return o;
      const updated = { ...o, status, updatedAt: new Date().toISOString() };

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

// ─── Autenticación de administrador ──────────────────────────────────────────

const Auth = {
  async hash(password) {
    const enc = new TextEncoder().encode(password);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  hasPassword()           { return !!localStorage.getItem(AUTH_KEY); },
  async setPassword(pw)   { localStorage.setItem(AUTH_KEY, await this.hash(pw)); },
  async verify(pw)        { const s = localStorage.getItem(AUTH_KEY); return !!s && s === await this.hash(pw); },
  login()                 { sessionStorage.setItem(SESSION_KEY, '1'); },
  logout()                { sessionStorage.removeItem(SESSION_KEY); },
  isLoggedIn()            { return sessionStorage.getItem(SESSION_KEY) === '1'; }
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
