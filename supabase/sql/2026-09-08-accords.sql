-- ─── MICHT Decants — Columna "accords" (acordes principales, estilo Fragrantica) (2026-09-08) ─
--
-- Pega esto en Supabase → SQL Editor → Run. Seguro de ejecutar más de una vez.
--
-- Guarda los acordes principales de cada perfume (ej. "fresco especiado 100%,
-- cítrico 92%...") que se muestran como barras de colores en la ficha de
-- producto, encima de la pirámide Salida/Corazón/Fondo. Formato:
-- [{ "name": "fresco especiado", "pct": 100 }, { "name": "cítrico", "pct": 92 }, ...]

ALTER TABLE productos ADD COLUMN IF NOT EXISTS accords JSONB DEFAULT '[]'::jsonb;

-- La tabla tiene GRANT SELECT por columnas para el rol anon (ver
-- 2026-08-04b-ocultar-cost-price.sql) — sin esto, el catálogo público no
-- podría leer los acordes aunque la columna exista.
GRANT SELECT (accords) ON productos TO anon;
