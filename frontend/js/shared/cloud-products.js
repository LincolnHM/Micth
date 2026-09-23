// ─── Tabla 'productos' en Supabase ────────────────────────────────────────────
// Su esquema y permisos están en backend/supabase/schema-reference.sql
// ─────────────────────────────────────────────────────────────────────────────

// Columnas visibles para el rol anon (ver backend/supabase/sql/2026-08-04b-ocultar-cost-price.sql)
// — cost_price y updated_at quedan fuera a propósito. select('*') funciona
// para el admin logueado (rol authenticated ve la tabla completa) pero
// Postgres lo rechaza con 42501 para anon en cuanto falta el permiso de UNA
// sola columna — por eso getAll/getById reintentan con esta lista explícita
// si select('*') falla por permisos.
//
// OJO: NO incluir aquí columnas agregadas después de esta lista base
// (`accords`, `entero_stock`) — si el sitio le pide a Supabase una columna
// que todavía no existe en un proyecto que no corrió esa migración, la
// consulta falla con 42703 y rompe este mismo fallback. Esas dos columnas ya
// tienen manejo de "si no viene en la fila, usar el valor cacheado" más abajo.
const _PRODUCT_PUBLIC_COLUMNS = [
  'id', 'name', 'brand', 'type', 'gender', 'occasion',
  'olf_family', 'top_notes', 'heart_notes', 'base_notes',
  'description', 'content_description', 'image_url',
  'sizes', 'in_stock', 'featured',
  'bottle_remaining_ml', 'bottle_total_ml',
  'available_as_entero', 'entero_price', 'stock_quantity',
  'created_at'
].join(', ');

function productFromDB(row) {
  return {
    id:                row.id,
    name:              row.name              || '',
    brand:             row.brand             || '',
    type:              row.type              || 'diseñador',
    gender:            row.gender            || 'unisex',
    occasion:          row.occasion          || 'ambas',
    olfFamily:         row.olf_family        || '',
    topNotes:          row.top_notes         || '',
    heartNotes:        row.heart_notes       || '',
    baseNotes:         row.base_notes        || '',
    description:       row.description       || '',
    contentDescription: row.content_description || '',
    imageUrl:          row.image_url         || '',
    sizes:             row.sizes             || {},
    inStock:           row.in_stock   !== null ? row.in_stock   : true,
    featured:          row.featured   !== null ? row.featured   : false,
    bottleRemainingMl: parseFloat(row.bottle_remaining_ml) || 0,
    bottleTotalMl:     parseFloat(row.bottle_total_ml)     || 0,
    availableAsEntero: row.available_as_entero             || false,
    enteroPrice:       parseFloat(row.entero_price)        || 0,
    enteroStock:       parseInt(row.entero_stock)          || 0,
    stockQuantity:     parseInt(row.stock_quantity)        || 0,
    costPrice:         parseFloat(row.cost_price)          || 0,
    accords:           Array.isArray(row.accords) ? row.accords : [],
    dupeOf:            row.dupe_of && row.dupe_of.name ? row.dupe_of : null,
    date:              row.created_at,
    updatedAt:         row.updated_at
  };
}

// ─── Control de stock por mililitros (decants) ────────────────────────────────
// Un perfume "decant" (no entero) que tiene frasco registrado (bottleTotalMl > 0)
// solo puede vender un tamaño si el frasco tiene suficiente ml restante.
// Si el producto no tiene frasco registrado (bottleTotalMl === 0), el stock se
// controla solo con el flag inStock (comportamiento manual, sin tracking de ml).

function minDecantSizeMl(sizes) {
  const vals = Object.keys(sizes || {})
    .map(k => parseFloat(k))
    .filter(n => !isNaN(n) && n > 0);
  return vals.length ? Math.min(...vals) : 0;
}

// ¿El tamaño solicitado (clave de `sizes`, ej. "5ml") cabe en el frasco restante?
// `qty` permite validar varias unidades del mismo tamaño a la vez (ej. carrito o pedido manual).
function bottleHasMl(product, sizeKey, qty = 1) {
  if (!product || product.type === 'entero') return true;
  if (!product.bottleTotalMl || product.bottleTotalMl <= 0) return true; // sin tracking
  const sizeMl = parseFloat(sizeKey);
  if (isNaN(sizeMl)) return true;
  return (product.bottleRemainingMl || 0) >= sizeMl * (qty || 1);
}

// ¿Queda algún tamaño vendible? Si el frasco está por debajo del tamaño mínimo,
// el producto se considera agotado aunque inStock siga en true.
function isDecantPurchasable(product) {
  if (!product) return false;
  if (!product.inStock) return false;
  if (product.type === 'entero') return true;
  if (!product.bottleTotalMl || product.bottleTotalMl <= 0) return true;
  const minSize = minDecantSizeMl(product.sizes);
  if (!minSize) return true;
  return (product.bottleRemainingMl || 0) >= minSize;
}

function productToDB(product) {
  const img = product.imageUrl || '';
  return {
    id:                  product.id,
    name:                product.name              || '',
    brand:               product.brand             || '',
    type:                product.type              || 'diseñador',
    gender:              product.gender            || 'unisex',
    occasion:            product.occasion          || 'ambas',
    olf_family:          product.olfFamily         || '',
    top_notes:           product.topNotes          || '',
    heart_notes:         product.heartNotes        || '',
    base_notes:          product.baseNotes         || '',
    description:         product.description       || '',
    content_description: product.contentDescription || '',
    image_url:           img.startsWith('data:image/svg') ? '' : img,
    sizes:               product.sizes             || {},
    in_stock:            product.inStock    !== undefined ? product.inStock    : true,
    featured:            product.featured   !== undefined ? product.featured   : false,
    bottle_remaining_ml: product.bottleRemainingMl || 0,
    bottle_total_ml:     product.bottleTotalMl     || 0,
    available_as_entero: product.availableAsEntero || false,
    entero_price:        product.enteroPrice       || 0,
    entero_stock:        product.enteroStock       || 0,
    stock_quantity:      product.stockQuantity     || 0,
    cost_price:          product.costPrice         || 0,
    accords:             product.accords           || [],
    dupe_of:             product.dupeOf            || null
  };
}

const _PRODUCT_FIELD_MAP = {
  name: 'name', brand: 'brand', type: 'type', gender: 'gender',
  occasion: 'occasion', olfFamily: 'olf_family', topNotes: 'top_notes',
  heartNotes: 'heart_notes', baseNotes: 'base_notes', description: 'description',
  contentDescription: 'content_description',
  imageUrl: 'image_url', sizes: 'sizes', inStock: 'in_stock',
  featured: 'featured', bottleRemainingMl: 'bottle_remaining_ml',
  bottleTotalMl: 'bottle_total_ml', availableAsEntero: 'available_as_entero',
  enteroPrice: 'entero_price', enteroStock: 'entero_stock', stockQuantity: 'stock_quantity',
  costPrice: 'cost_price', accords: 'accords', dupeOf: 'dupe_of'
};

// ─── API de productos (async, usa Supabase si está configurado) ───────────────

// Columnas de `productos` que se agregaron después: si todavía no existen en
// Supabase (SQL sin correr), se guarda igual el resto de los campos en vez de
// perder todo el cambio. Supabase avisa con PGRST204 (API) o 42703 (Postgres).
const PRODUCT_OPTIONAL_COLS = ['stock_quantity', 'available_as_entero', 'entero_price', 'entero_stock', 'cost_price', 'content_description', 'accords', 'dupe_of'];
const _isMissingColumnError = e => !!e && (e.code === '42703' || e.code === 'PGRST204');

const CloudProducts = {

  async getAll() {
    if (db) {
      let { data, error } = await db
        .from('productos')
        .select('*')
        .order('id', { ascending: true });
      // anon no tiene permiso de columna sobre TODA la tabla (cost_price queda
      // oculto a propósito) — select('*') falla con 42501 aunque las columnas
      // públicas sí sean legibles. Reintentar solo con esas.
      if (error && error.code === '42501') {
        ({ data, error } = await db
          .from('productos')
          .select(_PRODUCT_PUBLIC_COLUMNS)
          .order('id', { ascending: true }));
      }
      if (error) { console.error('Supabase error:', error?.code, error?.message); return Products.getAll(); }
      if (!data || !data.length) return this._seedFromDefaults();
      // Leer localStorage antes del map para preservar campos que aún no están en Supabase
      const storedProducts = Products.getAll();
      const supabaseProducts = data.map(row => {
        const p = productFromDB(row);
        // 1. PRODUCT_IMAGE_MAP por nombre (mayor prioridad — decants)
        const mapImg     = typeof PRODUCT_IMAGE_MAP  !== 'undefined' && PRODUCT_IMAGE_MAP[p.name];
        // 2. DEFAULT_PRODUCTS por ID (cubre enteros y otros no presentes en el mapa)
        const defaultImg = typeof DEFAULT_PRODUCTS   !== 'undefined' &&
          DEFAULT_PRODUCTS.find(d => d.id === p.id)?.imageUrl;
        if (mapImg) {
          p.imageUrl = mapImg;
        } else if (defaultImg) {
          p.imageUrl = defaultImg;
        } else if (!p.imageUrl) {
          p.imageUrl = buildProductImage(p);
        } else if (p.imageUrl && !p.imageUrl.startsWith('/') && !p.imageUrl.startsWith('http') && !p.imageUrl.startsWith('data:')) {
          p.imageUrl = '/' + p.imageUrl;
        }
        // Si las columnas aún no existen en Supabase, preservar valores de localStorage
        if (!('available_as_entero' in row)) {
          const cached = storedProducts.find(sp => sp.id === p.id);
          p.availableAsEntero = cached?.availableAsEntero || false;
          p.enteroPrice       = cached?.enteroPrice       || 0;
        }
        if (!('accords' in row)) {
          const cached = storedProducts.find(sp => sp.id === p.id);
          p.accords = cached?.accords || [];
        }
        if (!('dupe_of' in row)) {
          const cached = storedProducts.find(sp => sp.id === p.id);
          p.dupeOf = cached?.dupeOf || null;
        }
        if (!('entero_stock' in row)) {
          const cached = storedProducts.find(sp => sp.id === p.id);
          p.enteroStock = cached?.enteroStock || (p.availableAsEntero ? 1 : 0);
        }
        return p;
      });
      // Incluir productos de DEFAULT_PRODUCTS que todavía no están en Supabase.
      // Ojo: la base es SIEMPRE el DEFAULT_PRODUCTS fresco (no el objeto cacheado
      // completo) — antes se usaba el objeto de localStorage entero si existía,
      // así que un producto nunca sincronizado (ej. "fantasma") quedaba atascado
      // para siempre con los datos viejos con los que se cacheó la primera vez
      // (precios, tallas, etc.), aunque luego se corrigiera en catalog.js. Solo se
      // recuperan del caché los campos que de verdad son estado local mutable
      // (stock/destacado), no el catálogo completo.
      const supabaseIds   = new Set(supabaseProducts.map(p => p.id));
      const localExtras   = DEFAULT_PRODUCTS
        .filter(p => !supabaseIds.has(p.id))
        .map(p => {
          const cached = storedProducts.find(sp => sp.id === p.id);
          return cached ? {
            ...p,
            inStock:            cached.inStock,
            featured:           cached.featured,
            stockQuantity:      cached.stockQuantity,
            bottleRemainingMl:  cached.bottleRemainingMl,
            bottleTotalMl:      cached.bottleTotalMl,
            availableAsEntero:  cached.availableAsEntero,
            enteroPrice:        cached.enteroPrice,
            enteroStock:        cached.enteroStock
          } : p;
        });
      const products = localExtras.length
        ? [...supabaseProducts, ...localExtras].sort((a, b) => a.id - b.id)
        : supabaseProducts;
      Products.save(products);

      // Auto-sincronizar localExtras a Supabase si el admin está logueado
      if (localExtras.length && _isAdminPage) {
        (async () => {
          try {
            const { data: { session } } = await db.auth.getSession();
            if (session) {
              const rows = localExtras.map(productToDB);
              const { error } = await db.from('productos').insert(rows);
              if (error) {
                console.error('[MICHT] Error al auto-sincronizar localExtras:', error.message);
              } else {
                console.log('[MICHT] Auto-sincronizados localExtras a Supabase:', rows.length);
              }
            }
          } catch (e) {
            console.error('[MICHT] Error en auto-sincronización:', e);
          }
        })();
      }

      return products;
    }
    return Products.getAll();
  },

  async getById(id) {
    if (db) {
      let { data, error } = await db
        .from('productos').select('*').eq('id', id).single();
      if (error && error.code === '42501') {
        ({ data, error } = await db
          .from('productos').select(_PRODUCT_PUBLIC_COLUMNS).eq('id', id).single());
      }
      if (error || !data) return Products.getById(id);
      const p = productFromDB(data);
      const mapImg     = typeof PRODUCT_IMAGE_MAP !== 'undefined' && PRODUCT_IMAGE_MAP[p.name];
      const defaultImg = typeof DEFAULT_PRODUCTS  !== 'undefined' &&
        DEFAULT_PRODUCTS.find(d => d.id === p.id)?.imageUrl;
      if (mapImg) {
        p.imageUrl = mapImg;
      } else if (defaultImg) {
        p.imageUrl = defaultImg;
      } else if (!p.imageUrl) {
        p.imageUrl = buildProductImage(p);
      } else if (p.imageUrl && !p.imageUrl.startsWith('/') && !p.imageUrl.startsWith('http') && !p.imageUrl.startsWith('data:')) {
        p.imageUrl = '/' + p.imageUrl;
      }
      if (!('available_as_entero' in data)) {
        const cached = Products.getById(id);
        p.availableAsEntero = cached?.availableAsEntero || false;
        p.enteroPrice       = cached?.enteroPrice       || 0;
      }
      if (!('accords' in data)) {
        p.accords = Products.getById(id)?.accords || [];
      }
      if (!('dupe_of' in data)) {
        p.dupeOf = Products.getById(id)?.dupeOf || null;
      }
      if (!('entero_stock' in data)) {
        p.enteroStock = Products.getById(id)?.enteroStock || (p.availableAsEntero ? 1 : 0);
      }
      return p;
    }
    return Products.getById(id);
  },

  async add(product) {
    const all = await this.getAll();
    const newId = all.length ? Math.max(...all.map(p => p.id)) + 1 : 1;
    const newProduct = {
      ...product,
      id:                newId,
      inStock:           product.inStock           !== undefined ? product.inStock           : true,
      featured:          product.featured          !== undefined ? product.featured          : false,
      bottleRemainingMl: product.bottleRemainingMl || 0,
      bottleTotalMl:     product.bottleTotalMl     || 0
    };
    if (db) {
      let { error } = await db.from('productos').insert(productToDB(newProduct));
      if (_isMissingColumnError(error)) {
        const fallback = productToDB(newProduct);
        PRODUCT_OPTIONAL_COLS.forEach(col => { delete fallback[col]; });
        ({ error } = await db.from('productos').insert(fallback));
        if (!error) console.warn('[MICHT] Faltan columnas opcionales en productos (ej. accords) — ejecuta el SQL de migración en Supabase.');
      }
      if (error) {
        console.error('Supabase error:', error?.code, error?.message);
        throw new Error(`No se pudo guardar en Supabase (${error.code || 'error'}): ${error.message}`);
      }
    }
    const local = Products.getAll();
    local.push(newProduct);
    Products.save(local);
    return newId;
  },

  async update(id, data) {
    Products.update(id, data); // localStorage primero
    if (db) {
      // Construir patch con solo los campos que cambian, traducidos al nombre de columna Supabase
      const patch = { updated_at: new Date().toISOString() };
      Object.entries(data).forEach(([key, val]) => {
        const col = _PRODUCT_FIELD_MAP[key];
        if (col) patch[col] = val;
      });
      let { error } = await db.from('productos').update(patch).eq('id', id);
      // Si falla por columna inexistente (stock_quantity, available_as_entero, etc.),
      // reintentar solo con los campos que sí existen para no perder el update completo
      if (_isMissingColumnError(error)) {
        const fallback = { ...patch };
        PRODUCT_OPTIONAL_COLS.forEach(col => { delete fallback[col]; });
        const retry = await db.from('productos').update(fallback).eq('id', id);
        if (!retry.error) {
          console.warn('[MICHT] Columna faltante en productos — ejecuta el SQL de migración en Supabase. Columna:', error.message);
          return null;
        }
        error = retry.error;
      }
      if (error) {
        console.error('Supabase update error:', error?.code, error?.message);
        return error;
      }
    }
    return null;
  },

  async delete(id) {
    if (db) {
      const { error } = await db.from('productos').delete().eq('id', id);
      if (error) console.error('Supabase error:', error?.code, error?.message);
    }
    Products.delete(id);
  },

  async _seedFromDefaults() {
    const products = DEFAULT_PRODUCTS.map(p => ({ ...p }));
    if (db) {
      const rows = products.map(productToDB);
      for (let i = 0; i < rows.length; i += 20) {
        const { error } = await db.from('productos').insert(rows.slice(i, i + 20));
        if (error) console.error('Supabase seed error:', error?.code);
      }
    }
    Products.save(products);
    return products;
  }
};
