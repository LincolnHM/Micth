-- ─── MICHT Decants — Precio "antes" por talla (ofertas) (2026-09-26) ─────────
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run. Se puede correr más de
-- una vez.
--
-- PARA QUÉ: en el panel, cada talla ahora tiene un campo "Antes S/" (opcional).
-- Si pones un precio anterior mayor que el actual, la tienda lo muestra tachado
-- (~~S/ 22~~ S/ 18) con la etiqueta de descuento (-18%).
--
-- Solo es para mostrar: el precio que se cobra sigue siendo el de la talla (la
-- base de datos valida los pedidos con ese precio, no con el "antes").
--
-- Mientras no lo corras, la tienda funciona igual, sin precios tachados.
--
-- La tabla productos da permiso de lectura por columna a los visitantes (anon),
-- por eso va el GRANT: sin él la tienda no podría leer esta columna.
-- ⚠ Para volver atrás:  ALTER TABLE productos DROP COLUMN IF EXISTS precio_antes;

ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_antes jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_precio_antes_objeto;
ALTER TABLE productos ADD CONSTRAINT productos_precio_antes_objeto CHECK (jsonb_typeof(precio_antes) = 'object');

GRANT SELECT (precio_antes) ON productos TO anon;

-- Comprobación: debe listar 1 fila (precio_antes · jsonb)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'productos' AND column_name = 'precio_antes';
