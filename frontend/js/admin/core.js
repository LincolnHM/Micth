// ─── Panel Administrador — MICHT Decants ─────────────────────────────────────

// ─── Verificación de acceso admin ────────────────────────────────────────────
// La lista de admins se gestiona en Supabase Dashboard → Authentication → Users
// → clic en el usuario → editar "app_metadata" → agregar: {"role":"admin"}
// Así no hay correos ni datos sensibles en el código ni en el repositorio.
function isAdminUser(user) {
  return user?.app_metadata?.role === 'admin';
}

let _adminProductSearch = '';
let _adminProductTypeFilter = 'all';
let _adminPage  = 1;
const _ADMIN_PAGE_SIZE = 12;
let _customerHistory = [];
let _orderSearch = '';
let _userSearch  = '';

const CAMPAIGN_LABELS = {
  'default':         'Diseño normal',
  'dia-madre':       'Día de la Madre',
  'dia-padre':       'Día del Padre',
  'san-juan':        'San Juan',
  'navidad':         'Navidad',
  'fiestas-patrias': 'Fiestas Patrias',
  'san-valentin':    'San Valentín',
  'halloween':       'Halloween',
  'anio-nuevo':      'Año Nuevo'
};

function withTimeout(promise, ms, label = 'operacion') {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`Tiempo de espera agotado al cargar ${label}.`)), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timerId)),
    timeout
  ]);
}

// ─── Búsqueda tolerante a errores de tipeo (acentos + distancia de edición) ───
function _normalizeSearchText(s) {
  return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function _levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

// Puntúa qué tan bien "queryWords" (lo que escribió el usuario) matchea contra
// "targetWords" (nombre + marca + talla normalizados de una opción). Menor = mejor.
// Devuelve null si alguna palabra de la búsqueda no matchea nada razonable (se descarta la opción).
function _fuzzyMatchScore(queryWords, targetWords) {
  let total = 0;
  for (const qw of queryWords) {
    let best = null;
    for (const tw of targetWords) {
      if (tw.startsWith(qw) || tw.includes(qw)) { best = 0; break; }
      const maxDist = qw.length <= 3 ? 1 : qw.length <= 6 ? 2 : 3;
      const d = _levenshtein(qw, tw);
      if (d <= maxDist && (best === null || d < best)) best = d;
    }
    if (best === null) return null;
    total += best;
  }
  return total;
}

// Une "escuchar tap (click/touch) sin bloquear el scroll táctil" — si el dedo se
// mueve más que unos px entre touchstart y touchend, se asume que era un gesto de
// scroll y se ignora el tap (evita seleccionar por error Y permite bajar la lista).
function _bindTapSelect(el, handler) {
  el.addEventListener('mousedown', handler);
  let startY = null, moved = false;
  el.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    moved = false;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (startY !== null && Math.abs(e.touches[0].clientY - startY) > 8) moved = true;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!moved) handler(e);
    startY = null;
  }, { passive: false });
}

function setAdminErrorState(containerId, title, message) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div style="text-align:center;color:var(--text2);padding:2rem;background:var(--card);border:1px solid rgba(239,83,80,.35);border-radius:var(--r-lg)">
      <div style="font-size:1.4rem;color:var(--red);margin-bottom:.5rem">⚠</div>
      <div style="color:var(--white);font-weight:600;margin-bottom:.25rem">${sanitize(title)}</div>
      <div style="font-size:.84rem;line-height:1.6">${sanitize(message)}</div>
    </div>`;
}
