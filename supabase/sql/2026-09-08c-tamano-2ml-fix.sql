-- ─── MICHT Decants — Agregar 2ml por ID (versión robusta) (2026-09-08) ────────
--
-- El SQL anterior (2026-09-08b-tamano-2ml.sql) filtraba por
-- WHERE type = 'diseñador' / 'arabe'. Si al copiar y pegar el archivo la letra
-- "ñ" se transformó en otro carácter (pasa seguido al copiar entre Windows y
-- el navegador), esa condición no encontró ninguna fila y el UPDATE no hizo
-- nada — sin mostrar error, porque "actualizar 0 filas" no es un error para
-- Postgres.
--
-- Este SQL hace lo mismo pero usando el ID de cada perfume (números, sin
-- tildes ni "ñ" de por medio), así que no puede fallar por ese motivo.
-- Seguro de ejecutar más de una vez: si un perfume ya tiene guardado un precio
-- para "2ml", ese precio NO se sobreescribe (jsonb_build_object(...) || sizes
-- deja ganar el valor que ya esté en `sizes`).
--
-- Diseñador (27 perfumes) → 2ml a S/15 fijo.
UPDATE productos
SET sizes = jsonb_build_object('2ml', 15) || sizes
WHERE id IN (0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,81,15,16,17,18,86,95,97,99,103,104,74);

-- Árabe / nicho (65 perfumes) → 2ml en S/0, pendiente de precio.
UPDATE productos
SET sizes = jsonb_build_object('2ml', 0) || sizes
WHERE id IN (19,20,21,22,23,24,25,26,27,28,29,30,31,75,32,33,34,35,76,77,78,79,80,36,37,38,39,40,41,42,43,44,45,46,87,88,89,90,91,47,48,49,50,51,52,53,54,55,56,57,58,59,82,83,84,85,92,93,94,96,98,100,101,102,73);

-- Verificación: después de correr lo de arriba, esto debería devolver 92
-- (los 27 diseñador + 65 árabe). Si devuelve menos, avisa cuántos salieron.
SELECT count(*) AS con_2ml FROM productos WHERE sizes ? '2ml';
