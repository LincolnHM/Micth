-- ─── MICHT Decants — Agregar presentación 2ml al catálogo (2026-09-08) ────────
--
-- Pega esto en Supabase → SQL Editor → Run. Seguro de ejecutar más de una vez:
-- si un perfume ya tiene guardado un precio para "2ml" (por ejemplo porque lo
-- agregaste a mano desde el panel admin), ese precio NO se sobreescribe — el
-- UPDATE solo agrega la llave "2ml" cuando todavía no existe.
--
-- Por qué hace falta: los 92 perfumes decant (diseñador + árabe) ya estaban
-- guardados en esta tabla desde antes, así que el cambio en js/data.js
-- (DEFAULT_PRODUCTS) no les llega — ese archivo solo se usa para sembrar la
-- tabla la primera vez que está vacía.

-- Diseñador: 2ml a S/15 fijo.
UPDATE productos
SET sizes = jsonb_build_object('2ml', 15) || sizes
WHERE type = 'diseñador';

-- Árabe / nicho: 2ml en S/0 — aparece deshabilitado ("Consultar") en la web
-- hasta que le pongas precio real desde el panel admin, producto por producto.
UPDATE productos
SET sizes = jsonb_build_object('2ml', 0) || sizes
WHERE type = 'arabe';
