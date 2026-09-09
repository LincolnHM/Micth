-- ─── MICHT Decants — Crear/forzar los 3 perfumes fantasma con su 2ml (2026-09-09) ─
--
-- Pega esto en Supabase → SQL Editor → Run.
--
-- Por qué hace falta: se confirmó en vivo (curl directo a la API, sin pasar
-- por el navegador) que L'Immensité (id 0), 212 VIP Black Elixir (103) y
-- Forever Wanted Elixir (104) NO existen como filas en `productos`, a pesar
-- de que el script anterior (2026-09-08e) se corrió. Mientras tanto, cada vez
-- que editas L'Immensité desde el panel admin (precio entero, ml del frasco,
-- etc.), el UPDATE se ejecuta contra un ID que no existe — Postgres no marca
-- eso como error, así que el admin muestra "guardado ✓" sin haber guardado
-- nada en la nube. Por eso los cambios "desaparecían".
--
-- Este SQL usa INSERT ... ON CONFLICT (id) DO UPDATE (no "DO NOTHING"): si la
-- fila ya existe, la actualiza igual con estos valores en vez de ignorarla.
-- Así es imposible que quede a medias otra vez. Los valores de L'Immensité
-- son los que ya tenías puestos en el panel admin (precio entero S/1200,
-- frasco 100/100 ml, disponible como entero, 3ml S/39, 5ml S/59, 10ml S/119).

-- Nota: no incluye la columna "accords" a propósito — esa es otra migración
-- separada (2026-09-08-accords.sql) que todavía no corriste en este proyecto.
-- Se puede agregar después sin afectar nada de esto.
INSERT INTO productos (
  id, name, brand, type, gender, occasion, olf_family,
  top_notes, heart_notes, base_notes, description, content_description,
  image_url, sizes, in_stock, featured,
  bottle_remaining_ml, bottle_total_ml,
  available_as_entero, entero_price, stock_quantity, cost_price
) VALUES
(
  0, 'L''Immensité', 'Louis Vuitton', 'diseñador', 'hombre', 'ambas', 'Oriental Especiado',
  'Toronja, Bergamota, Jengibre', 'Romero, Salvia, Geranio, Notas acuáticas', 'Ambroxan, Ámbar, Ládano',
  'L''Immensité de Louis Vuitton: pomelo y jengibre sobre un corazón acuático de romero y salvia, cerrando en ambroxan y ámbar. Inmensidad marina con la firma de alta perfumería de la Maison.',
  '',
  '',
  '{"2ml": 15, "3ml": 39, "5ml": 59, "10ml": 119}'::jsonb,
  true, false,
  100, 100,
  true, 1200, 0, 0
),
(
  103, '212 VIP Black Elixir', 'Carolina Herrera', 'diseñador', 'hombre', 'noche', 'Oriental Fougère',
  'Lavanda', 'Regaliz negro', 'Vainilla',
  '212 VIP Black Elixir de Carolina Herrera: la versión más intensa y envolvente del icónico 212 VIP, con vainilla cálida, especias suaves y un toque de regaliz negro.',
  '',
  '',
  '{"2ml": 15, "3ml": 20, "5ml": 30, "10ml": 60}'::jsonb,
  true, false,
  0, 0,
  false, 0, 0, 0
),
(
  104, 'Forever Wanted Elixir', 'Azzaro', 'diseñador', 'hombre', 'noche', 'Cuero',
  'Frambuesa, Mandarina verde, Bergamota', 'Cardamomo, Lavanda, Esclarea', 'Cuero, Wolfwood, Vetiver',
  'Forever Wanted Elixir de Azzaro: frambuesa jugosa y especias cálidas sobre un fondo de cuero envolvente. La evolución más intensa y sofisticada de la línea Wanted.',
  '',
  '',
  '{"2ml": 15, "3ml": 20, "5ml": 30, "10ml": 60}'::jsonb,
  true, false,
  0, 0,
  false, 0, 0, 0
)
ON CONFLICT (id) DO UPDATE SET
  sizes               = EXCLUDED.sizes,
  available_as_entero = EXCLUDED.available_as_entero,
  entero_price        = EXCLUDED.entero_price,
  bottle_remaining_ml = EXCLUDED.bottle_remaining_ml,
  bottle_total_ml     = EXCLUDED.bottle_total_ml;

-- Verificación: las 3 filas deben aparecer aquí, con "2ml" dentro de sizes.
SELECT id, name, sizes, available_as_entero, entero_price FROM productos WHERE id IN (0, 103, 104);
