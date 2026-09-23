-- ─── MICHT Decants — `gastos` y `perfiles_usuarios`: solo el admin ve todo ──
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede correr más de una vez (usa DROP POLICY IF EXISTS).
--
-- Qué arregla (mismo problema que C-01 de 2026-08-02-security-fixes.sql, pero en
-- otras dos tablas):
--   · `gastos` tenía la política  FOR ALL TO authenticated USING (true)
--     → CUALQUIER cliente con cuenta podía leer/editar/borrar tus gastos.
--   · `perfiles_usuarios` tenía  "admin_all" ... USING (true)
--     → CUALQUIER cliente logueado podía leer los datos (DNI, teléfono) de TODOS.
--
-- Cómo queda: `gastos` solo para el rol admin. `perfiles_usuarios`: cada cliente
-- ve el suyo (políticas owner_*) y el admin ve todos.
--
-- Antes de correrlo: tu usuario del panel ya debe tener app_metadata.role = 'admin'
-- (es lo que hace funcionar 2026-08-02-security-fixes.sql; si Pedidos/Productos ya
-- te funcionan en el panel, lo tienes). Después: cierra sesión y vuelve a entrar en
-- el panel y comprueba que Contabilidad y Usuarios siguen mostrando datos.

-- ─── gastos ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_gastos" ON gastos;
CREATE POLICY "admin_gastos" ON gastos FOR ALL TO authenticated
  USING      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── perfiles_usuarios ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all" ON perfiles_usuarios;
CREATE POLICY "admin_all" ON perfiles_usuarios FOR ALL TO authenticated
  USING      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ─── Comprobación: NO debe aparecer ninguna fila con qual = 'true' ───────────
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename IN ('gastos', 'perfiles_usuarios')
ORDER BY tablename, policyname;
