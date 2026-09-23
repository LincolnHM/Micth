-- ─── Combos de Decants (2026-09-22, actualizado 2026-09-22b) ───────────────
-- Tabla para el feature "Combos": el admin elige 2-3 perfumes fijos (uno de
-- cada uno) y pone hasta 4 precios, uno por talla (2ml/3ml/5ml/10ml) — el
-- cliente elige con qué talla quiere TODOS los perfumes del combo y paga el
-- precio de esa talla. Una talla sin precio (0 o ausente) no se ofrece.
-- El "precio antes" (suma de comprarlos por separado en esa talla) se
-- calcula siempre en vivo desde el catálogo (tabla productos), nunca se
-- guarda congelado aquí.
--
-- Pega este SQL completo en Supabase → SQL Editor → Run (es seguro volver a
-- correrlo si ya lo habías hecho antes, no borra nada).

CREATE TABLE IF NOT EXISTS combos (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT DEFAULT '',
  items        JSONB DEFAULT '[]',   -- lista de productId, uno de cada perfume: [12, 1, 31]
  prices       JSONB DEFAULT '{}',   -- precio del combo por talla: { "2ml": 12, "5ml": 17 }
  image_url    TEXT DEFAULT '',      -- foto propia del combo (opcional); si está vacía, la tienda arma un collage automático con las fotos de los perfumes incluidos
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ
);

-- Por si ya habías corrido una versión anterior de este SQL sin estas columnas.
ALTER TABLE combos ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE combos ADD COLUMN IF NOT EXISTS prices JSONB DEFAULT '{}';

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

-- Le avisa a la API de Supabase que la tabla cambió, para que reconozca las
-- columnas nuevas (prices / image_url) de inmediato.
NOTIFY pgrst, 'reload schema';
