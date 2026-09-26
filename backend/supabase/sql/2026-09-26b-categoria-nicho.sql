-- ─── MICHT Decants — Nueva categoría "Nicho" (2026-09-26) ─────────────────────
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run. Se puede correr más de
-- una vez.
--
-- PARA QUÉ: la tienda ahora tiene el filtro "Nicho" (casas que solo hacen
-- perfume). Esto pasa a Nicho a los dos perfumes que me indicaste:
--   · Creed Aventus  (id 1)
--   · Erba Pura      (id 2, Xerjoff)
--
-- L'Immensité (Louis Vuitton) se queda como Diseñador: Louis Vuitton es una
-- casa de moda, como Dior o Chanel. Si igual lo quieres en Nicho, cámbialo en el
-- panel: Editar perfume → Tipo → Nicho. (Así también puedes mover cualquier otro.)
--
-- Solo cambia la columna `type`: precios, stock, fotos y pedidos no se tocan.
-- ⚠ Para volver atrás:  UPDATE productos SET type = 'diseñador' WHERE id IN (1, 2);

UPDATE productos SET type = 'nicho' WHERE id IN (1, 2) AND type = 'diseñador';

-- Comprobación: deben salir Creed Aventus y Erba Pura con type = nicho
SELECT id, name, brand, type FROM productos WHERE id IN (0, 1, 2) ORDER BY id;
