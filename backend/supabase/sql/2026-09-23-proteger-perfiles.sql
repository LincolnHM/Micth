-- ─── MICHT Decants — Proteger los perfiles de clientes (2026-09-23) ──────────
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run. Se puede correr más de
-- una vez (usa CREATE OR REPLACE / DROP TRIGGER IF EXISTS).
--
-- PARA QUÉ: cada cliente puede editar su propia fila en `perfiles_usuarios`
-- (la política "owner_update" no limita columnas). Eso permitía dos trampas:
--
--   1. Volver a poner primer_descuento_usado = false y usar el 10 % de primera
--      compra las veces que quisiera.
--   2. Cambiar su DNI por el de otra persona: la sección "Mis compras" muestra
--      los pedidos cuyo DNI coincide con el del perfil, así que probando DNIs
--      uno por uno podía leer nombre, teléfono y dirección de los pedidos de
--      otros clientes.
--
-- Este guardia (trigger) hace que un cliente solo pueda:
--   · crear su perfil (DNI de 6 a 12 letras/números; textos sin < ni >), y
--   · marcar el descuento como usado (false → true), nunca al revés.
-- El DNI y el id no se pueden cambiar después (si un cliente se equivocó de
-- DNI, lo corriges tú desde el SQL Editor o con tu sesión de admin).
--
-- NO afecta al admin, al SQL Editor ni a la service_role.
--
-- ⚠ Para volver atrás:  DROP TRIGGER IF EXISTS trg_proteger_perfil ON perfiles_usuarios;

CREATE OR REPLACE FUNCTION public.proteger_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role     text    := coalesce(current_setting('role', true), '');
  v_is_admin boolean := coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
BEGIN
  IF v_is_admin OR v_role NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.dni := btrim(coalesce(NEW.dni, ''));
    IF NEW.dni !~ '^[0-9A-Za-z]{6,12}$' THEN
      RAISE EXCEPTION 'DNI inválido.';
    END IF;
    NEW.nombre_completo        := left(translate(btrim(coalesce(NEW.nombre_completo, '')), '<>', ''), 120);
    NEW.telefono               := left(translate(btrim(coalesce(NEW.telefono, '')), '<>', ''), 20);
    NEW.primer_descuento_usado := false;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.dni IS DISTINCT FROM OLD.dni THEN
    RAISE EXCEPTION 'El DNI no se puede cambiar. Escríbenos por WhatsApp si te equivocaste.';
  END IF;
  IF coalesce(OLD.primer_descuento_usado, false) AND NOT coalesce(NEW.primer_descuento_usado, false) THEN
    RAISE EXCEPTION 'Operación no permitida.';
  END IF;
  NEW.nombre_completo := left(translate(btrim(coalesce(NEW.nombre_completo, '')), '<>', ''), 120);
  NEW.telefono        := left(translate(btrim(coalesce(NEW.telefono, '')), '<>', ''), 20);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_perfil() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_proteger_perfil ON perfiles_usuarios;
CREATE TRIGGER trg_proteger_perfil
  BEFORE INSERT OR UPDATE ON perfiles_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.proteger_perfil();

-- Comprobación: debe listar 1 fila (trg_proteger_perfil)
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.perfiles_usuarios'::regclass AND NOT tgisinternal;
