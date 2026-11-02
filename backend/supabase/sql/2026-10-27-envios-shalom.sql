-- ─── MICHT Decants — Datos de envío Shalom por pedido (2026-10-27) ───────────
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run. Se puede correr más de
-- una vez sin problema.
--
-- PARA QUÉ: en el panel, cada pedido de envío tiene ahora «Datos Shalom»: el
-- N° de orden, el código y la clave que te da Shalom al despachar (los escribes
-- tú). Cuando el cliente ya pagó todo, el panel arma el mensaje y te deja
-- mandárselo por WhatsApp con un toque.
--
-- SEGURIDAD: con el código y la clave cualquiera puede recoger el paquete, así que
-- van en una tabla aparte que SOLO el admin puede leer o escribir. No van en la
-- tabla `pedidos` porque esa también la puede leer el cliente dueño del pedido
-- («Mis compras»), y una cuenta se puede crear con cualquier DNI que aún no esté
-- registrado.
--
-- Sin esto el panel sigue funcionando igual; solo no deja guardar los datos de
-- Shalom (te avisa que falta este paso).

CREATE TABLE IF NOT EXISTS pedidos_shalom (
  pedido_id    TEXT PRIMARY KEY REFERENCES pedidos(id) ON DELETE CASCADE,
  numero_orden TEXT NOT NULL DEFAULT '' CHECK (char_length(numero_orden) <= 40),
  codigo       TEXT NOT NULL DEFAULT '' CHECK (char_length(codigo) <= 40),
  clave        TEXT NOT NULL DEFAULT '' CHECK (char_length(clave) <= 40),
  avisado_at   TIMESTAMPTZ,              -- cuándo se le mandó al cliente por WhatsApp
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pedidos_shalom ENABLE ROW LEVEL SECURITY;

-- Solo el admin real (por su rol, no por estar logueado nada más)
DROP POLICY IF EXISTS "admin_all_pedidos_shalom" ON pedidos_shalom;
CREATE POLICY "admin_all_pedidos_shalom" ON pedidos_shalom FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Los visitantes sin cuenta no tienen nada que hacer aquí
REVOKE ALL ON pedidos_shalom FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos_shalom TO authenticated;

-- Comprobación: debe mostrar 1 fila con rowsecurity = true
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pedidos_shalom';
