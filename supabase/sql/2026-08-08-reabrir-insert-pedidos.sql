-- ─── MICHT Decants — Reabrir INSERT en `pedidos` (2026-08-08) ─────────────────
--
-- Por qué: los clientes están viendo "Pedido guardado localmente. Error al
-- sincronizar: new row violates row-level security policy for table pedidos".
-- Eso significa que RLS está bloqueando el insert porque no existe ninguna
-- política de INSERT activa para anon/authenticated en `pedidos` ahora mismo
-- (probablemente porque nunca se ejecutó el SQL original, o porque se cerró
-- con 2026-08-04-cerrar-insert-directo.sql antes de confirmar que la Edge
-- Function `create-order` estaba desplegada y funcionando).
--
-- Este SQL es seguro de ejecutar aunque las políticas ya existan (usa DROP
-- IF EXISTS antes de crear). Pégalo completo en Supabase → SQL Editor → Run.

DROP POLICY IF EXISTS "anon_insert_pedidos"          ON pedidos;
DROP POLICY IF EXISTS "authenticated_insert_pedidos" ON pedidos;

CREATE POLICY "anon_insert_pedidos"          ON pedidos FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "authenticated_insert_pedidos" ON pedidos FOR INSERT TO authenticated WITH CHECK (true);

-- Verificación rápida — deberían aparecer las 2 políticas de arriba (cmd = INSERT):
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE tablename = 'pedidos';

-- Nota de seguridad: esto vuelve a permitir que cualquiera inserte un pedido
-- con el total que quiera saltándose checkout.js (por eso se había cerrado el
-- 2026-08-04). Es el mismo estado en el que el sitio funcionó bien durante
-- semanas antes de ese cierre, así que es un fix seguro para dejar de perder
-- pedidos AHORA. Cuando quieras cerrarlo otra vez de forma segura, hay que
-- desplegar primero supabase/functions/create-order (con Supabase CLI) y
-- CONFIRMAR con un pedido real que llega al panel admin antes de volver a
-- correr supabase/sql/2026-08-04-cerrar-insert-directo.sql. Avísame cuando
-- quieras hacer eso y te guío paso a paso.
