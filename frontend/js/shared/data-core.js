// ─── MICHT Decants — Capa de datos ───────────────────────────────────────────

const STORAGE_KEY  = 'micht_products_v2';
const ORDERS_KEY   = 'micht_orders';
const SITE_THEME_KEY = 'micht_site_theme';
const COMBOS_KEY   = 'micht_combos_v1';

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
