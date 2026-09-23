-- ─── MICHT Decants — La base valida cada pedido que llega de la web (2026-09-23) ─
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run. Se puede correr más de
-- una vez (usa CREATE OR REPLACE / DROP TRIGGER IF EXISTS).
--
-- PARA QUÉ: hoy cualquiera puede mandar un pedido a la tabla `pedidos` con un
-- POST directo (sin pasar por la tienda) y poner el total que quiera (S/ 1 por
-- todo el catálogo), un estado "pagado", textos con código (<script>…) para
-- atacar el panel admin, o inundar la tabla de pedidos falsos. Esto lo cierra
-- SIN tener que desplegar la Edge Function `create-order`: es un "trigger", un
-- guardia dentro de la propia base de datos que revisa cada pedido ANTES de
-- guardarlo:
--
--   · el id debe tener formato ORD-…            (si no, se rechaza)
--   · el estado SIEMPRE queda "pendiente"        (nadie puede crear un pedido ya "pagado")
--   · cada producto y su talla se buscan en tu catálogo y el PRECIO se toma de la
--     base, no de lo que mande el navegador; el nombre y la marca también
--   · los combos se validan contra la tabla `combos` (activo, talla, precio)
--   · el total se corrige si no corresponde: solo se acepta el de la suma real o
--     el de la suma con 10% de descuento (primera compra); cualquier otro → la suma real
--   · se quitan los símbolos < y > de los textos y se recortan a un largo máximo
--   · máximo 8 pedidos por minuto por IP (reutiliza check_order_rate_limit de
--     2026-08-02-security-fixes.sql; si esa función no existe, se omite)
--
-- NO afecta a: el panel admin (registrar pedidos a mano, editar, cambiar estado),
-- el SQL Editor ni la service_role. Solo revisa a los visitantes (rol anon) y a
-- clientes con cuenta (authenticated) que NO sean admin.
--
-- Un pedido normal de la tienda pasa igual que antes: mismos campos, mismos
-- precios. Lo único que cambia es que ya no se puede mentir en el precio.
--
-- ⚠ SI ALGO SALE MAL (los pedidos de la tienda dejan de llegar) — vuelve atrás con:
--     DROP TRIGGER IF EXISTS trg_validar_pedido ON pedidos;
--
-- Prueba al terminar: haz un pedido de prueba desde la tienda y confirma que
-- aparece en el panel con el total correcto.

CREATE OR REPLACE FUNCTION public.validar_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role     text    := coalesce(current_setting('role', true), '');
  v_is_admin boolean := coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
  v_num      text    := '^\d+(\.\d+)?$';
  v_headers  jsonb;
  v_ip       text;
  v_item     jsonb;
  v_items    jsonb   := '[]'::jsonb;
  v_ci_list  jsonb;
  v_comp     text;
  v_pid      int;
  v_qty      int;
  v_size     text;
  v_unit     numeric;
  v_unit_ci  numeric;
  v_sub      numeric := 0;
  v_prod     record;
  v_combo    record;
BEGIN
  -- Solo se revisa a los visitantes de la web. El admin, el SQL Editor y la
  -- service_role (que no usan el rol anon/authenticated) pasan tal cual.
  IF v_is_admin OR v_role NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  -- ── Límite de frecuencia por IP ────────────────────────────────────────────
  BEGIN
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
    v_ip      := btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1));
    IF v_ip <> '' AND NOT check_order_rate_limit(v_ip, 8, 60) THEN
      RAISE EXCEPTION 'Demasiados pedidos seguidos. Espera un minuto e intenta de nuevo.';
    END IF;
  EXCEPTION WHEN undefined_function OR undefined_table OR invalid_text_representation THEN
    NULL;   -- sin la función de límite (o cabeceras raras) no se bloquea el pedido
  END;

  -- ── Campos básicos ─────────────────────────────────────────────────────────
  IF NEW.id IS NULL OR NEW.id !~ '^ORD-[A-Za-z0-9-]{6,40}$' THEN
    RAISE EXCEPTION 'Pedido inválido: identificador.';
  END IF;

  NEW.status         := 'pendiente';
  NEW.payment_method := CASE WHEN NEW.payment_method = 'yape' THEN 'yape' ELSE NULL END;
  NEW.delivery_type  := CASE WHEN NEW.delivery_type = 'envio' THEN 'envio' ELSE 'recojo' END;
  NEW.customer_name  := left(translate(btrim(coalesce(NEW.customer_name,  '')), '<>', ''), 120);
  NEW.customer_phone := left(translate(btrim(coalesce(NEW.customer_phone, '')), '<>', ''), 20);
  NEW.customer_dni   := left(translate(btrim(coalesce(NEW.customer_dni,   '')), '<>', ''), 12);
  NEW.department     := left(translate(btrim(coalesce(NEW.department,     '')), '<>', ''), 60);
  NEW.province       := left(translate(btrim(coalesce(NEW.province,       '')), '<>', ''), 60);
  NEW.shalom_office  := left(translate(btrim(coalesce(NEW.shalom_office,  '')), '<>', ''), 300);
  NEW.notes          := left(translate(btrim(coalesce(NEW.notes,          '')), '<>', ''), 300);
  NEW.created_at     := now();
  NEW.updated_at     := NULL;

  IF length(NEW.customer_name) < 2 THEN
    RAISE EXCEPTION 'Pedido inválido: nombre.';
  END IF;

  -- ── Productos: precio, nombre y marca salen del catálogo ───────────────────
  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array'
     OR jsonb_array_length(NEW.items) = 0 OR jsonb_array_length(NEW.items) > 30 THEN
    RAISE EXCEPTION 'Pedido inválido: productos.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.items) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Pedido inválido: producto.';
    END IF;

    v_qty  := CASE WHEN coalesce(v_item ->> 'quantity', '') ~ '^\d{1,3}$' THEN (v_item ->> 'quantity')::int ELSE 1 END;
    v_qty  := least(greatest(v_qty, 1), 20);
    v_size := left(coalesce(v_item ->> 'size', ''), 30);

    IF (v_item ->> 'isCombo') = 'true' THEN
      -- ── Combo ──────────────────────────────────────────────────────────────
      IF coalesce(v_item ->> 'comboId', '') !~ '^\d{1,9}$' THEN
        RAISE EXCEPTION 'Pedido inválido: combo.';
      END IF;
      SELECT id, title, items, prices, active INTO v_combo
        FROM combos WHERE id = (v_item ->> 'comboId')::int;
      IF NOT FOUND OR NOT coalesce(v_combo.active, false) THEN
        RAISE EXCEPTION 'Uno de los combos ya no está disponible.';
      END IF;
      IF v_size NOT IN ('2ml', '3ml', '5ml', '10ml') THEN
        RAISE EXCEPTION 'Talla inválida para el combo "%".', v_combo.title;
      END IF;
      v_unit := CASE WHEN (v_combo.prices ->> v_size) ~ v_num THEN (v_combo.prices ->> v_size)::numeric ELSE NULL END;
      IF v_unit IS NULL OR v_unit <= 0 THEN
        RAISE EXCEPTION 'El combo "%" no está disponible en talla %.', v_combo.title, v_size;
      END IF;
      v_qty := least(v_qty, 10);

      v_ci_list := '[]'::jsonb;
      v_comp    := '';
      FOR v_pid IN
        SELECT t.value::int FROM jsonb_array_elements_text(coalesce(v_combo.items, '[]'::jsonb)) AS t(value)
        WHERE t.value ~ '^\d{1,9}$'
      LOOP
        SELECT name, brand, sizes INTO v_prod FROM productos WHERE id = v_pid;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'El combo "%" ya no está disponible.', v_combo.title;
        END IF;
        v_unit_ci := CASE WHEN (v_prod.sizes ->> v_size) ~ v_num THEN (v_prod.sizes ->> v_size)::numeric ELSE NULL END;
        IF v_unit_ci IS NULL OR v_unit_ci <= 0 THEN
          RAISE EXCEPTION 'El combo "%" ya no está disponible en talla %.', v_combo.title, v_size;
        END IF;
        v_ci_list := v_ci_list || jsonb_build_array(jsonb_build_object(
          'productId', v_pid, 'size', v_size, 'qty', 1, 'name', v_prod.name, 'brand', v_prod.brand));
        v_comp := v_comp || CASE WHEN v_comp = '' THEN '' ELSE ', ' END || v_prod.brand || ' ' || v_prod.name;
      END LOOP;
      IF jsonb_array_length(v_ci_list) = 0 THEN
        RAISE EXCEPTION 'El combo "%" no tiene perfumes.', v_combo.title;
      END IF;

      v_sub   := v_sub + v_unit * v_qty;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'productId', -v_combo.id, 'productName', v_combo.title, 'brand', 'Combo MICHT',
        'size', v_size, 'price', v_unit, 'quantity', v_qty,
        'isCombo', true, 'comboId', v_combo.id, 'comboItems', v_ci_list, 'comboComposition', v_comp));

    ELSE
      -- ── Producto suelto ────────────────────────────────────────────────────
      IF coalesce(v_item ->> 'productId', '') !~ '^\d{1,9}$' THEN
        RAISE EXCEPTION 'Pedido inválido: producto.';
      END IF;
      v_pid := (v_item ->> 'productId')::int;
      SELECT id, name, brand, type, sizes, entero_price INTO v_prod FROM productos WHERE id = v_pid;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Uno de los productos ya no existe.';
      END IF;

      IF v_size = 'Unidad' AND v_prod.type <> 'entero' THEN
        -- frasco entero sellado de un perfume que también se vende en decant
        v_unit := CASE
          WHEN coalesce(v_prod.entero_price, 0) > 0 THEN v_prod.entero_price
          ELSE (SELECT min(e.value::numeric) FROM jsonb_each_text(coalesce(v_prod.sizes, '{}'::jsonb)) AS e
                WHERE e.value ~ v_num AND e.value::numeric > 0)
        END;
      ELSE
        v_unit := CASE WHEN (v_prod.sizes ->> v_size) ~ v_num THEN (v_prod.sizes ->> v_size)::numeric ELSE NULL END;
      END IF;
      IF v_unit IS NULL OR v_unit <= 0 THEN
        RAISE EXCEPTION '"%" (%) no está disponible.', v_prod.name, v_size;
      END IF;

      v_sub   := v_sub + v_unit * v_qty;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'productId', v_pid, 'productName', v_prod.name, 'brand', v_prod.brand,
        'size', v_size, 'price', v_unit, 'quantity', v_qty));
    END IF;
  END LOOP;

  -- ── Total: la suma real, o la suma con 10 % de descuento (primera compra) ──
  IF NEW.total IS NULL
     OR NEW.total > round(v_sub, 2) + 0.05
     OR NEW.total < round(v_sub * 0.9, 2) - 0.05 THEN
    NEW.total := round(v_sub, 2);
  END IF;

  NEW.items := v_items;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_pedido() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validar_pedido ON pedidos;
CREATE TRIGGER trg_validar_pedido
  BEFORE INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION public.validar_pedido();

-- Comprobación: debe listar 1 fila (trg_validar_pedido, BEFORE INSERT)
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.pedidos'::regclass AND NOT tgisinternal;
