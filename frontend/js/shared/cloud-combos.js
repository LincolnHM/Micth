// ─── API de combos (async, usa Supabase si está configurado) ─────────────────
// Leer (getAll/getById) cae a localStorage si Supabase falla, para que la
// tienda nunca se rompa. Escribir (add/update/delete) NO: si Supabase rechaza
// el cambio lanza un error claro, porque un combo guardado solo en el
// navegador del admin no lo vería ningún cliente.
// Tabla y permisos: backend/supabase/sql/2026-09-22-combos.sql (correrlo una vez).

function comboFromDB(row) {
  return {
    id:          row.id,
    title:       row.title       || '',
    description: row.description || '',
    items:       Array.isArray(row.items) ? row.items : [], // lista de productId (uno de cada uno)
    prices:      (row.prices && typeof row.prices === 'object') ? row.prices : {}, // { '2ml': 12, '5ml': 17, ... }
    imageUrl:    row.image_url    || '',
    active:      row.active !== null ? row.active : true,
    date:        row.created_at,
    updatedAt:   row.updated_at
  };
}

function comboToDB(combo) {
  return {
    title:       combo.title       || '',
    description: combo.description || '',
    items:       combo.items       || [],
    prices:      combo.prices      || {},
    image_url:   combo.imageUrl    || '',
    active:      combo.active      !== undefined ? combo.active : true
  };
}

// Traduce un error de Supabase sobre `combos` a un mensaje que el admin pueda
// entender y resolver. Antes un error de columnas faltantes (PGRST204) se
// ignoraba: el combo se guardaba solo en el navegador, se mostraba "creado ✓"
// y desaparecía al recargar la lista desde la nube.
function comboDbError(error) {
  const code = error?.code || '';
  const msg  = error?.message || '';
  let text;
  if (code === 'PGRST204' || code === '42703') {
    text = 'A la tabla "combos" de Supabase le faltan columnas (prices / image_url). Ejecuta el archivo backend/supabase/sql/2026-09-22-combos.sql en Supabase → SQL Editor y vuelve a intentar.';
  } else if (code === 'PGRST205' || code === '42P01') {
    text = 'La tabla "combos" todavía no existe en Supabase. Ejecuta backend/supabase/sql/2026-09-22-combos.sql en Supabase → SQL Editor.';
  } else if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    text = 'Supabase no permitió el cambio (permisos). Cierra sesión, entra de nuevo como administrador e inténtalo otra vez.';
  } else {
    text = `No se pudo guardar en Supabase (${code || 'error'}): ${msg}`;
  }
  const err = new Error(text);
  err.code = code;
  return err;
}

const CloudCombos = {

  async getAll() {
    if (db) {
      const { data, error } = await db
        .from('combos')
        .select('*')
        .order('id', { ascending: true });
      if (error) {
        // Tabla aún no creada (42P01) u otro error — no romper el sitio,
        // usar lo que haya en localStorage mientras tanto.
        if (error.code !== '42P01') console.error('Supabase error (combos):', error?.code, error?.message);
        return Combos.getAll();
      }
      const combos = (data || []).map(comboFromDB);
      Combos.save(combos);
      return combos;
    }
    return Combos.getAll();
  },

  async getById(id) {
    if (db) {
      const { data, error } = await db.from('combos').select('*').eq('id', id).single();
      if (error || !data) return Combos.getById(id);
      return comboFromDB(data);
    }
    return Combos.getById(id);
  },

  // Los combos SOLO tienen sentido en la nube (los clientes no ven lo que hay
  // en el navegador del admin), así que add/update/delete NUNCA fingen éxito:
  // si Supabase rechaza el cambio, lanzan un error con un mensaje claro.
  async add(combo) {
    if (!db) return Combos.add(combo);
    const { data, error } = await db.from('combos').insert(comboToDB(combo)).select('id').single();
    if (error) {
      console.error('Supabase error (combos insert):', error.code, error.message);
      throw comboDbError(error);
    }
    const local = Combos.getAll();
    local.push({ ...combo, id: data.id });
    Combos.save(local);
    return data.id;
  },

  async update(id, data) {
    if (!db) { Combos.update(id, data); return; }
    const patch = { updated_at: new Date().toISOString() };
    if (data.title       !== undefined) patch.title       = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.items       !== undefined) patch.items       = data.items;
    if (data.prices      !== undefined) patch.prices      = data.prices;
    if (data.imageUrl    !== undefined) patch.image_url   = data.imageUrl;
    if (data.active      !== undefined) patch.active      = data.active;
    const { data: rows, error } = await db.from('combos').update(patch).eq('id', id).select('id');
    if (error) {
      console.error('Supabase update error (combos):', error.code, error.message);
      throw comboDbError(error);
    }
    // Con RLS, un UPDATE sin permiso no da error: simplemente no toca ninguna fila.
    if (!rows || !rows.length) throw comboDbError({ code: '42501' });
    Combos.update(id, data);
  },

  async delete(id) {
    if (!db) { Combos.delete(id); return; }
    const { data: rows, error } = await db.from('combos').delete().eq('id', id).select('id');
    if (error) {
      console.error('Supabase error (combos delete):', error.code, error.message);
      throw comboDbError(error);
    }
    if (!rows || !rows.length) throw comboDbError({ code: '42501' });
    Combos.delete(id);
  }
};
