-- ─── MICHT Decants — Stock por cantidad para "entero" en decants (2026-09-09) ──
--
-- Pega esto en Supabase → SQL Editor → Run. Seguro de ejecutar más de una vez.
--
-- Por qué hace falta: hasta ahora, un perfume decant que también se vende
-- entero solo tenía un interruptor on/off ("¿se vende entero? sí/no"). Eso no
-- alcanza cuando tienes MÁS DE UN frasco sellado, o cuando vendes uno entero
-- y el sistema, al no saber cuántos quedaban, apagaba TODO el producto
-- (decants incluidos) de un solo golpe. Este cambio agrega una cantidad real
-- (`entero_stock`) — igual a como ya funciona el stock de los perfumes
-- "Entero" dedicados — separada del ml que se usa para sacar decants.

ALTER TABLE productos ADD COLUMN IF NOT EXISTS entero_stock INT DEFAULT 0;

-- Migrar el estado actual: todo producto marcado "disponible como entero"
-- (available_as_entero = true) pasa a tener 1 unidad en stock por defecto —
-- ajusta el número real desde el panel admin si tienes más de una.
UPDATE productos
SET entero_stock = 1
WHERE available_as_entero = true AND entero_stock = 0;

-- Dar acceso de lectura pública a la columna nueva (la tabla tiene permisos
-- por columna para el rol anon — ver 2026-08-04b-ocultar-cost-price.sql).
GRANT SELECT (entero_stock) ON productos TO anon;

-- Verificación:
-- SELECT id, name, available_as_entero, entero_stock, entero_price FROM productos WHERE entero_stock > 0;
