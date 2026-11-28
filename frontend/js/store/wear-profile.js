// ─── «Cuándo usarlo»: estación y momento del día de cada perfume ──────────────
// No usa votos de nadie: se calcula con los datos del propio perfume.
//   1. Cada acorde (con su %) suma puntos a invierno, primavera, verano, otoño,
//      día y noche según la tabla WEAR_RULES: los cítricos, acuáticos y verdes
//      van al calor y al día; la vainilla, el ámbar, el oud y lo especiado
//      cálido, al frío y a la noche (lo mismo que explica /guia/#dia-noche).
//   2. Día y noche se mezclan con el «momento ideal» que el admin marcó en el
//      perfume (día / noche / ambas), que pesa un poco más que los acordes.
// Las barras se muestran comparadas con la mejor de su grupo (la mejor estación
// llena la barra), y cada una lleva una palabra: Ideal, Muy bien, Bien o Poco.

//                invierno primavera verano otoño  día  noche
const WEAR_RULES = [
  [/fresco especiado/,                                           [.30, .80, .80, .50, .90, .40]],
  [/c[aá]lido especiado|especiado c[aá]lido|canela/,             [1.0, .20, .10, 1.0, .30, 1.0]],
  [/especiado suave/,                                            [.80, .40, .20, .80, .40, .80]],
  [/c[ií]tric|lim[oó]n|bergamota|naranj|pomelo|mandarin/,       [.10, .80, 1.0, .30, 1.0, .20]],
  [/marin|acu[aá]tic|oz[oó]nic|salad/,                          [.05, .60, 1.0, .20, 1.0, .20]],
  [/verde|herb|con[ií]fer|terp[eé]n/,                           [.20, 1.0, .80, .40, 1.0, .25]],
  [/fresc/,                                                      [.10, .80, 1.0, .30, 1.0, .20]],
  [/arom[aá]tic|lavanda|an[ií]s/,                               [.45, .80, .60, .60, .85, .45]],
  [/tropical|coco/,                                              [.10, .60, 1.0, .30, .90, .40]],
  [/afrutad|frut|acerezad/,                                      [.30, .90, .80, .40, .80, .50]],
  [/rosa|floral|flor|violeta|iris/,                              [.30, 1.0, .60, .50, .80, .50]],
  [/jabon|aldeh[ií]d/,                                           [.30, .80, .60, .40, .90, .30]],
  [/almizcl|atalcad|empolvad/,                                   [.55, .70, .40, .60, .70, .60]],
  [/mineral/,                                                    [.30, .60, .80, .40, .80, .40]],
  [/vainill|caramel|l[aá]ct[oó]nic|cacao|chocolat|caf[eé]|amielad|miel|nuez|nueces|\bron\b|gourmand/, [1.0, .30, .10, .90, .30, 1.0]],
  [/especiad/,                                                   [.80, .40, .20, .80, .40, .80]],
  [/dulce/,                                                      [.80, .40, .20, .80, .40, .90]],
  [/[aá]mbar|bals[aá]mic|resin|incienso/,                       [1.0, .20, .10, .90, .30, 1.0]],
  [/oud|ahumad|tabaco|cuero|anim[aá]l/,                          [1.0, .20, .10, .90, .30, 1.0]],
  [/amaderad|madera|s[aá]ndalo|cedro|vetiver/,                  [.70, .50, .30, .90, .60, .70]],
  [/musgos|pachul[ií]|terros/,                                   [.60, .50, .30, .90, .60, .70]],
];
const WEAR_NEUTRAL = [.5, .5, .5, .5, .5, .5];
// Día / noche que marcó el admin para el perfume
const WEAR_OCCASION = { dia: [1, .35], noche: [.35, 1], ambas: [.85, .85] };

const WEAR_KEYS = ['invierno', 'primavera', 'verano', 'otono', 'dia', 'noche'];

function _wearVector(name) {
  const key = String(name || '').toLowerCase();
  const rule = WEAR_RULES.find(([re]) => re.test(key));
  return rule ? rule[1] : WEAR_NEUTRAL;
}

// Devuelve { invierno, primavera, verano, otono, dia, noche } entre 0 y 1, o
// null si el perfume no tiene acordes ni momento marcado.
function wearProfile(p) {
  const accords = (Array.isArray(p?.accords) ? p.accords : []).filter(a => a && a.name);
  const occ = WEAR_OCCASION[p?.occasion];
  if (!accords.length && !occ) return null;

  const sum = [0, 0, 0, 0, 0, 0];
  let total = 0;
  accords.forEach(a => {
    const w = Math.max(1, Number(a.pct) || 50);
    _wearVector(a.name).forEach((v, i) => { sum[i] += v * w; });
    total += w;
  });
  const raw = total ? sum.map(s => s / total) : WEAR_NEUTRAL.slice();
  if (occ) {
    raw[4] = accords.length ? .45 * raw[4] + .55 * occ[0] : occ[0];
    raw[5] = accords.length ? .45 * raw[5] + .55 * occ[1] : occ[1];
  }
  const out = {};
  WEAR_KEYS.forEach((k, i) => { out[k] = raw[i]; });
  out.hasSeasons = accords.length > 0;
  return out;
}

const WEAR_ITEMS = [
  { key: 'invierno',  label: 'Invierno',  color: '#9cc9f5',
    icon: '<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5M3.2 9.6l3.4-.9-.9-3.4M20.8 14.4l-3.4.9.9 3.4M3.2 14.4l3.4.9-.9 3.4M20.8 9.6l-3.4-.9.9-3.4"/>' },
  { key: 'primavera', label: 'Primavera', color: '#8fd694',
    icon: '<path d="M12 21v-8"/><path d="M12 13c-3 0-5-2-5-5V4l2.5 2L12 3l2.5 3L17 4v4c0 3-2 5-5 5z"/><path d="M12 19c-2.2 0-3.8-1.2-4.3-3.2 2.2 0 3.8 1.2 4.3 3.2zM12 19c2.2 0 3.8-1.2 4.3-3.2-2.2 0-3.8 1.2-4.3 3.2z"/>' },
  { key: 'verano',    label: 'Verano',    color: '#ffb26b',
    icon: '<path d="M6 14a6 6 0 0112 0"/><path d="M12 4v2.5M4.2 7.2l1.8 1.8M19.8 7.2L18 9M2 14h2.5M19.5 14H22"/><path d="M3 18c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/>' },
  { key: 'otono',     label: 'Otoño',     color: '#d99a5b',
    icon: '<path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z"/><path d="M5 19L14 10M9.5 14.5h3.5M12 12V8.8"/>' },
  { key: 'dia',       label: 'Día',       color: '#ffd166', time: true,
    icon: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>' },
  { key: 'noche',     label: 'Noche',     color: '#a78bfa', time: true,
    icon: '<path d="M20.5 14.5A8.5 8.5 0 019.5 3.5a8.5 8.5 0 1011 11z"/><path d="M17 3v3M15.5 4.5h3"/>' },
];

function _wearWord(rel) {
  return rel >= .9 ? 'Ideal' : rel >= .72 ? 'Muy bien' : rel >= .5 ? 'Bien' : 'Poco';
}

// Frase corta: «Ideal en otoño e invierno, de noche»
function wearSummary(prof) {
  const join = list => list.length > 1 ? list.slice(0, -1).join(', ') + ' y ' + list[list.length - 1] : list[0] || '';
  const parts = [];
  if (prof.hasSeasons) {
    const seasons = WEAR_ITEMS.filter(i => !i.time);
    const max = Math.max(...seasons.map(i => prof[i.key]));
    const top = seasons.filter(i => prof[i.key] / max >= .9).sort((a, b) => prof[b.key] - prof[a.key]);
    parts.push(seasons.every(i => prof[i.key] / max >= .8) ? 'todo el año' : 'en ' + join(top.map(i => i.label.toLowerCase())));
  }
  const d = prof.dia, n = prof.noche, mx = Math.max(d, n);
  parts.push(d / mx >= .85 && n / mx >= .85 ? 'de día y de noche' : d > n ? 'de día' : 'de noche');
  return 'Ideal ' + parts.join(', ');
}

function wearGridHtml(prof) {
  const seasonsMax = Math.max(...WEAR_ITEMS.filter(i => !i.time).map(i => prof[i.key]));
  const timeMax    = Math.max(prof.dia, prof.noche);
  return WEAR_ITEMS.filter(i => i.time || prof.hasSeasons).map(i => {
    const rel = prof[i.key] / (i.time ? timeMax : seasonsMax);
    const top = rel >= .9;
    return `
      <div class="pd-wear-item${i.time ? ' is-time' : ''}${top ? ' is-top' : ''}${rel < .5 ? ' is-low' : ''}" style="--wc:${i.color}">
        <svg class="pd-wear-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${i.icon}</svg>
        <span class="pd-wear-label">${i.label}</span>
        <span class="pd-wear-bar" aria-hidden="true"><i style="width:${Math.max(8, Math.round(rel * 100))}%"></i></span>
        <span class="pd-wear-word">${_wearWord(rel)}</span>
      </div>`;
  }).join('');
}
