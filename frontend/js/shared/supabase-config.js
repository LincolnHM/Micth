// ─── MICHT Decants — Conexión a Supabase ──────────────────────────────────────
//
// URL y clave pública (anon) del proyecto. La clave anon es pública por diseño:
// lo que protege los datos son las políticas RLS de la base, no esconder esta clave.
// Nunca pongas aquí claves secretas ni contraseñas.
//
// El SQL de las tablas y sus políticas NO va en el sitio público: está en la
// carpeta backend/ del repositorio (backend/supabase/).
//
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL      = 'https://nvttfrpbdrdtgxulkyln.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2xUgHEI6yI1KjmQSZk3chg_ar98tDZf';

// Cómo se guardan los pedidos de la tienda:
//   false → directo en la tabla `pedidos` (un solo envío; los precios los valida el
//           trigger de la base de datos, ver backend/supabase/sql/2026-09-23-validar-pedidos.sql)
//   true  → pasando por la Edge Function `create-order` (solo si la desplegaste)
const USE_EDGE_CREATE_ORDER = false;

// ─── Detectar si Supabase está configurado ────────────────────────────────────
const SUPABASE_READY = (
  !SUPABASE_URL.includes('TU-PROYECTO') &&
  typeof supabase !== 'undefined'
);

// En páginas de admin se conserva la sesión autenticada.
// En tienda/nosotros/contacto se fuerza rol anónimo para que los pedidos
// de clientes nunca sean bloqueados por RLS aunque el admin esté logueado.
const _isAdminPage = typeof window !== 'undefined' &&
  window.location.pathname.toLowerCase().includes('admin');

const db = SUPABASE_READY
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
      _isAdminPage
        ? {}
        : { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    )
  : null;

// Conexión silenciosa — no exponer detalles del stack en consola pública

// ─── Cliente Supabase con sesión persistente para Auth de clientes ────────────
// Distinto de `db` (que fuerza rol anónimo en tienda) — este preserva la sesión
// del cliente para login, registro, y consultas de perfil de usuario.
// storageKey separada para que las sesiones de clientes NO interfieran con el admin.
const authClient = SUPABASE_READY
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storageKey: 'micht-customer-auth' }
    })
  : null;
