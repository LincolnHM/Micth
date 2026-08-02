-- ─── MICHT Decants — Correcciones de seguridad (auditoría 2026-08-02) ────────
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run.
-- Es seguro ejecutarlo más de una vez (usa IF EXISTS / IF NOT EXISTS / OR REPLACE).
--
-- Qué arregla:
--   1. (CRÍTICO — C-01) Las políticas de `pedidos` y `productos` dejaban que
--      CUALQUIER usuario logueado (no solo el admin) leyera/editara/borrara
--      todo. Se reemplazan por políticas que exigen el rol admin real.
--   2. (ALTO — H-02) Tabla + función de límite de frecuencia por IP, usada por
--      la Edge Function supabase/functions/create-order para frenar spam de
--      pedidos.
--
-- Después de ejecutar esto: cierra sesión y vuelve a entrar en el panel admin
-- (para que tu token incluya el rol admin) y confirma que sigues viendo y
-- editando pedidos con tu cuenta normal.

-- ─── 1. C-01 — Políticas RLS: solo admin, no "cualquier autenticado" ─────────

DROP POLICY IF EXISTS "admin_select_pedidos" ON pedidos;
DROP POLICY IF EXISTS "admin_update_pedidos" ON pedidos;
DROP POLICY IF EXISTS "admin_delete_pedidos" ON pedidos;

CREATE POLICY "admin_select_pedidos" ON pedidos FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "admin_update_pedidos" ON pedidos FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "admin_delete_pedidos" ON pedidos FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- (las políticas de INSERT para anon/authenticated en `pedidos` NO se tocan:
--  así es como cualquier cliente puede seguir creando pedidos desde el checkout)

DROP POLICY IF EXISTS "admin_all_productos" ON productos;
CREATE POLICY "admin_all_productos" ON productos FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- (la política de SELECT pública en `productos` NO se toca: el catálogo
--  debe seguir siendo visible para cualquier visitante)

-- Verificación rápida — debería mostrar solo las políticas de arriba:
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
-- WHERE tablename IN ('pedidos','productos');


-- ─── 2. H-02 — Límite de frecuencia por IP para creación de pedidos ──────────

CREATE TABLE IF NOT EXISTS order_rate_limits (
  ip           TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count        INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE order_rate_limits ENABLE ROW LEVEL SECURITY;
-- A propósito, sin políticas para anon/authenticated: nadie puede leer ni
-- escribir esta tabla directamente. Solo la función SECURITY DEFINER de abajo
-- puede tocarla (mismo patrón que ya usas en check_dni_exists, js/auth.js).

CREATE OR REPLACE FUNCTION check_order_rate_limit(
  p_ip TEXT, p_max INT DEFAULT 8, p_window_seconds INT DEFAULT 60
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM order_rate_limits WHERE window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL;
  INSERT INTO order_rate_limits (ip, window_start, count) VALUES (p_ip, NOW(), 1)
    ON CONFLICT (ip) DO UPDATE SET count = order_rate_limits.count + 1
    RETURNING count INTO v_count;
  RETURN v_count <= p_max;
END;
$$;

GRANT EXECUTE ON FUNCTION check_order_rate_limit(TEXT, INT, INT) TO anon, authenticated;


-- ─── 3. Opcional / hacer DESPUÉS de confirmar que create-order funciona ──────
-- Por ahora `pedidos` sigue aceptando inserts anónimos directos (INSERT ...
-- WITH CHECK (true)) para que el checkout nunca se rompa mientras despliegas
-- la Edge Function. Cuando confirmes que supabase/functions/create-order está
-- desplegada y funcionando (revisa que lleguen pedidos nuevos normalmente),
-- puedes opcionalmente cerrar también el insert directo para que TODO pedido
-- pase obligatoriamente por la validación del servidor:
--
-- DROP POLICY IF EXISTS "anon_insert_pedidos" ON pedidos;
-- DROP POLICY IF EXISTS "authenticated_insert_pedidos" ON pedidos;
-- (a partir de ahí, la Edge Function necesitaría usar la service_role key en
--  vez de la anon key para poder seguir insertando — avísame cuando llegues
--  a este paso y te ayudo a hacer ese cambio con cuidado.)
