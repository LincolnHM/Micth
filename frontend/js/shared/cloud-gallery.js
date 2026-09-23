// ─── Tabla 'galeria_fotos' + bucket 'galeria' en Supabase ────────────────────
// Esquema completo y políticas RLS: ver backend/supabase/sql/2026-09-09-galeria-fotos.sql
//
// Redimensiona/comprime una foto en el navegador antes de subirla — una foto
// de celular sin comprimir puede pesar varios MB, y eso hace lenta la carga
// de la página pública para los visitantes.
function compressImageFile(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale  = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // PNG con transparencia: fondo blanco en vez de negro al pasar a JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen.')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen inválida.')); };
    img.src = url;
  });
}

const CloudGallery = {

  async getAll(categoria) {
    if (!db) return [];
    const { data, error } = await db
      .from('galeria_fotos')
      .select('*')
      .eq('categoria', categoria)
      .order('orden', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Supabase error (galeria_fotos):', error?.code, error?.message);
      return [];
    }
    return data || [];
  },

  async upload(file, categoria, caption = '') {
    if (!db) throw new Error('Sin conexión a Supabase.');
    if (!file || !file.type.startsWith('image/')) throw new Error('Selecciona una imagen válida (JPG, PNG o WebP).');
    if (file.size > 8 * 1024 * 1024) throw new Error('La imagen supera los 8 MB.');

    const blob = await compressImageFile(file);
    const path = `${categoria}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    const { error: uploadError } = await db.storage.from('galeria').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false
    });
    if (uploadError) throw new Error(uploadError.message || 'Error al subir la imagen.');

    const { data: pub } = db.storage.from('galeria').getPublicUrl(path);

    const { data, error } = await db
      .from('galeria_fotos')
      .insert({ categoria, image_url: pub.publicUrl, image_path: path, caption: caption || null })
      .select()
      .single();
    if (error) {
      // La imagen ya se subió al bucket pero no se pudo registrar en la tabla —
      // limpiar el archivo huérfano para no dejar basura en el bucket.
      await db.storage.from('galeria').remove([path]).catch(() => {});
      throw new Error(error.message || 'Error al guardar la foto.');
    }
    return data;
  },

  async remove(id, imagePath) {
    if (!db) return;
    const { error } = await db.from('galeria_fotos').delete().eq('id', id);
    if (error) { console.error('Supabase error al eliminar foto:', error?.code, error?.message); throw new Error(error.message); }
    if (imagePath) await db.storage.from('galeria').remove([imagePath]).catch(() => {});
  }
};
