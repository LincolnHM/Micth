-- ─── MICHT Decants — Insertar los 3 perfumes que nunca llegaron a Supabase (2026-09-08) ─
--
-- El diagnóstico anterior mostró que los IDs 0, 103 y 104 NO existen en la
-- tabla `productos` — por eso nunca pudieron recibir el 2ml (ni ningún otro
-- cambio hecho por SQL). La app tiene un mecanismo que debería subirlos solo
-- en cuanto entras al panel admin logueado, pero por alguna razón no lo está
-- logrando para estos 3 (puede revisarse más adelante); mientras tanto, los
-- insertamos a mano aquí, ya con la talla 2ml incluida.
--
-- Para el ID 0 (L'Immensité) usé los precios que TÚ ya tenías puestos en el
-- panel admin (3ml S/39, 5ml S/59, 10ml S/119, entero S/1200, frasco 100/100 ml,
-- disponible como entero) — no los del código, para no pisar lo que ya
-- configuraste. Para 212 VIP Black Elixir (103) y Forever Wanted Elixir (104),
-- que son perfumes agregados hace poco y que probablemente todavía no habías
-- tocado en el admin, usé los valores del catálogo tal cual.
--
-- Seguro de ejecutar más de una vez (ON CONFLICT ... DO NOTHING: si el ID ya
-- existe por cualquier motivo, no lo toca ni lo duplica).

INSERT INTO productos (
  id, name, brand, type, gender, occasion, olf_family,
  top_notes, heart_notes, base_notes, description, content_description,
  image_url, sizes, in_stock, featured,
  bottle_remaining_ml, bottle_total_ml,
  available_as_entero, entero_price, stock_quantity, cost_price, accords
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
  true, 1200, 0, 0,
  '[{"name":"aromático","pct":100},{"name":"fresco especiado","pct":95},{"name":"cítrico","pct":78},{"name":"ámbar","pct":47},{"name":"herbal","pct":37},{"name":"acuático","pct":28},{"name":"almizclado","pct":22},{"name":"fresco","pct":21}]'::jsonb
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
  false, 0, 0, 0,
  '[{"name":"avainillado","pct":100},{"name":"especiado suave","pct":80},{"name":"dulce","pct":54},{"name":"lavanda","pct":53},{"name":"balsámico","pct":31},{"name":"atalcado","pct":30},{"name":"anís","pct":23},{"name":"aromático","pct":21}]'::jsonb
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
  false, 0, 0, 0,
  '[{"name":"cuero","pct":100},{"name":"afrutados","pct":95},{"name":"dulce","pct":67},{"name":"aromático","pct":62},{"name":"animálico","pct":49},{"name":"cítrico","pct":42},{"name":"cálido especiado","pct":36},{"name":"ahumado","pct":30}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Verificación final: ahora sí debería devolver 92.
SELECT count(*) AS con_2ml FROM productos WHERE sizes ? '2ml';
