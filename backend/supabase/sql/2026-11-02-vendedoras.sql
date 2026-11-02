-- ─── MICHT Decants — Vendedoras: acceso limitado al panel ────────────────────
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run. Se puede correr más de
-- una vez (usa IF NOT EXISTS / CREATE OR REPLACE / DROP … IF EXISTS).
--
-- QUÉ HACE: una vendedora entra al mismo panel (/admin/) con su correo y su
-- contraseña, y SOLO puede:
--   · registrar los pedidos que vende por su WhatsApp, con los precios del
--     catálogo (no puede cambiarlos ni dar descuentos). El pedido queda
--     "Pagado" (ella ya cobró) y el stock se descuenta en ese momento;
--   · ver SUS pedidos (nunca los tuyos, los de la web ni los de otra vendedora);
--   · ver el stock (ml que quedan) y los precios de venta — nunca tu costo;
--   · ver cuánto vendió y cuánto dinero tiene que entregarte;
--   · anular un pedido suyo mientras no lo hayas tocado: el stock vuelve y el
--     pedido queda "Cancelado" con la marca "anulado por la vendedora" (no se
--     borra: tú siempre lo ves).
-- No puede cambiar estados, precios, productos ni ver nada más. Todo esto lo
-- hace cumplir la BASE DE DATOS (no solo el panel): aunque supiera usar la
-- consola del navegador, no podría saltárselo.
--
-- ANTES de este archivo deben estar corridos (si falta alguno, este archivo se
-- detiene y te dice cuál):
--   · 2026-09-23-validar-pedidos.sql        (revisa precios de cada pedido)
--   · 2026-10-19-pagos-por-pedido.sql       (columna de pagos)
--   · 2026-09-09c-stock-entero-para-decants.sql
--
-- CÓMO AGREGAR UNA VENDEDORA (después de correr este archivo), en SQL Editor → Run.
-- Cambia el correo, la contraseña (mínimo 8 caracteres) y el nombre:
--        SELECT crear_vendedora('maria@gmail.com', 'Micht2026!', 'María');
--   Crea su cuenta ya confirmada. Ella entra a michtdecants.com/admin/ con ese
--   correo y esa contraseña. Si el correo ya tenía cuenta, le pone esa contraseña.
-- Para cambiarle la contraseña: vuelve a correr crear_vendedora con la nueva.
-- Para quitarle el acceso (sus ventas quedan registradas):
--        SELECT quitar_vendedora('maria@gmail.com');
-- Para ver tus vendedoras:
--        SELECT nombre, activa, created_at FROM vendedoras;
-- (Otra forma: crear el usuario en Authentication → Users → Add user, con
--  "Auto Confirm User", y luego: SELECT registrar_vendedora('correo', 'Nombre');)

-- ─── 0. Requisitos ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = 'public.pedidos'::regclass AND tgname = 'trg_validar_pedido' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Falta un paso: primero corre 2026-09-23-validar-pedidos.sql (sin eso la vendedora podría registrar precios inventados).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'payments') THEN
    RAISE EXCEPTION 'Falta un paso: primero corre 2026-10-19-pagos-por-pedido.sql.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'productos' AND column_name = 'entero_stock') THEN
    RAISE EXCEPTION 'Falta un paso: primero corre 2026-09-09c-stock-entero-para-decants.sql.';
  END IF;
END $$;

-- ─── 1. Tabla de vendedoras ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendedoras (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 60),
  activa     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vendedoras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_vendedoras" ON vendedoras;
CREATE POLICY "admin_all_vendedoras" ON vendedoras FOR ALL TO authenticated
  USING      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
DROP POLICY IF EXISTS "vendedora_lee_su_fila" ON vendedoras;
CREATE POLICY "vendedora_lee_su_fila" ON vendedoras FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON vendedoras FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON vendedoras TO authenticated;

-- ─── 2. Pedidos: quién lo vendió y si ya te entregó el dinero ────────────────
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS vendedora_id             uuid REFERENCES vendedoras(user_id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS vendedora_nombre         text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS rendido_at               timestamptz;  -- cuándo te entregó ese dinero (null = lo tiene ella)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS anulado_por_vendedora_at timestamptz;
CREATE INDEX IF NOT EXISTS pedidos_vendedora_idx ON pedidos (vendedora_id, created_at DESC);

-- ¿Quien hace la petición es una vendedora activa?
CREATE OR REPLACE FUNCTION public.es_vendedora()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'vendedora'
     AND EXISTS (SELECT 1 FROM vendedoras WHERE user_id = auth.uid() AND activa);
$$;
REVOKE ALL ON FUNCTION public.es_vendedora() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_vendedora() TO authenticated;

-- Ve solo sus propios pedidos (el admin sigue viendo todos con su política)
DROP POLICY IF EXISTS "vendedora_ve_sus_pedidos" ON pedidos;
CREATE POLICY "vendedora_ve_sus_pedidos" ON pedidos FOR SELECT TO authenticated
  USING (vendedora_id = auth.uid() AND public.es_vendedora());
-- No se crea ninguna política de UPDATE ni DELETE para ella: no puede cambiar
-- estados ni borrar. Para anular usa vendedora_anular_pedido() (punto 5).

-- ─── 3. Stock: descontar o devolver lo de un pedido ──────────────────────────
-- La misma regla que el panel (orderStockNeeds + stockPatch en el código):
--   · decant: resta ml del frasco (si llevas control de ml); si no alcanza ni
--     para la talla más chica, queda agotado;
--   · perfume entero: resta unidades;
--   · "Unidad" de un perfume que también va en decant: resta el entero sellado.
-- p_signo = 1 descuenta (y no deja vender lo que no hay), -1 devuelve.
-- Solo la usan los guardias de abajo: nadie puede llamarla desde la web.
CREATE OR REPLACE FUNCTION public.pedido_mover_stock(p_items jsonb, p_signo int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item  jsonb;
  v_ci    jsonb;
  v_mult  int;
  v_lines jsonb := '[]'::jsonb;
  v_need  record;
  r       record;
  v_before numeric;
  v_after  numeric;
  v_min    numeric;
BEGIN
  -- Los combos traen adentro sus perfumes (comboItems): esos son los que salen del frasco
  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) LOOP
    IF jsonb_typeof(v_item -> 'comboItems') = 'array' AND jsonb_array_length(v_item -> 'comboItems') > 0 THEN
      v_mult := CASE WHEN coalesce(v_item ->> 'quantity', '') ~ '^\d{1,4}$' THEN greatest(1, (v_item ->> 'quantity')::int) ELSE 1 END;
      FOR v_ci IN SELECT value FROM jsonb_array_elements(v_item -> 'comboItems') LOOP
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'productId', v_ci ->> 'productId',
          'size',      v_ci ->> 'size',
          'quantity',  v_mult * CASE WHEN coalesce(v_ci ->> 'qty', '') ~ '^\d{1,4}$' THEN greatest(1, (v_ci ->> 'qty')::int) ELSE 1 END));
      END LOOP;
    ELSE
      v_lines := v_lines || jsonb_build_array(v_item);
    END IF;
  END LOOP;

  -- Cuánto sale de cada perfume (suma todas las tallas del mismo frasco)
  FOR v_need IN
    SELECT p.id AS pid,
           sum(CASE WHEN p.type = 'entero' THEN q.n ELSE 0 END) AS units,
           sum(CASE WHEN p.type <> 'entero' AND l ->> 'size' = 'Unidad' THEN q.n ELSE 0 END) AS entero_units,
           sum(CASE WHEN p.type <> 'entero' AND coalesce(l ->> 'size', '') ~ '^\d+(\.\d+)?'
                    THEN substring(l ->> 'size' FROM '^\d+(?:\.\d+)?')::numeric * q.n ELSE 0 END) AS ml
    FROM jsonb_array_elements(v_lines) AS l
    CROSS JOIN LATERAL (SELECT CASE WHEN coalesce(l ->> 'quantity', '') ~ '^\d{1,4}$'
                                    THEN greatest(1, (l ->> 'quantity')::int) ELSE 1 END AS n) AS q
    JOIN productos p ON p.id = CASE WHEN coalesce(l ->> 'productId', '') ~ '^\d{1,9}$' THEN (l ->> 'productId')::int END
    GROUP BY p.id
    ORDER BY p.id               -- siempre el mismo orden: dos ventas a la vez no se traban
  LOOP
    SELECT id, name, brand, type, sizes, in_stock, bottle_total_ml, bottle_remaining_ml, stock_quantity, entero_stock
      INTO r FROM productos WHERE id = v_need.pid FOR UPDATE;

    IF p_signo > 0 AND NOT coalesce(r.in_stock, false) AND (v_need.ml > 0 OR v_need.units > 0) THEN
      RAISE EXCEPTION '% % está agotado.', r.brand, r.name;
    END IF;

    -- Decant: ml del frasco (sin frasco registrado no se toca nada, igual que el panel)
    IF v_need.ml > 0 AND r.type <> 'entero' AND coalesce(r.bottle_total_ml, 0) > 0 THEN
      v_before := coalesce(r.bottle_remaining_ml, 0);
      IF p_signo > 0 AND v_before < v_need.ml THEN
        RAISE EXCEPTION 'No alcanza el stock de % %: quedan % ml y el pedido lleva % ml.',
          r.brand, r.name, round(v_before), round(v_need.ml);
      END IF;
      v_after := greatest(0, least(v_before - p_signo * v_need.ml, greatest(r.bottle_total_ml, v_before)));
      SELECT min(substring(k FROM '^\d+(?:\.\d+)?')::numeric) INTO v_min
        FROM jsonb_object_keys(coalesce(r.sizes, '{}'::jsonb)) AS k
        WHERE k ~ '^\d+(\.\d+)?';
      v_min := coalesce(v_min, 0);
      UPDATE productos SET
        bottle_remaining_ml = v_after,
        in_stock = CASE
          WHEN p_signo > 0 AND v_after < v_min THEN false
          WHEN p_signo < 0 AND NOT coalesce(in_stock, false) AND v_before < v_min AND v_after >= v_min THEN true
          ELSE in_stock END
      WHERE id = r.id;
    END IF;

    -- Perfume entero: unidades
    IF v_need.units > 0 AND r.type = 'entero' THEN
      IF p_signo > 0 AND coalesce(r.stock_quantity, 0) < v_need.units THEN
        RAISE EXCEPTION 'No alcanza el stock de % %: quedan % y el pedido lleva %.',
          r.brand, r.name, coalesce(r.stock_quantity, 0), v_need.units;
      END IF;
      v_after := greatest(0, coalesce(r.stock_quantity, 0) - p_signo * v_need.units);
      UPDATE productos SET stock_quantity = v_after, in_stock = v_after > 0 WHERE id = r.id;
    END IF;

    -- Frasco entero sellado de un perfume que también se vende en decant
    IF v_need.entero_units > 0 AND r.type <> 'entero' THEN
      IF p_signo > 0 AND coalesce(r.entero_stock, 0) < v_need.entero_units THEN
        RAISE EXCEPTION 'No alcanza el stock de % % (entero): quedan % y el pedido lleva %.',
          r.brand, r.name, coalesce(r.entero_stock, 0), v_need.entero_units;
      END IF;
      v_after := greatest(0, coalesce(r.entero_stock, 0) - p_signo * v_need.entero_units);
      UPDATE productos SET entero_stock = v_after, available_as_entero = v_after > 0 WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.pedido_mover_stock(jsonb, int) FROM PUBLIC, anon, authenticated;

-- ─── 4. Guardias del pedido de una vendedora ─────────────────────────────────
-- Corren en este orden (Postgres los ordena por nombre):
--   trg_aa_vendedora_metodo  → guarda cómo le pagaron (el guardia de precios lo borra)
--   trg_pedido_sin_pagos     → (2026-10-19) vacía los pagos
--   trg_validar_pedido       → (2026-09-23) precios reales del catálogo, datos limpios
--   trg_vendedora_pedido     → la marca como vendedora, "Pagado" y sin descuentos
-- y al final, ya guardado: trg_vendedora_pedido_stock → descuenta el stock.

CREATE OR REPLACE FUNCTION public.vendedora_pedido_metodo()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.es_vendedora() THEN
    PERFORM set_config('micht.vendedora_metodo', coalesce(NEW.payment_method, ''), true);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.vendedora_pedido_metodo() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.vendedora_pedido()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nombre text;
  v_metodo text;
  v_total  numeric;
BEGIN
  -- El admin y el SQL Editor pasan tal cual
  IF coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
     OR coalesce(current_setting('role', true), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  -- Un cliente de la web no puede hacerse pasar por vendedora
  IF NOT public.es_vendedora() THEN
    NEW.vendedora_id             := NULL;
    NEW.vendedora_nombre         := NULL;
    NEW.rendido_at               := NULL;
    NEW.anulado_por_vendedora_at := NULL;
    RETURN NEW;
  END IF;

  SELECT nombre INTO v_nombre FROM vendedoras WHERE user_id = auth.uid();
  v_metodo := nullif(current_setting('micht.vendedora_metodo', true), '');
  IF v_metodo IS NULL OR v_metodo NOT IN ('yape', 'efectivo', 'plin', 'transferencia') THEN
    RAISE EXCEPTION 'Elige cómo te pagó el cliente: Yape, efectivo, Plin o transferencia.';
  END IF;

  -- Total = la suma exacta a precio de catálogo (los precios ya los puso el
  -- guardia trg_validar_pedido). Sin descuentos.
  SELECT coalesce(sum((i ->> 'price')::numeric * greatest(1, (i ->> 'quantity')::int)), 0)
    INTO v_total FROM jsonb_array_elements(NEW.items) AS i;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'El pedido no tiene productos con precio.';
  END IF;

  NEW.vendedora_id             := auth.uid();
  NEW.vendedora_nombre         := v_nombre;
  NEW.total                    := round(v_total, 2);
  NEW.status                   := 'pagado';
  NEW.payment_method           := v_metodo;
  NEW.payments                 := jsonb_build_array(jsonb_build_object(
    'id',     'V' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12)),
    'amount', round(v_total, 2),
    'method', v_metodo,
    'date',   to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'note',   left('Cobrado por ' || v_nombre, 120)));
  NEW.rendido_at               := NULL;
  NEW.anulado_por_vendedora_at := NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.vendedora_pedido() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.vendedora_pedido_stock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.vendedora_id IS NOT NULL AND NEW.vendedora_id = auth.uid() AND NEW.status = 'pagado' THEN
    PERFORM public.pedido_mover_stock(NEW.items, 1);   -- si no alcanza, el pedido no se guarda
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.vendedora_pedido_stock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_aa_vendedora_metodo ON pedidos;
CREATE TRIGGER trg_aa_vendedora_metodo
  BEFORE INSERT ON pedidos FOR EACH ROW EXECUTE FUNCTION public.vendedora_pedido_metodo();
DROP TRIGGER IF EXISTS trg_vendedora_pedido ON pedidos;
CREATE TRIGGER trg_vendedora_pedido
  BEFORE INSERT ON pedidos FOR EACH ROW EXECUTE FUNCTION public.vendedora_pedido();
DROP TRIGGER IF EXISTS trg_vendedora_pedido_stock ON pedidos;
CREATE TRIGGER trg_vendedora_pedido_stock
  AFTER INSERT ON pedidos FOR EACH ROW EXECUTE FUNCTION public.vendedora_pedido_stock();

-- ─── 5. Anular un pedido suyo ────────────────────────────────────────────────
-- Solo mientras siga "Pagado" (tú no lo cambiaste) y no te haya entregado ese
-- dinero. Devuelve el stock y lo deja "Cancelado" con la marca de anulado.
CREATE OR REPLACE FUNCTION public.vendedora_anular_pedido(p_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
BEGIN
  IF NOT public.es_vendedora() THEN
    RAISE EXCEPTION 'Solo una vendedora puede anular sus pedidos.';
  END IF;
  SELECT id, status, items, vendedora_id, rendido_at, anulado_por_vendedora_at
    INTO r FROM pedidos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.vendedora_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Ese pedido no existe o no es tuyo.';
  END IF;
  IF r.anulado_por_vendedora_at IS NOT NULL OR r.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ese pedido ya está anulado.';
  END IF;
  IF r.rendido_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ese dinero ya lo entregaste: pídele a la tienda que lo anule.';
  END IF;
  IF r.status <> 'pagado' THEN
    RAISE EXCEPTION 'La tienda ya actualizó este pedido: pídele que lo anule.';
  END IF;
  PERFORM public.pedido_mover_stock(r.items, -1);
  UPDATE pedidos
     SET status = 'cancelado', anulado_por_vendedora_at = now(), updated_at = now()
   WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.vendedora_anular_pedido(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendedora_anular_pedido(text) TO authenticated;

-- ─── 6. Agregar / quitar vendedoras (solo desde este SQL Editor) ─────────────
CREATE OR REPLACE FUNCTION public.registrar_vendedora(p_email text, p_nombre text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_id   uuid;
  v_role text;
BEGIN
  SELECT id, raw_app_meta_data ->> 'role' INTO v_id, v_role
    FROM auth.users WHERE lower(email) = lower(btrim(p_email));
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con el correo %. Créalo primero en Authentication → Users → Add user.', p_email;
  END IF;
  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'El correo % es de un administrador: usa otro correo para la vendedora.', p_email;
  END IF;
  UPDATE auth.users
     SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"vendedora"}'::jsonb
   WHERE id = v_id;
  INSERT INTO vendedoras (user_id, nombre, activa) VALUES (v_id, btrim(p_nombre), true)
    ON CONFLICT (user_id) DO UPDATE SET nombre = EXCLUDED.nombre, activa = true;
  RETURN 'Listo: ' || btrim(p_nombre) || ' ya puede entrar a michtdecants.com/admin/ con ' || p_email;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_vendedora(text, text) FROM PUBLIC, anon, authenticated;

-- Crea la cuenta (correo + contraseña, ya confirmada) y la registra como vendedora.
-- Si el correo ya tiene cuenta, le cambia la contraseña y la marca como vendedora.
CREATE OR REPLACE FUNCTION public.crear_vendedora(p_email text, p_password text, p_nombre text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_id     uuid;
  v_role   text;
  v_nueva  boolean := false;
BEGIN
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'El correo "%" no es válido.', p_email;
  END IF;
  IF length(coalesce(p_password, '')) < 8 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres.';
  END IF;
  IF char_length(v_nombre) < 2 THEN
    RAISE EXCEPTION 'Escribe el nombre de la vendedora.';
  END IF;

  SELECT id, raw_app_meta_data ->> 'role' INTO v_id, v_role
    FROM auth.users WHERE lower(email) = v_email;
  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'El correo % es de un administrador: usa otro correo para la vendedora.', v_email;
  END IF;

  IF v_id IS NULL THEN
    -- Cuenta nueva, ya confirmada (no necesita abrir ningún correo)
    v_id := gen_random_uuid();
    v_nueva := true;
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES (
      coalesce((SELECT instance_id FROM auth.users WHERE instance_id IS NOT NULL LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid),
      v_id, 'authenticated', 'authenticated', v_email, crypt(p_password, gen_salt('bf', 10)), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'vendedora'),
      jsonb_build_object('nombre', v_nombre), now(), now(),
      '', '', '', '');
    -- Su "identidad" de correo: sin ella Supabase no la deja iniciar sesión
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id') THEN
      INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (v_id::text, v_id,
              jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
              'email', now(), now(), now());
    ELSE
      -- Proyectos de Supabase más antiguos (identities.id era el texto del id)
      EXECUTE 'INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
               VALUES ($1, $2, $3, ''email'', now(), now(), now())'
        USING v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email);
    END IF;
  ELSE
    -- Ya tenía cuenta: nueva contraseña, correo confirmado y rol de vendedora
    UPDATE auth.users
       SET encrypted_password = crypt(p_password, gen_salt('bf', 10)),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           raw_app_meta_data  = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"vendedora"}'::jsonb,
           updated_at         = now()
     WHERE id = v_id;
  END IF;

  INSERT INTO vendedoras (user_id, nombre, activa) VALUES (v_id, v_nombre, true)
    ON CONFLICT (user_id) DO UPDATE SET nombre = EXCLUDED.nombre, activa = true;

  RETURN CASE WHEN v_nueva
    THEN 'Listo: ' || v_nombre || ' ya puede entrar a michtdecants.com/admin/ con ' || v_email || ' y la contraseña que pusiste.'
    ELSE 'Listo: ' || v_email || ' ya tenía cuenta; ahora es vendedora (' || v_nombre || ') y entra con la contraseña nueva.'
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_vendedora(text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.quitar_vendedora(p_email text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(btrim(p_email));
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con el correo %.', p_email;
  END IF;
  UPDATE vendedoras SET activa = false WHERE user_id = v_id;
  UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data - 'role'
   WHERE id = v_id AND raw_app_meta_data ->> 'role' = 'vendedora';
  RETURN 'Listo: ' || p_email || ' ya no puede entrar al panel. Sus ventas siguen registradas.';
END;
$$;
REVOKE ALL ON FUNCTION public.quitar_vendedora(text) FROM PUBLIC, anon, authenticated;

-- ─── Comprobación: deben salir los 4 guardias de pedidos de este archivo ─────
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.pedidos'::regclass AND NOT tgisinternal
ORDER BY tgname;
