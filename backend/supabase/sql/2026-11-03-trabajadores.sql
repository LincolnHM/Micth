-- ─── MICHT Decants — Trabajadores: datos y manejo desde el panel ──────────────
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run. Se puede correr más de
-- una vez. Antes debe estar corrido 2026-11-02-vendedoras.sql (si no, se detiene).
--
-- QUÉ AGREGA (para la sección "Trabajadores" del panel):
--   · teléfono y meta de ventas del mes de cada trabajadora;
--   · que el panel muestre su correo y cuándo entró por última vez;
--   · agregar una trabajadora y cambiarle la contraseña DESDE EL PANEL (solo
--     la administradora; ya no hace falta el SQL Editor);
--   · si pausas a una trabajadora, la base rechaza cualquier venta suya.
-- Sin este archivo la sección igual funciona, pero sin esos datos ni botones.

-- ─── 0. Requisito ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.vendedoras') IS NULL OR to_regprocedure('public.crear_vendedora(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Falta un paso: primero corre 2026-11-02-vendedoras.sql (la versión con crear_vendedora).';
  END IF;
END $$;

-- ─── 1. Teléfono y meta del mes ──────────────────────────────────────────────
ALTER TABLE vendedoras ADD COLUMN IF NOT EXISTS telefono     text;
ALTER TABLE vendedoras ADD COLUMN IF NOT EXISTS meta_mensual numeric NOT NULL DEFAULT 0;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendedoras_telefono_largo') THEN
    ALTER TABLE vendedoras ADD CONSTRAINT vendedoras_telefono_largo CHECK (telefono IS NULL OR char_length(telefono) <= 20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendedoras_meta_valida') THEN
    ALTER TABLE vendedoras ADD CONSTRAINT vendedoras_meta_valida CHECK (meta_mensual >= 0 AND meta_mensual <= 1000000);
  END IF;
END $$;
-- (La administradora ya puede editar la tabla con su política; la vendedora solo leer su fila.)

-- ¿Quien llama es la administradora?
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- ─── 2. Lista para el panel: con correo y último ingreso ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_trabajadores()
RETURNS TABLE (user_id uuid, nombre text, activa boolean, telefono text, meta_mensual numeric,
               created_at timestamptz, correo text, ultimo_ingreso timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'Solo la administradora puede ver a las trabajadoras.';
  END IF;
  RETURN QUERY
    SELECT v.user_id, v.nombre, v.activa, v.telefono, v.meta_mensual, v.created_at,
           u.email::text, u.last_sign_in_at
    FROM vendedoras v LEFT JOIN auth.users u ON u.id = v.user_id
    ORDER BY v.activa DESC, v.nombre;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_trabajadores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_trabajadores() TO authenticated;

-- ─── 3. Agregar trabajadora y cambiar contraseña desde el panel ──────────────
CREATE OR REPLACE FUNCTION public.admin_crear_trabajadora(p_email text, p_password text, p_nombre text, p_telefono text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_msg text;
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'Solo la administradora puede agregar trabajadoras.';
  END IF;
  v_msg := public.crear_vendedora(p_email, p_password, p_nombre);
  UPDATE vendedoras v SET telefono = nullif(left(btrim(coalesce(p_telefono, '')), 20), '')
    FROM auth.users u
   WHERE u.id = v.user_id AND lower(u.email) = lower(btrim(p_email));
  RETURN v_msg;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_crear_trabajadora(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_crear_trabajadora(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_clave_trabajadora(p_user_id uuid, p_password text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_nombre text;
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'Solo la administradora puede cambiar contraseñas.';
  END IF;
  SELECT nombre INTO v_nombre FROM vendedoras WHERE user_id = p_user_id;
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'Esa trabajadora no existe.';
  END IF;
  IF length(coalesce(p_password, '')) < 8 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres.';
  END IF;
  UPDATE auth.users
     SET encrypted_password = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
   WHERE id = p_user_id AND coalesce(raw_app_meta_data ->> 'role', '') <> 'admin';
  RETURN 'Listo: ' || v_nombre || ' ya entra con la contraseña nueva.';
END;
$$;
REVOKE ALL ON FUNCTION public.admin_clave_trabajadora(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clave_trabajadora(uuid, text) TO authenticated;

-- ─── 4. Trabajadora pausada: no puede registrar ventas ───────────────────────
-- (Sin esto, una venta suya entraría como pedido normal de la web.)
CREATE OR REPLACE FUNCTION public.vendedora_pausada()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'vendedora' AND NOT public.es_vendedora() THEN
    RAISE EXCEPTION 'Tu acceso está pausado. Habla con la tienda.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.vendedora_pausada() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_ab_vendedora_pausada ON pedidos;
CREATE TRIGGER trg_ab_vendedora_pausada
  BEFORE INSERT ON pedidos FOR EACH ROW EXECUTE FUNCTION public.vendedora_pausada();

-- ─── Comprobación: deben salir tus trabajadoras (esto sí funciona en el SQL Editor) ─
SELECT v.nombre, v.activa, v.meta_mensual, u.email, u.last_sign_in_at AS ultimo_ingreso
FROM vendedoras v LEFT JOIN auth.users u ON u.id = v.user_id;
