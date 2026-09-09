-- ─── MICHT Decants — Galería pública de fotos (Envíos + Clientes) (2026-09-09) ─
--
-- Pega esto en Supabase → SQL Editor → Run. Seguro de ejecutar más de una vez.
--
-- Para qué sirve: crea la tabla que guarda las fotos de la nueva sección
-- pública "Envíos que hacemos" / "Nuestros clientes" (visible en la página
-- principal, no en el admin) y el bucket de Storage donde se guardan los
-- archivos de imagen. No se puede usar el mismo truco de "imagen en base64
-- dentro de la fila" que usan Productos/Anuncio, porque ahí hay un límite de
-- 5000 caracteres pensado para textos cortos — una foto real de celular lo
-- supera por mucho. Por eso las fotos van a un bucket de Storage y en la
-- tabla solo se guarda la URL pública (texto corto).

-- 1) Tabla de fotos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS galeria_fotos (
  id         BIGSERIAL PRIMARY KEY,
  categoria  TEXT NOT NULL CHECK (categoria IN ('envios', 'clientes')),
  image_url  TEXT NOT NULL,
  image_path TEXT,
  caption    TEXT,
  orden      INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE galeria_fotos ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante (con cuenta o sin ella) debe poder VER las fotos, si
-- no, la sección pública quedaría vacía para todo el mundo.
DROP POLICY IF EXISTS "anon_read_galeria_fotos" ON galeria_fotos;
CREATE POLICY "anon_read_galeria_fotos" ON galeria_fotos
  FOR SELECT TO anon, authenticated
  USING (true);

-- Solo el admin real (por rol, no por estar "logueado nada más") puede
-- subir o borrar fotos.
DROP POLICY IF EXISTS "admin_write_galeria_fotos" ON galeria_fotos;
CREATE POLICY "admin_write_galeria_fotos" ON galeria_fotos
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 2) Bucket de Storage para los archivos de imagen ─────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('galeria', 'galeria', true)
ON CONFLICT (id) DO NOTHING;

-- Cualquiera puede VER los archivos del bucket (para que las fotos carguen
-- en la web pública).
DROP POLICY IF EXISTS "anon_read_galeria_bucket" ON storage.objects;
CREATE POLICY "anon_read_galeria_bucket" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'galeria');

-- Solo el admin real puede subir o borrar archivos del bucket.
DROP POLICY IF EXISTS "admin_write_galeria_bucket" ON storage.objects;
CREATE POLICY "admin_write_galeria_bucket" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'galeria' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK (bucket_id = 'galeria' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Verificación rápida:
-- SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'galeria_fotos';
-- SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
-- SELECT * FROM storage.buckets WHERE id = 'galeria';
