-- ─── Combos de Decants (2026-09-22) ────────────────────────────────────────
-- Tabla nueva para el feature "Combos": el admin arma un combo eligiendo
-- perfumes + talla + cantidad de cada uno, y pone el precio final del combo.
-- El "precio antes" (suma de comprarlos por separado) se calcula siempre en
-- vivo desde el catálogo (tabla productos), nunca se guarda congelado aquí.
--
-- Pega este SQL completo en Supabase → SQL Editor → Run.

CREATE TABLE IF NOT EXISTS combos (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT DEFAULT '',
  items        JSONB DEFAULT '[]',   -- [{ "productId": 12, "size": "5ml", "qty": 1 }, ...]
  price        NUMERIC DEFAULT 0,    -- precio final del combo (precio "después")
  image_url    TEXT DEFAULT '',      -- foto propia del combo (opcional); si está vacía, la tienda arma un collage automático con las fotos de los perfumes incluidos
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ
);

-- Por si ya habías corrido una versión anterior de este SQL sin image_url.
ALTER TABLE combos ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

ALTER TABLE combos ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante (anon) puede leer solo los combos activos — es lo que
-- se muestra en la tienda pública.
DROP POLICY IF EXISTS "anon_select_combos_activos" ON combos;
CREATE POLICY "anon_select_combos_activos" ON combos FOR SELECT TO anon
  USING (active = true);

-- Solo el admin (rol real, no cualquier autenticado) puede ver TODOS los
-- combos (incluidos inactivos) y crear/editar/borrar. Mismo patrón que
-- pedidos/productos — exige app_metadata.role = 'admin'.
DROP POLICY IF EXISTS "admin_select_combos" ON combos;
CREATE POLICY "admin_select_combos" ON combos FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_insert_combos" ON combos;
CREATE POLICY "admin_insert_combos" ON combos FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_update_combos" ON combos;
CREATE POLICY "admin_update_combos" ON combos FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_delete_combos" ON combos;
CREATE POLICY "admin_delete_combos" ON combos FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
