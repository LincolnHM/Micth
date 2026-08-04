-- ─── MICHT Decants — Cerrar el insert directo a `pedidos` (2026-08-04) ────────
--
-- ⚠️ NO ejecutar este archivo todavía si no confirmaste que la Edge Function
-- `create-order` YA ESTÁ DESPLEGADA Y FUNCIONANDO (probar un pedido real desde
-- la tienda y verlo aparecer en el panel admin). Si ejecutas esto antes de
-- desplegar la función, NADIE va a poder completar un pedido en la tienda.
--
-- Por qué se hace: un test con curl directo a
-- https://.../rest/v1/pedidos demostró que cualquiera puede insertar un
-- pedido con el "total" que quiera, sin pasar por la validación de precios
-- de la Edge Function create-order (porque esa función no estaba desplegada
-- y el insert directo con la key pública seguía abierto). Al cerrar esta
-- política, la única forma de crear un pedido pasa a ser la Edge Function,
-- que ahora usa la service role key para poder seguir insertando (ver
-- supabase/functions/create-order/index.ts).
--
-- Nota: aunque falle Supabase por completo, el pedido igual le llega al
-- negocio por WhatsApp (checkout.js abre wa.me con los datos del pedido de
-- forma independiente) — Supabase es el registro para el panel admin, no el
-- único canal de aviso al vendedor.

DROP POLICY IF EXISTS "anon_insert_pedidos"          ON pedidos;
DROP POLICY IF EXISTS "authenticated_insert_pedidos" ON pedidos;

-- Verificación rápida — no debería quedar ninguna política de INSERT en pedidos
-- para anon/authenticated (la Edge Function usa service_role, que no necesita
-- política: la service role siempre pasa por encima de RLS):
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE tablename = 'pedidos';
