// ─── MICHT Decants — Base de datos Supabase ───────────────────────────────────
//
// INSTRUCCIONES PARA CONFIGURAR SUPABASE (gratis):
// 1. Ve a https://supabase.com y crea una cuenta gratuita
// 2. Crea un nuevo proyecto (guarda tu contraseña de DB)
// 3. Espera ~2 minutos a que se cree el proyecto
// 4. Ve a Settings → API
// 5. Copia tu "Project URL" y pégalo en SUPABASE_URL
// 6. Copia tu "anon public" key y pégala en SUPABASE_ANON_KEY
// 7. Ve a SQL Editor y ejecuta los siguientes SQL para crear las 2 tablas:
//
// CREATE TABLE pedidos (
//   id             TEXT PRIMARY KEY,
//   customer_name  TEXT,
//   customer_phone TEXT,
//   customer_dni   TEXT,
//   delivery_type  TEXT DEFAULT 'recojo',
//   department     TEXT,
//   province       TEXT,
//   shalom_office  TEXT,
//   notes          TEXT,
//   items          JSONB DEFAULT '[]',
//   total          NUMERIC DEFAULT 0,
//   status         TEXT DEFAULT 'pendiente',
//   created_at     TIMESTAMPTZ DEFAULT NOW(),
//   updated_at     TIMESTAMPTZ
// );
//
// -- SEGURIDAD: habilitar RLS y crear políticas
// ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
// -- Clientes anónimos solo pueden INSERTAR (crear pedidos)
// CREATE POLICY "anon_insert_pedidos" ON pedidos FOR INSERT TO anon WITH CHECK (true);
// -- Solo el admin autenticado puede leer, actualizar y eliminar
// CREATE POLICY "admin_select_pedidos" ON pedidos FOR SELECT TO authenticated USING (true);
// CREATE POLICY "admin_update_pedidos" ON pedidos FOR UPDATE TO authenticated USING (true);
// CREATE POLICY "admin_delete_pedidos" ON pedidos FOR DELETE TO authenticated USING (true);
//
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL      = 'https://nvttfrpbdrdtgxulkyln.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2xUgHEI6yI1KjmQSZk3chg_ar98tDZf';



// ─── Detectar si Supabase está configurado ────────────────────────────────────
const SUPABASE_READY = (
  !SUPABASE_URL.includes('TU-PROYECTO') &&
  typeof supabase !== 'undefined'
);

const db = SUPABASE_READY
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Conexión silenciosa — no exponer detalles del stack en consola pública

// ─── Convertir formato Supabase ↔ JavaScript ──────────────────────────────────

function orderFromDB(row) {
  return {
    id:            row.id,
    customerName:  row.customer_name  || '',
    customerPhone: row.customer_phone || '',
    customerDni:   row.customer_dni   || '',
    deliveryType:  row.delivery_type  || 'recojo',
    department:    row.department     || '',
    province:      row.province       || '',
    shalomOffice:  row.shalom_office  || '',
    notes:         row.notes          || '',
    items:         row.items          || [],
    total:         parseFloat(row.total) || 0,
    status:        row.status         || 'pendiente',
    date:          row.created_at,
    updatedAt:     row.updated_at
  };
}

function orderToDB(order) {
  return {
    id:             order.id,
    customer_name:  order.customerName  || '',
    customer_phone: order.customerPhone || '',
    customer_dni:   order.customerDni   || '',
    delivery_type:  order.deliveryType  || 'recojo',
    department:     order.department    || '',
    province:       order.province      || '',
    shalom_office:  order.shalomOffice  || '',
    notes:          order.notes         || '',
    items:          order.items         || [],
    total:          order.total         || 0,
    status:         order.status        || 'pendiente'
  };
}

// ─── Generar ID único para pedido ─────────────────────────────────────────────

function generateOrderId() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const time = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  const rand = String(Math.floor(Math.random() * 100)).padStart(2,'0');
  return `ORD-${date}-${time}${rand}`;
}

// ─── API de pedidos (async, usa Supabase si está configurado) ─────────────────

const CloudOrders = {

  async getAll() {
    if (db) {
      const { data, error } = await db
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.error('Supabase error:', error); return this._localGetAll(); }
      const supabaseOrders = data.map(orderFromDB);
      const localOrders    = Orders.getAll();
      // Construir mapa de status local para sincronización rápida
      const localStatusMap = {};
      localOrders.forEach(o => { localStatusMap[o.id] = o.status; });
      // Aplicar status de localStorage sobre Supabase si difieren
      // (cubre el caso donde el update a Supabase fue lento o falló)
      const mergedSupabase = supabaseOrders.map(so => {
        const localStatus = localStatusMap[so.id];
        if (localStatus && localStatus !== so.status) return { ...so, status: localStatus };
        return so;
      });
      // Incluir pedidos en localStorage que aún no llegaron a Supabase
      // Solo incluir los muy recientes (< 10 min) para evitar "zombies" de borrados
      const supabaseIds  = new Set(mergedSupabase.map(o => o.id));
      const tenMinAgo    = Date.now() - 10 * 60 * 1000;
      const pendingLocal = localOrders.filter(o =>
        !supabaseIds.has(o.id) && new Date(o.date).getTime() > tenMinAgo
      );
      // Limpiar zombies del localStorage (órdenes que ya no están en Supabase y son antiguas)
      const zombies = localOrders.filter(o =>
        !supabaseIds.has(o.id) && new Date(o.date).getTime() <= tenMinAgo
      );
      if (zombies.length) Orders.save(localOrders.filter(o => !zombies.some(z => z.id === o.id)));
      if (!pendingLocal.length) return mergedSupabase;
      return [...mergedSupabase, ...pendingLocal]
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return this._localGetAll();
  },

  async getById(id) {
    if (db) {
      const { data, error } = await db
        .from('pedidos')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) return this._localGetById(id);
      return orderFromDB(data);
    }
    return this._localGetById(id);
  },

  async create(order) {
    const newOrder = {
      ...order,
      id:     generateOrderId(),
      date:   new Date().toISOString(),
      status: 'pendiente'
    };
    if (db) {
      const { error } = await db.from('pedidos').insert(orderToDB(newOrder));
      if (error) {
        console.error('Supabase error al guardar pedido:', error);
        try { this._localCreate(newOrder); } catch {}
      } else {
        try { this._localCreate(newOrder); } catch {}
      }
    } else {
      try { this._localCreate(newOrder); } catch {}
    }
    return newOrder.id;
  },

  async updateStatus(id, status) {
    // Descontar stock cuando se confirma el pago
    if (status === 'pagado') {
      const order = await this.getById(id);
      if (order && order.status !== 'pagado') {
        for (const item of (order.items || [])) {
          const pid     = parseInt(item.productId);
          const product = await CloudProducts.getById(pid);
          if (!product) continue;

          // Perfume entero (tipo entero) → el stock ya se descontó al registrar el pedido
          // Solo sincronizar inStock según la cantidad actual
          if (product.type === 'entero') {
            if ((product.stockQuantity || 0) <= 0 && product.inStock) {
              await CloudProducts.update(pid, { inStock: false });
            }
            continue;
          }

          // Decant vendido como entero (Unidad) → limpiar estado
          if (product.availableAsEntero && item.size === 'Unidad') {
            await CloudProducts.update(pid, { availableAsEntero: false, bottleRemainingMl: 0, inStock: false });
            continue;
          }

          // Decant normal → descontar ml
          const mlUsed = parseInt(item.size) * (item.quantity || 1);
          if (isNaN(mlUsed) || mlUsed <= 0) continue;
          const newRemain = Math.max(0, (product.bottleRemainingMl || 0) - mlUsed);
          await CloudProducts.update(pid, { bottleRemainingMl: newRemain });
        }
      }
    }
    // Actualizar localStorage siempre (fuente de verdad local)
    Orders.updateStatus(id, status);
    if (db) {
      const { error } = await db
        .from('pedidos')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('Supabase error al cambiar estado:', error);
        // El localStorage ya fue actualizado arriba, el error no bloquea la UI
      }
    }
  },

  async delete(id) {
    Orders.delete(id); // Eliminar de localStorage siempre, antes de Supabase
    if (db) {
      const { error } = await db.from('pedidos').delete().eq('id', id);
      if (error) console.error('Supabase error al eliminar pedido:', error);
    }
  },

  async getStats() {
    const all = await this.getAll();
    return {
      total:     all.length,
      pendiente: all.filter(o => o.status === 'pendiente').length,
      pagado:    all.filter(o => o.status === 'pagado').length,
      cancelado: all.filter(o => o.status === 'cancelado').length,
      revenue:   all.filter(o => o.status === 'pagado')
                    .reduce((s, o) => s + o.total, 0)
    };
  },

  // ─── Fallback a localStorage ────────────────────────────────────────────────
  _localGetAll()    { return Orders.getAll(); },
  _localGetById(id) { return Orders.getById(id); },
  _localCreate(o)   {
    // Guardar preservando el ID ya generado (no regenerar con Orders.create)
    const orders = Orders.getAll();
    if (orders.some(e => e.id === o.id)) return; // ya existe, no duplicar
    orders.unshift(o);
    Orders.save(orders);
  }
};

// ─── Tabla 'productos' en Supabase — ejecutar en SQL Editor ──────────────────
//
// CREATE TABLE productos (
//   id                  INTEGER PRIMARY KEY,
//   name                TEXT NOT NULL,
//   brand               TEXT NOT NULL,
//   type                TEXT DEFAULT 'diseñador',
//   gender              TEXT DEFAULT 'unisex',
//   occasion            TEXT DEFAULT 'ambas',
//   olf_family          TEXT,
//   top_notes           TEXT,
//   heart_notes         TEXT,
//   base_notes          TEXT,
//   description         TEXT,
//   image_url           TEXT,
//   sizes               JSONB DEFAULT '{}',
//   in_stock            BOOLEAN DEFAULT true,
//   featured            BOOLEAN DEFAULT false,
//   bottle_remaining_ml NUMERIC DEFAULT 0,
//   bottle_total_ml     NUMERIC DEFAULT 0,
//   stock_quantity      INTEGER DEFAULT 0,
//   created_at          TIMESTAMPTZ DEFAULT NOW(),
//   updated_at          TIMESTAMPTZ
// );
//
// -- Si ya tienes la tabla creada, ejecuta esto para agregar la columna:
// ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;
// -- SEGURIDAD: habilitar RLS y crear políticas
// ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
// -- Clientes anónimos pueden LEER productos (ver catálogo)
// CREATE POLICY "anon_read_productos" ON productos FOR SELECT TO anon USING (true);
// -- Solo el admin autenticado puede crear, editar y eliminar productos
// CREATE POLICY "admin_all_productos" ON productos FOR ALL TO authenticated USING (true);
//
// ─────────────────────────────────────────────────────────────────────────────

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
    stockQuantity:     parseInt(row.stock_quantity)        || 0,
    date:              row.created_at,
    updatedAt:         row.updated_at
  };
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
    stock_quantity:      product.stockQuantity     || 0
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
  enteroPrice: 'entero_price', stockQuantity: 'stock_quantity'
};

// ─── API de productos (async, usa Supabase si está configurado) ───────────────

const CloudProducts = {

  async getAll() {
    if (db) {
      const { data, error } = await db
        .from('productos')
        .select('*')
        .order('id', { ascending: true });
      if (error) { console.error('Supabase error:', error); return Products.getAll(); }
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
        return p;
      });
      // Incluir productos de DEFAULT_PRODUCTS que todavía no están en Supabase
      // Se usa localStorage para capturar cambios de stock/featured ya aplicados localmente
      const supabaseIds   = new Set(supabaseProducts.map(p => p.id));
      const localExtras   = DEFAULT_PRODUCTS
        .filter(p => !supabaseIds.has(p.id))
        .map(p => storedProducts.find(sp => sp.id === p.id) || p);
      const products = localExtras.length
        ? [...supabaseProducts, ...localExtras].sort((a, b) => a.id - b.id)
        : supabaseProducts;
      Products.save(products);
      return products;
    }
    return Products.getAll();
  },

  async getById(id) {
    if (db) {
      const { data, error } = await db
        .from('productos').select('*').eq('id', id).single();
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
      const { error } = await db.from('productos').insert(productToDB(newProduct));
      if (error) console.error('Supabase error:', error);
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
      const { error } = await db.from('productos').update(patch).eq('id', id);
      if (error) {
        console.error('Supabase update error:', error);
        return error;
      }
    }
    return null;
  },

  async delete(id) {
    if (db) {
      const { error } = await db.from('productos').delete().eq('id', id);
      if (error) console.error('Supabase error:', error);
    }
    Products.delete(id);
  },

  async _seedFromDefaults() {
    const products = DEFAULT_PRODUCTS.map(p => ({ ...p }));
    if (db) {
      const rows = products.map(productToDB);
      for (let i = 0; i < rows.length; i += 20) {
        const { error } = await db.from('productos').insert(rows.slice(i, i + 20));
        if (error) console.error('Supabase seed error:', error);
      }
    }
    Products.save(products);
    return products;
  }
};
