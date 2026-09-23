-- ─── MICHT Decants — Corregir L'Immensité + crear 212 VIP Black Elixir, ───
-- ─── Forever Wanted Elixir y Sauvage Elixir (Dior), nuevo (2026-09-15) ─────
--
-- Pega esto en Supabase → SQL Editor → Run.
--
-- Qué corrige:
-- 1) L'Immensité (id 0) SÍ existe en `productos`, pero con precios viejos e
--    incorrectos: {"2ml": 32, "3ml": 39, "5ml": 59, "10ml": 119} — verificado
--    en vivo contra la API pública. Los correctos (los mismos que ya están en
--    js/shared/catalog.js) son {"2ml": 15, "3ml": 29, "5ml": 45, "10ml": 89}. Mientras
--    esto no se corrija, la tienda pública está cobrando de más en este perfume.
-- 2) 212 VIP Black Elixir (id 103) y Forever Wanted Elixir (id 104) NO existen
--    en absoluto en `productos` (confirmado en vivo) — por eso en el catálogo
--    público no muestran la talla 2ml: dependiendo del navegador, se completan
--    con datos de respaldo desde el código, y ese respaldo puede quedar
--    atascado con una versión vieja (sin 2ml) cacheada en el localStorage del
--    navegador de quien los vio antes del 8 de septiembre. Insertarlos aquí
--    directamente en Supabase resuelve el problema de raíz para todos los
--    navegadores por igual.
-- 3) Sauvage Elixir de Dior (id 105) es un perfume NUEVO (pedido por el
--    usuario el 2026-09-15, precios confirmados por él: 2ml S/25, 3ml S/29,
--    5ml S/49, 10ml S/99) — se inserta directo aquí para que no quede como
--    "producto fantasma" igual que los dos de arriba.
--
-- Usa INSERT ... ON CONFLICT (id) DO UPDATE: funciona sin importar si la fila
-- ya existe o no, así que es seguro volver a correr este script si hace falta.

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
  '{"2ml": 15, "3ml": 29, "5ml": 45, "10ml": 89}'::jsonb,
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
),
(
  105, 'Sauvage Elixir', 'Dior', 'diseñador', 'hombre', 'noche', 'Ámbar Especiado',
  'Canela, Nuez moscada, Anís estrellado', 'Lavanda', 'Amberwood (ámbar amaderado)',
  'Sauvage Elixir de Dior: la versión más intensa y concentrada de Sauvage. Canela y especias cálidas sobre lavanda, cerrando en un ámbar amaderado envolvente. Potencia y elegancia salvaje en su máxima expresión.',
  '',
  '/img PERFUMES/Sauvage_Elixir_Dior.webp',
  '{"2ml": 25, "3ml": 29, "5ml": 49, "10ml": 99}'::jsonb,
  true, false,
  0, 0,
  false, 0, 0, 0
)
ON CONFLICT (id) DO UPDATE SET
  sizes = EXCLUDED.sizes;

-- Verificación: las 4 filas deben aparecer aquí, todas con "2ml" y L'Immensité en 15.
SELECT id, name, sizes FROM productos WHERE id IN (0, 103, 104, 105) ORDER BY id;
