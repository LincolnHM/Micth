-- ─── MICHT Decants — Esquema base de la base de datos (REFERENCIA) ───────────
--
-- Qué es esto: cómo se crearon las tablas originales del proyecto. Antes este SQL
-- vivía como comentarios dentro de archivos JS/HTML del sitio público; se movió
-- aquí para que el sitio no describa su propia base de datos.
--
-- Cuándo se usa: solo si algún día armas el proyecto de Supabase desde cero.
-- Si ya está funcionando, NO hace falta correr nada de este archivo.
-- Los cambios posteriores están en backend/supabase/sql/ (con su README, en orden de fecha).
--
-- Las políticas de este archivo ya son las seguras: solo el rol admin puede
-- leer/editar datos de negocio. "USING (true)" para el rol authenticated dejaría
-- pasar a CUALQUIER cliente logueado (es el bug C-01 de la auditoría 2026-08-02).

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. pedidos
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pedidos (
  id             TEXT PRIMARY KEY,
  customer_name  TEXT,
  customer_phone TEXT,
  customer_dni   TEXT,
  delivery_type  TEXT DEFAULT 'recojo',
  department     TEXT,
  province       TEXT,
  shalom_office  TEXT,
  notes          TEXT,
  items          JSONB DEFAULT '[]',
  total          NUMERIC DEFAULT 0,
  status         TEXT DEFAULT 'pendiente',
  payment_method TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ
);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede INSERTAR un pedido (temporal). Ojo: así cualquiera puede mandar
-- un pedido con el total que quiera por POST directo, saltándose el checkout.
-- Se cierra con backend/supabase/sql/2026-08-04-cerrar-insert-directo.sql cuando la Edge
-- Function create-order esté desplegada y probada.
CREATE POLICY "anon_insert_pedidos"          ON pedidos FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "authenticated_insert_pedidos" ON pedidos FOR INSERT TO authenticated WITH CHECK (true);

-- Solo el admin lee, actualiza y borra.
CREATE POLICY "admin_select_pedidos" ON pedidos FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "admin_update_pedidos" ON pedidos FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "admin_delete_pedidos" ON pedidos FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- SQL completo y actualizado: backend/supabase/sql/2026-08-02-security-fixes.sql

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. productos
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS productos (
  id                  INTEGER PRIMARY KEY,
  name                TEXT NOT NULL,
  brand               TEXT NOT NULL,
  type                TEXT DEFAULT 'diseñador',
  gender              TEXT DEFAULT 'unisex',
  occasion            TEXT DEFAULT 'ambas',
  olf_family          TEXT,
  top_notes           TEXT,
  heart_notes         TEXT,
  base_notes          TEXT,
  description         TEXT,
  image_url           TEXT,
  sizes               JSONB DEFAULT '{}',
  in_stock            BOOLEAN DEFAULT true,
  featured            BOOLEAN DEFAULT false,
  bottle_remaining_ml NUMERIC DEFAULT 0,
  bottle_total_ml     NUMERIC DEFAULT 0,
  stock_quantity      INTEGER DEFAULT 0,
  accords             JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ
);

-- Columnas agregadas después (cada una tiene además su archivo en backend/supabase/sql/):
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS accords        JSONB   DEFAULT '[]';   -- 2026-09-08-accords.sql
ALTER TABLE productos ADD COLUMN IF NOT EXISTS cost_price     NUMERIC DEFAULT 0;      -- costo de compra (oculto al público: 2026-08-04b-ocultar-cost-price.sql)

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede LEER el catálogo.
CREATE POLICY "anon_read_productos" ON productos FOR SELECT TO anon USING (true);
-- Solo el admin crea, edita y borra.
CREATE POLICY "admin_all_productos" ON productos FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. perfiles_usuarios  (cuentas de clientes)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS perfiles_usuarios (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo         TEXT NOT NULL,
  dni                     TEXT NOT NULL,
  telefono                TEXT NOT NULL,
  primer_descuento_usado  BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE perfiles_usuarios ADD CONSTRAINT perfiles_usuarios_dni_key UNIQUE (dni);

ALTER TABLE perfiles_usuarios ENABLE ROW LEVEL SECURITY;

-- Cada cliente ve y edita solo su propio perfil.
CREATE POLICY "owner_select" ON perfiles_usuarios FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "owner_insert" ON perfiles_usuarios FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "owner_update" ON perfiles_usuarios FOR UPDATE TO authenticated USING (auth.uid() = id);
-- El admin ve todos los perfiles (sección "Usuarios" del panel).
CREATE POLICY "admin_all" ON perfiles_usuarios FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Verifica si un DNI ya está registrado SIN exponer datos de nadie
-- (SECURITY DEFINER: corre con permisos del dueño y solo devuelve true/false).
CREATE OR REPLACE FUNCTION check_dni_exists(p_dni TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM perfiles_usuarios WHERE dni = p_dni);
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. gastos  (Contabilidad del panel admin)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gastos (
  id          SERIAL PRIMARY KEY,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL,
  description TEXT    NOT NULL,
  amount      NUMERIC NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_gastos" ON gastos FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ═════════════════════════════════════════════════════════════════════════════
-- Otras tablas: se crean en sus propios archivos de backend/supabase/sql/
--   site_settings → 2026-08-02b-site-settings.sql
--   galeria_fotos → 2026-09-09-galeria-fotos.sql
--   combos        → 2026-09-22-combos.sql
-- ═════════════════════════════════════════════════════════════════════════════
