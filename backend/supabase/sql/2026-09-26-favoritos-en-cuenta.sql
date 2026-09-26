-- ─── MICHT Decants — Favoritos guardados en la cuenta del cliente (2026-09-26) ─
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run. Se puede correr más de
-- una vez (usa IF NOT EXISTS / DROP CONSTRAINT IF EXISTS).
--
-- PARA QUÉ: hasta ahora los favoritos (♡) se guardaban solo en el navegador; si
-- el cliente cambiaba de celular los perdía. Con esta columna, cuando el cliente
-- entra a su cuenta, sus favoritos se guardan en su perfil y aparecen en
-- cualquier celular o computadora donde inicie sesión.
--
-- Mientras no lo corras, la tienda sigue funcionando igual: los favoritos se
-- quedan solo en el navegador, como antes.
--
-- Seguridad: cada cliente solo puede leer y editar SU fila (políticas
-- owner_select / owner_update que ya existen), y el guardia de
-- 2026-09-23-proteger-perfiles.sql sigue impidiendo tocar el DNI o el descuento.
-- La restricción de abajo limita la lista a 300 perfumes.
--
-- ⚠ Para volver atrás:  ALTER TABLE perfiles_usuarios DROP COLUMN IF EXISTS favoritos;

ALTER TABLE perfiles_usuarios ADD COLUMN IF NOT EXISTS favoritos integer[] NOT NULL DEFAULT '{}';

ALTER TABLE perfiles_usuarios DROP CONSTRAINT IF EXISTS perfiles_favoritos_max;
ALTER TABLE perfiles_usuarios ADD CONSTRAINT perfiles_favoritos_max CHECK (cardinality(favoritos) <= 300);

-- Comprobación: debe listar 1 fila (favoritos · ARRAY)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'perfiles_usuarios' AND column_name = 'favoritos';
