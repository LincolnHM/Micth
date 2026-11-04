-- ─── MICHT Decants — Club MICHT: tarjetas Golden y Black (2026-11-04) ───────
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run. Se puede correr más de
-- una vez. Antes debe estar corrido 2026-09-23-validar-pedidos.sql (si no, se
-- detiene).
--
-- CÓMO FUNCIONA LA TARJETA (lo que pediste):
--   · Solo clientes con cuenta en la página, y solo pedidos hechos en la página
--     con su sesión iniciada. Los pedidos que registras tú en el panel o las
--     ventas de las vendedoras NO suman.
--   · 1 pedido = 1 huellita, no importa cuántos perfumes lleve. La huellita entra
--     cuando marcas el pedido como pagado (o enviado / entregado). Si lo
--     cancelas o lo regresas a pendiente, la huellita se quita sola.
--   · Pedido de S/ 15 a S/ 59.99 → suma en la tarjeta GOLDEN.
--     Pedido desde S/ 60        → suma en la tarjeta BLACK.
--     (Se cuenta el total que paga el cliente, con el 10 % de primera compra si lo
--     usó. Esa primera compra también suma.)
--   · Máximo 1 huellita por día por cliente (para que no partan un pedido en tres).
--   · Huellita de bienvenida: con su PRIMERA compra que suma, el cliente recibe 1
--     huellita extra en esa misma tarjeta. Los clientes que ya tenías empiezan de
--     cero y también reciben la de bienvenida en su próxima compra.
--   · Con 9 huellitas, su pedido número 10 lleva el regalo GRATIS (lo elige en la
--     tienda al pagar; el pedido debe ser desde S/ 15). Ese pedido no suma
--     huellita: con él se completa la tarjeta y empieza una nueva.
--       GOLDEN → 5 ml de cualquier perfume árabe en stock.
--       BLACK  → 5 ml de cualquier árabe o diseñador en stock (nicho no entra,
--                y tampoco L'Immensité ni Sauvage Elixir).
--   · Las huellitas no vencen.
--   · Desde el panel (Club MICHT) puedes dar o quitar huellitas a mano.
--
-- QUÉ CREA:
--   · tabla club_sellos: cada huellita ganada, de bienvenida, a mano o el regalo
--     canjeado (el saldo de una tarjeta es la suma de sus filas);
--   · columnas en pedidos: club_cliente (la cuenta que hizo el pedido) y
--     club_regalo (golden / black si el pedido lleva el regalo);
--   · 3 guardias (triggers): uno revisa el regalo antes de guardar el pedido, otro
--     lo agrega a S/ 0 y marca la cuenta, y el último pone o quita las huellitas
--     cuando cambias el estado;
--   · club_mi_tarjeta(): lo que ve el cliente en la tienda.
--
-- ⚠ SI ALGO SALE MAL (los pedidos de la tienda dejan de llegar), quita los
--   guardias del pedido con:
--     DROP TRIGGER IF EXISTS trg_ac_club_regalo ON pedidos;
--     DROP TRIGGER IF EXISTS trg_zz_club_pedido ON pedidos;
--   (Cambiar el estado de un pedido nunca se bloquea por el Club: si algo falla
--   ahí, solo no se actualiza la tarjeta.)

-- ─── 0. Requisitos ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.perfiles_usuarios') IS NULL OR to_regclass('public.pedidos') IS NULL THEN
    RAISE EXCEPTION 'Faltan las tablas perfiles_usuarios / pedidos.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validar_pedido' AND tgrelid = 'public.pedidos'::regclass) THEN
    RAISE EXCEPTION 'Falta un paso: primero corre 2026-09-23-validar-pedidos.sql.';
  END IF;
END $$;

-- ─── 1. Columnas en pedidos ──────────────────────────────────────────────────
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS club_cliente uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS club_regalo  text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_club_regalo_valido') THEN
    ALTER TABLE pedidos ADD CONSTRAINT pedidos_club_regalo_valido CHECK (club_regalo IS NULL OR club_regalo IN ('golden', 'black'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS pedidos_club_cliente_idx ON pedidos (club_cliente) WHERE club_cliente IS NOT NULL;

-- ─── 2. Huellitas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_sellos (
  id          bigserial PRIMARY KEY,
  cliente_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tarjeta     text NOT NULL CHECK (tarjeta IN ('golden', 'black')),
  -- compra: pedido pagado · bienvenida: la de la 1.ª compra · manual: la diste tú
  -- canje: el regalo (resta 9)
  tipo        text NOT NULL CHECK (tipo IN ('compra', 'bienvenida', 'manual', 'canje')),
  cantidad    int  NOT NULL CHECK (cantidad BETWEEN -9 AND 9 AND cantidad <> 0),
  pedido_id   text REFERENCES pedidos(id) ON DELETE CASCADE,
  nota        text CHECK (nota IS NULL OR char_length(nota) <= 200),
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- Un pedido da como mucho una huellita de cada tipo
CREATE UNIQUE INDEX IF NOT EXISTS club_sellos_pedido_tipo ON club_sellos (pedido_id, tipo) WHERE pedido_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS club_sellos_cliente_idx ON club_sellos (cliente_id, tarjeta);

ALTER TABLE club_sellos ENABLE ROW LEVEL SECURITY;
-- Solo la administradora la lee y la edita (dar / quitar huellitas desde el panel).
-- El cliente ve su tarjeta con club_mi_tarjeta(), nunca la tabla directa.
DROP POLICY IF EXISTS admin_all_club_sellos ON club_sellos;
CREATE POLICY admin_all_club_sellos ON club_sellos FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
REVOKE ALL ON club_sellos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON club_sellos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE club_sellos_id_seq TO authenticated;

-- ─── 3. Funciones de apoyo ───────────────────────────────────────────────────
-- La cuenta de cliente que está haciendo la petición (null si es un visitante
-- sin sesión, la administradora o una vendedora).
CREATE OR REPLACE FUNCTION public.club_cliente_actual()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id FROM perfiles_usuarios p
   WHERE p.id = auth.uid()
     AND coalesce(current_setting('role', true), '') = 'authenticated'
     AND coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') NOT IN ('admin', 'vendedora');
$$;

-- ¿Este perfume se puede elegir como regalo de esa tarjeta?
CREATE OR REPLACE FUNCTION public.club_premio_ok(p_id int, p_tarjeta text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM productos p
     WHERE p.id = p_id
       AND coalesce(p.in_stock, true)
       AND coalesce(p.sizes ->> '5ml', '') ~ '^\d+(\.\d+)?$'
       AND (p.sizes ->> '5ml')::numeric > 0
       AND (coalesce(p.bottle_total_ml, 0) <= 0 OR coalesce(p.bottle_remaining_ml, 0) >= 5)
       AND CASE p_tarjeta
             WHEN 'golden' THEN p.type = 'arabe'
             WHEN 'black'  THEN p.type IN ('arabe', 'diseñador')
                                AND p.name !~* 'immensit'
                                AND p.name !~* 'sauvage\s*elixir'
             ELSE false
           END
  );
$$;

-- Huellitas libres de una tarjeta: el saldo menos 9 por cada regalo que ya pidió
-- y todavía no pagó (así no puede pedir el mismo regalo en dos pedidos).
CREATE OR REPLACE FUNCTION public.club_disponibles(p_uid uuid, p_tarjeta text)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((SELECT sum(s.cantidad) FROM club_sellos s
                    WHERE s.cliente_id = p_uid AND s.tarjeta = p_tarjeta), 0)::int
       - 9 * (SELECT count(*) FROM pedidos p
               WHERE p.club_cliente = p_uid AND p.club_regalo = p_tarjeta
                 AND p.status <> 'cancelado'
                 AND NOT EXISTS (SELECT 1 FROM club_sellos s WHERE s.pedido_id = p.id AND s.tipo = 'canje'))::int;
$$;

-- Estado de una tarjeta para mostrarla
CREATE OR REPLACE FUNCTION public.club_estado(p_uid uuid, p_tarjeta text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'saldo',       coalesce((SELECT sum(s.cantidad) FROM club_sellos s
                              WHERE s.cliente_id = p_uid AND s.tarjeta = p_tarjeta), 0),
    'completadas', (SELECT count(*) FROM club_sellos s
                     WHERE s.cliente_id = p_uid AND s.tarjeta = p_tarjeta AND s.tipo = 'canje'),
    -- regalos pedidos que aún no marcas como pagados
    'regalo_en_camino', (SELECT count(*) FROM pedidos p
                          WHERE p.club_cliente = p_uid AND p.club_regalo = p_tarjeta AND p.status <> 'cancelado'
                            AND NOT EXISTS (SELECT 1 FROM club_sellos s WHERE s.pedido_id = p.id AND s.tipo = 'canje')),
    -- pedidos de su nivel que esperan tu confirmación de pago
    'por_confirmar', (SELECT count(*) FROM pedidos p
                       WHERE p.club_cliente = p_uid AND p.club_regalo IS NULL
                         AND p.status IN ('pendiente', 'separado')
                         AND p.total >= 15
                         AND (CASE WHEN p.total >= 60 THEN 'black' ELSE 'golden' END) = p_tarjeta)
  );
$$;

REVOKE ALL ON FUNCTION public.club_cliente_actual()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.club_premio_ok(int, text)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.club_disponibles(uuid, text)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.club_estado(uuid, text)          FROM PUBLIC, anon, authenticated;

-- ─── 4. Guardia 1 (antes de validar el pedido): revisa el regalo ─────────────
-- La tienda manda el regalo como una línea más con "clubRegalo". Se saca de la
-- lista ANTES de que trg_validar_pedido ponga los precios del catálogo (si no, lo
-- cobraría) y se guarda aparte para el guardia 2.
CREATE OR REPLACE FUNCTION public.club_regalo_revisar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role   text := coalesce(current_setting('role', true), '');
  v_jrole  text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  v_item   jsonb;
  v_rest   jsonb := '[]'::jsonb;
  v_gift   jsonb;
  v_uid    uuid;
  v_tar    text;
  v_pid    int;
  v_motivo text;
  v_prod   record;
BEGIN
  PERFORM set_config('micht.club_regalo', '', true);
  -- Solo pedidos de la tienda; el panel, las vendedoras y el SQL Editor pasan tal cual
  IF v_role NOT IN ('anon', 'authenticated') OR v_jrole IN ('admin', 'vendedora') THEN
    RETURN NEW;
  END IF;
  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.items) LOOP
    IF jsonb_typeof(v_item) = 'object' AND v_item ? 'clubRegalo' THEN
      v_gift := coalesce(v_gift, v_item);          -- como mucho un regalo por pedido
    ELSE
      v_rest := v_rest || jsonb_build_array(v_item);
    END IF;
  END LOOP;
  IF v_gift IS NULL THEN
    RETURN NEW;
  END IF;
  IF jsonb_array_length(v_rest) = 0 THEN
    RAISE EXCEPTION 'Tu regalo del Club MICHT va junto con una compra desde S/ 15.';
  END IF;
  NEW.items := v_rest;

  v_uid := public.club_cliente_actual();
  v_tar := coalesce(v_gift ->> 'clubRegalo', '');
  v_pid := CASE WHEN coalesce(v_gift ->> 'productId', '') ~ '^\d{1,9}$' THEN (v_gift ->> 'productId')::int END;

  IF v_uid IS NULL THEN
    v_motivo := 'no se pudo confirmar su cuenta';
  ELSIF v_tar NOT IN ('golden', 'black') OR v_pid IS NULL THEN
    v_motivo := 'regalo inválido';
  ELSIF NOT public.club_premio_ok(v_pid, v_tar) THEN
    v_motivo := 'ese perfume no entra como regalo o está agotado';
  ELSIF public.club_disponibles(v_uid, v_tar) < 9 THEN
    v_motivo := 'todavía no tiene el regalo listo';
  END IF;

  IF v_motivo IS NULL THEN
    SELECT name, brand INTO v_prod FROM productos WHERE id = v_pid;
    PERFORM set_config('micht.club_regalo', jsonb_build_object(
      'tarjeta', v_tar, 'productId', v_pid, 'name', v_prod.name, 'brand', v_prod.brand)::text, true);
  ELSE
    PERFORM set_config('micht.club_regalo', jsonb_build_object('error', v_motivo)::text, true);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.club_regalo_revisar() FROM PUBLIC, anon, authenticated;

-- Corre antes que trg_validar_pedido (los triggers van en orden alfabético)
DROP TRIGGER IF EXISTS trg_ac_club_regalo ON pedidos;
CREATE TRIGGER trg_ac_club_regalo
  BEFORE INSERT ON pedidos FOR EACH ROW EXECUTE FUNCTION public.club_regalo_revisar();

-- ─── 5. Guardia 2 (después de validar): marca la cuenta y agrega el regalo ───
CREATE OR REPLACE FUNCTION public.club_pedido_marcar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role  text  := coalesce(current_setting('role', true), '');
  v_jrole text  := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  v_raw   text  := coalesce(current_setting('micht.club_regalo', true), '');
  v_gift  jsonb;
  v_note  text;
BEGIN
  PERFORM set_config('micht.club_regalo', '', true);
  IF v_jrole = 'vendedora' THEN               -- las ventas de las vendedoras no suman
    NEW.club_cliente := NULL;
    NEW.club_regalo  := NULL;
    RETURN NEW;
  END IF;
  IF v_role NOT IN ('anon', 'authenticated') OR v_jrole = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Nadie puede ponerse la cuenta de otro: sale de la sesión (null sin sesión)
  NEW.club_cliente := public.club_cliente_actual();
  NEW.club_regalo  := NULL;
  IF v_raw = '' THEN
    RETURN NEW;
  END IF;

  v_gift := v_raw::jsonb;
  IF v_gift ? 'error' THEN
    v_note := '⚠ Pidió su regalo del Club MICHT pero no se aplicó: ' || (v_gift ->> 'error');
  ELSIF coalesce(NEW.total, 0) < 15 THEN
    v_note := '⚠ Pidió su regalo del Club MICHT pero el pedido no llega a S/ 15';
  ELSE
    NEW.items := NEW.items || jsonb_build_array(jsonb_build_object(
      'productId', (v_gift ->> 'productId')::int, 'productName', v_gift ->> 'name', 'brand', v_gift ->> 'brand',
      'size', '5ml', 'price', 0, 'quantity', 1, 'clubRegalo', v_gift ->> 'tarjeta'));
    NEW.club_regalo := v_gift ->> 'tarjeta';
    v_note := '🎁 REGALO CLUB MICHT ' || upper(v_gift ->> 'tarjeta') || ': ' || (v_gift ->> 'brand') || ' ' || (v_gift ->> 'name') || ' 5ml';
  END IF;
  NEW.notes := left(coalesce(nullif(NEW.notes, '') || ' · ', '') || v_note, 500);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.club_pedido_marcar() FROM PUBLIC, anon, authenticated;

-- Corre después de trg_validar_pedido y de los de vendedoras
DROP TRIGGER IF EXISTS trg_zz_club_pedido ON pedidos;
CREATE TRIGGER trg_zz_club_pedido
  BEFORE INSERT ON pedidos FOR EACH ROW EXECUTE FUNCTION public.club_pedido_marcar();

-- ─── 6. Guardia 3: pone o quita huellitas según el estado del pedido ─────────
CREATE OR REPLACE FUNCTION public.club_sincronizar_pedido()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tar text;
  v_dia date;
BEGIN
  BEGIN
    -- Sin cuenta, o el pedido ya no está pagado → se quita lo que haya dado
    IF NEW.club_cliente IS NULL OR NEW.status NOT IN ('pagado', 'enviado', 'entregado') THEN
      DELETE FROM club_sellos WHERE pedido_id = NEW.id AND tipo IN ('compra', 'bienvenida', 'canje');
      RETURN NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM club_sellos WHERE pedido_id = NEW.id AND tipo IN ('compra', 'canje')) THEN
      RETURN NULL;                                                       -- ya contado
    END IF;

    -- Pedido 10: entrega el regalo y completa la tarjeta (no suma huellita)
    IF NEW.club_regalo IN ('golden', 'black') THEN
      INSERT INTO club_sellos (cliente_id, tarjeta, tipo, cantidad, pedido_id, nota)
      VALUES (NEW.club_cliente, NEW.club_regalo, 'canje', -9, NEW.id, NULL)
      ON CONFLICT DO NOTHING;
      RETURN NULL;
    END IF;

    IF coalesce(NEW.total, 0) < 15 THEN
      RETURN NULL;                                                       -- mínimo S/ 15
    END IF;
    v_tar := CASE WHEN NEW.total >= 60 THEN 'black' ELSE 'golden' END;
    v_dia := (coalesce(NEW.created_at, now()) AT TIME ZONE 'America/Lima')::date;
    IF EXISTS (SELECT 1 FROM club_sellos s JOIN pedidos p ON p.id = s.pedido_id
                WHERE s.cliente_id = NEW.club_cliente AND s.tipo = 'compra' AND p.id <> NEW.id
                  AND (p.created_at AT TIME ZONE 'America/Lima')::date = v_dia) THEN
      RETURN NULL;                                                       -- 1 por día
    END IF;

    INSERT INTO club_sellos (cliente_id, tarjeta, tipo, cantidad, pedido_id)
    VALUES (NEW.club_cliente, v_tar, 'compra', 1, NEW.id)
    ON CONFLICT DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM club_sellos WHERE cliente_id = NEW.club_cliente AND tipo = 'bienvenida') THEN
      INSERT INTO club_sellos (cliente_id, tarjeta, tipo, cantidad, pedido_id)
      VALUES (NEW.club_cliente, v_tar, 'bienvenida', 1, NEW.id)
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Nunca bloquear el cambio de estado por el Club
    RAISE WARNING 'Club MICHT: no se actualizó la tarjeta del pedido % (%)', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.club_sincronizar_pedido() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_club_sincronizar ON pedidos;
CREATE TRIGGER trg_club_sincronizar
  AFTER INSERT OR UPDATE OF status, club_cliente, club_regalo ON pedidos
  FOR EACH ROW EXECUTE FUNCTION public.club_sincronizar_pedido();

-- ─── 7. Lo que ve el cliente en la tienda ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.club_mi_tarjeta()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := public.club_cliente_actual();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('miembro', false);
  END IF;
  RETURN jsonb_build_object(
    'miembro', true,
    'golden',  public.club_estado(v_uid, 'golden'),
    'black',   public.club_estado(v_uid, 'black'),
    'historial', coalesce((
      SELECT jsonb_agg(jsonb_build_object('fecha', h.created_at, 'tarjeta', h.tarjeta, 'tipo', h.tipo,
                                          'cantidad', h.cantidad, 'pedido', h.pedido_id, 'nota', h.nota)
                       ORDER BY h.created_at DESC)
        FROM (SELECT * FROM club_sellos WHERE cliente_id = v_uid ORDER BY created_at DESC LIMIT 30) h), '[]'::jsonb),
    'premios', jsonb_build_object(
      'golden', coalesce((SELECT jsonb_agg(id ORDER BY id) FROM productos WHERE public.club_premio_ok(id, 'golden')), '[]'::jsonb),
      'black',  coalesce((SELECT jsonb_agg(id ORDER BY id) FROM productos WHERE public.club_premio_ok(id, 'black')),  '[]'::jsonb))
  );
END;
$$;
-- Un visitante sin sesión recibe {"miembro": false} (así la tienda sabe que el Club está activo)
REVOKE ALL ON FUNCTION public.club_mi_tarjeta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_mi_tarjeta() TO anon, authenticated;

-- ─── 8. Resumen para el panel (solo la administradora) ───────────────────────
CREATE OR REPLACE FUNCTION public.club_admin_resumen()
RETURNS TABLE (cliente_id uuid, golden int, black int, golden_canjes int, black_canjes int, ultimo timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo la administradora puede ver el Club.';
  END IF;
  RETURN QUERY
    SELECT s.cliente_id,
           coalesce(sum(s.cantidad) FILTER (WHERE s.tarjeta = 'golden'), 0)::int,
           coalesce(sum(s.cantidad) FILTER (WHERE s.tarjeta = 'black'),  0)::int,
           (count(*) FILTER (WHERE s.tarjeta = 'golden' AND s.tipo = 'canje'))::int,
           (count(*) FILTER (WHERE s.tarjeta = 'black'  AND s.tipo = 'canje'))::int,
           max(s.created_at)
      FROM club_sellos s
     GROUP BY s.cliente_id;
END;
$$;
REVOKE ALL ON FUNCTION public.club_admin_resumen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_admin_resumen() TO authenticated;

-- ─── Comprobación: deben salir los 3 guardias del Club ───────────────────────
SELECT tgname FROM pg_trigger
 WHERE tgrelid = 'public.pedidos'::regclass AND NOT tgisinternal AND tgname LIKE '%club%'
 ORDER BY tgname;
