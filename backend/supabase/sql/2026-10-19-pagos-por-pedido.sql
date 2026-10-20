-- ─── MICHT Decants — Pagos por pedido: adelantos y pagos divididos (2026-10-19) ─
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run. Se puede correr más de
-- una vez sin problema.
--
-- PARA QUÉ: el panel ahora anota cada pago de un pedido por separado:
--   · pago dividido: una parte por Yape y otra en efectivo
--   · separación: el cliente deja un adelanto y paga el resto después. El pedido
--     queda "Separado" y el panel muestra cuánto falta cobrar.
-- Cada pago se guarda en la columna nueva `payments` de la tabla `pedidos`.
--
-- Sin esto el panel sigue funcionando, pero solo deja marcar un pedido como
-- "Pagado" completo con un solo método, como antes.
--
-- SEGURIDAD: la tienda nunca manda pagos. Un guardia en la base vacía `payments`
-- en cada pedido que llega de un visitante: nadie puede crear un pedido que
-- aparezca "ya pagado" en tu panel. El panel admin no se ve afectado.
--
-- ⚠ SI ALGO SALE MAL (los pedidos de la tienda dejan de llegar), quita el guardia con:
--     DROP TRIGGER IF EXISTS trg_pedido_sin_pagos ON pedidos;

-- 1) Columna de pagos (lista vacía por defecto; los pedidos que ya tienes quedan con [])
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS payments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2) Los pedidos que llegan de la tienda empiezan siempre sin pagos
CREATE OR REPLACE FUNCTION public.pedido_sin_pagos_de_visitantes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- El admin, el SQL Editor y la service_role (que no usan el rol anon/authenticated)
  -- pasan tal cual: el panel sí puede registrar un pedido con sus pagos.
  IF coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
     OR coalesce(current_setting('role', true), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  NEW.payments := '[]'::jsonb;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pedido_sin_pagos_de_visitantes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pedido_sin_pagos ON pedidos;
CREATE TRIGGER trg_pedido_sin_pagos
  BEFORE INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedido_sin_pagos_de_visitantes();

-- Comprobación: debe mostrar 1 fila (payments | jsonb)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'payments';
