-- ─── MICHT Decants — Tabla site_settings (campañas + anuncio de bienvenida) ──
--
-- Pega esto en Supabase → SQL Editor → Run. Seguro de ejecutar más de una vez.
--
-- Por qué hace falta: al construir el anuncio de bienvenida, probé si la API
-- pública podía leer `site_settings` (la tabla que ya usa la función de
-- Campañas por Fechas) y respondió 404 — la tabla no existe todavía en tu
-- proyecto de Supabase. Eso significa que "Campañas por Fechas" en el panel
-- probablemente solo funciona hoy en el navegador del admin (guardado local),
-- sin llegar realmente a los visitantes. Este SQL la crea con los permisos
-- correctos desde el inicio (mismo criterio que la corrección C-01: el admin
-- se valida por su rol real, no por "cualquier usuario logueado").

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante (con cuenta o sin ella) debe poder LEER la campaña
-- activa y el anuncio de bienvenida — si no, nadie los vería.
DROP POLICY IF EXISTS "anon_read_site_settings" ON site_settings;
CREATE POLICY "anon_read_site_settings" ON site_settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Solo el admin real (por rol, no por estar "logueado nada más") puede crear
-- o editar campañas/anuncios.
DROP POLICY IF EXISTS "admin_write_site_settings" ON site_settings;
CREATE POLICY "admin_write_site_settings" ON site_settings
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Verificación rápida:
-- SELECT policyname, roles, cmd, qual FROM pg_policies WHERE tablename = 'site_settings';
