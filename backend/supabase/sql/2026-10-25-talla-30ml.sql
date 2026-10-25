-- ─── MICHT Decants — Nueva talla: decant de 30 ml ─────────────────────────────
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede correr más de una vez: solo agrega el 30 ml a los perfumes que aún
-- no lo tienen (si ya le pusiste un precio a mano en el panel, NO se toca).
--
-- Precio sugerido (a partir del precio del 10 ml de cada perfume):
--   · Árabe      → 10 ml × 2.4, redondeado a S/ 5     (ej. S/ 25 → S/ 60)
--   · Diseñador  → 10 ml × 2.6, redondeado a S/ 5     (ej. S/ 60 → S/ 155)
--   · Nicho      → 10 ml × 2.6                        (ej. S/ 89 → S/ 239)
--   Si el precio del 10 ml termina en 9 (29, 49, 89, 99…), el de 30 ml también
--   termina en 9, para mantener tu estilo.
--
-- Por qué así: el cliente que lleva 30 ml paga menos por ml que en el 10 ml
-- (árabe ~20 % menos, diseñador/nicho ~13 % menos), pero la ganancia por venta
-- sube: un 30 ml deja más que dos de 10 ml. Árabe con menos descuento no tendría
-- sentido frente al frasco entero; diseñador/nicho tienen un costo por ml alto,
-- por eso el descuento es menor.
--
-- No se agrega a: perfumes enteros, combos, ni perfumes sin precio de 10 ml.
-- La tienda muestra el 30 ml "agotado" sola cuando al frasco le quedan menos
-- de 30 ml (si llevas el control de ml en el panel).
-- Después de correrlo, revisa y ajusta los precios en el panel → Precios.

-- ─── 1. Vista previa: qué precio tendría cada perfume (no cambia nada) ──────
SELECT id, brand, name, type,
       sizes ->> '10ml' AS precio_10ml,
       CASE
         WHEN (sizes ->> '10ml')::numeric % 10 = 9
           THEN ceil((sizes ->> '10ml')::numeric * CASE WHEN type = 'arabe' THEN 2.4 ELSE 2.6 END / 10) * 10 - 1
         ELSE round((sizes ->> '10ml')::numeric * CASE WHEN type = 'arabe' THEN 2.4 ELSE 2.6 END / 5) * 5
       END AS precio_30ml_sugerido
FROM productos
WHERE type IN ('arabe', 'diseñador', 'nicho')
  AND coalesce(sizes ->> '10ml', '') ~ '^\d+(\.\d+)?$'
  AND (sizes ->> '10ml')::numeric > 0
  AND NOT (sizes ? '30ml')
ORDER BY type, brand, name;

-- ─── 2. Agregar el 30 ml ─────────────────────────────────────────────────────
UPDATE productos
SET sizes = sizes || jsonb_build_object('30ml',
      CASE
        WHEN (sizes ->> '10ml')::numeric % 10 = 9
          THEN ceil((sizes ->> '10ml')::numeric * CASE WHEN type = 'arabe' THEN 2.4 ELSE 2.6 END / 10) * 10 - 1
        ELSE round((sizes ->> '10ml')::numeric * CASE WHEN type = 'arabe' THEN 2.4 ELSE 2.6 END / 5) * 5
      END)
WHERE type IN ('arabe', 'diseñador', 'nicho')
  AND coalesce(sizes ->> '10ml', '') ~ '^\d+(\.\d+)?$'
  AND (sizes ->> '10ml')::numeric > 0
  AND NOT (sizes ? '30ml');

-- ─── 3. Comprobación: cuántos quedaron con 30 ml, por tipo ──────────────────
SELECT type, count(*) AS perfumes_con_30ml,
       min((sizes ->> '30ml')::numeric) AS desde,
       max((sizes ->> '30ml')::numeric) AS hasta
FROM productos
WHERE sizes ? '30ml'
GROUP BY type
ORDER BY type;

-- ─── Para deshacerlo (quitar el 30 ml de TODOS los perfumes) ─────────────────
-- UPDATE productos SET sizes = sizes - '30ml' WHERE sizes ? '30ml';
