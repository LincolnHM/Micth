-- ─── MICHT Decants — Ocultar cost_price del catálogo público (2026-08-04) ─────
--
-- Pega esto en Supabase → SQL Editor → Run. Seguro de ejecutar más de una vez.
--
-- Por qué hace falta: la política "anon_read_productos" da acceso de lectura
-- a TODA la tabla `productos`, columna por columna, a cualquier visitante.
-- Eso incluye `cost_price` (tu costo de compra) — cualquiera puede pedirlo
-- directo con un GET a la API (probado en vivo: 2026-08-04, ej.
-- ".../productos?select=id,name,cost_price" devuelve el costo real). Un
-- competidor podría calcular tu margen de ganancia por producto sin entrar
-- siquiera a la web. No es que puedan MODIFICAR nada (eso ya está protegido),
-- solo es una fuga de información de negocio.
--
-- La solución: en vez de dar permiso de lectura a TODA la tabla, se le da
-- permiso solo a las columnas que la tienda pública realmente necesita
-- mostrar. `cost_price` (y `updated_at`, dato interno sin uso público) quedan
-- fuera. El admin (rol authenticated + admin) sigue viendo todo, sin cambios.

REVOKE SELECT ON productos FROM anon;

GRANT SELECT (
  id, name, brand, type, gender, occasion,
  olf_family, top_notes, heart_notes, base_notes,
  description, content_description, image_url,
  sizes, in_stock, featured,
  bottle_remaining_ml, bottle_total_ml,
  available_as_entero, entero_price, stock_quantity,
  created_at
) ON productos TO anon;

-- Verificación rápida (ejecutar aparte, o desde afuera con curl):
-- 1. Esto debería seguir funcionando igual (catálogo público):
--    SELECT id, name, entero_price FROM productos LIMIT 3;  -- como admin, siempre funciona
-- 2. Con la key pública (anon), pedir cost_price ahora debe fallar:
--    GET /rest/v1/productos?select=id,cost_price  →  antes devolvía datos, ahora debe dar error 42501 (permiso denegado)
--    GET /rest/v1/productos?select=id,name,entero_price  →  debe seguir funcionando normal
