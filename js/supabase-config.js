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
//   payment_method TEXT,
//   created_at     TIMESTAMPTZ DEFAULT NOW(),
//   updated_at     TIMESTAMPTZ
// );
//
// -- Si la tabla ya existe, agrega la columna con este SQL:
// ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS payment_method TEXT;
//
// -- COLUMNA COSTO DE ENTRADA (precio de compra por perfume):
// ALTER TABLE productos ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
//
// -- SEGURIDAD: habilitar RLS y crear políticas
// ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
// -- Cualquier usuario (anon o autenticado) puede INSERTAR pedidos (temporal —
// -- ver aviso abajo, esto se cierra en cuanto la Edge Function create-order
// -- esté desplegada y confirmada funcionando).
// CREATE POLICY "anon_insert_pedidos"          ON pedidos FOR INSERT TO anon          WITH CHECK (true);
// CREATE POLICY "authenticated_insert_pedidos" ON pedidos FOR INSERT TO authenticated WITH CHECK (true);
// -- ¡IMPORTANTE! Con solo esto, cualquiera puede insertar un pedido con el
// -- total que quiera con un POST directo (curl, Postman, etc.), saltándose
// -- checkout.js por completo — así lo demostró un test real (2026-08-04).
// -- En cuanto despliegues supabase/functions/create-order y confirmes que
// -- funciona, ejecuta supabase/sql/2026-08-04-cerrar-insert-directo.sql para
// -- eliminar estas 2 políticas y forzar que TODO pedido pase por la validación
// -- de precios y el límite de frecuencia del servidor.
// -- Solo el admin (rol real, no "cualquier autenticado") puede leer, actualizar y eliminar.
// -- ¡OJO! "USING (true)" aquí sería el bug de seguridad C-01 del informe de
// -- auditoría (2026-08-02): dejaría que CUALQUIER cliente logueado lea/edite/
// -- borre los pedidos de todos. El chequeo de app_metadata.role es obligatorio.
// CREATE POLICY "admin_select_pedidos" ON pedidos FOR SELECT TO authenticated
//   USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
// CREATE POLICY "admin_update_pedidos" ON pedidos FOR UPDATE TO authenticated
//   USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
// CREATE POLICY "admin_delete_pedidos" ON pedidos FOR DELETE TO authenticated
//   USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
// -- SQL completo, listo para copiar/pegar: supabase/sql/2026-08-02-security-fixes.sql
//
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL      = 'https://nvttfrpbdrdtgxulkyln.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2xUgHEI6yI1KjmQSZk3chg_ar98tDZf';



// ─── Detectar si Supabase está configurado ────────────────────────────────────
const SUPABASE_READY = (
  !SUPABASE_URL.includes('TU-PROYECTO') &&
  typeof supabase !== 'undefined'
);

// En páginas de admin se conserva la sesión autenticada.
// En tienda/nosotros/contacto se fuerza rol anónimo para que los pedidos
// de clientes nunca sean bloqueados por RLS aunque el admin esté logueado.
const _isAdminPage = typeof window !== 'undefined' &&
  window.location.pathname.toLowerCase().includes('admin');

const db = SUPABASE_READY
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
      _isAdminPage
        ? {}
        : { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    )
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
    paymentMethod: row.payment_method || null,
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
    status:         order.status        || 'pendiente',
    payment_method: order.paymentMethod || null
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

  _lastFetchFromSupabase: false,
  _lastFetchError: null,
  _lastFetchCount: 0,

  async getAll() {
    if (db) {
      const { data, error } = await db
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) {
        console.error('Supabase error:', error?.code, error?.message);
        this._lastFetchFromSupabase = false;
        this._lastFetchError = `${error.code || ''}: ${error.message || 'error desconocido'}`;
        this._lastFetchCount = 0;
        return this._localGetAll();
      }
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
      // Incluir pedidos en localStorage que aún no llegaron a Supabase.
      // Los marcados con _pendingSync (insert falló) se mantienen indefinidamente.
      const supabaseIds  = new Set(mergedSupabase.map(o => o.id));
      const tenMinAgo    = Date.now() - 10 * 60 * 1000;
      const pendingLocal = localOrders.filter(o =>
        !supabaseIds.has(o.id) && (o._pendingSync || new Date(o.date).getTime() > tenMinAgo)
      );
      // Limpiar zombies del localStorage (órdenes que ya no están en Supabase y son antiguas)
      // Solo limpiar si Supabase devolvió datos reales — evita borrar datos cuando hay error de auth/red
      const zombies = supabaseOrders.length > 0
        ? localOrders.filter(o =>
            !supabaseIds.has(o.id) &&
            !o._pendingSync &&
            new Date(o.date).getTime() <= tenMinAgo
          )
        : [];
      if (zombies.length) Orders.save(localOrders.filter(o => !zombies.some(z => z.id === o.id)));
      this._lastFetchFromSupabase = true;
      this._lastFetchError = null;
      this._lastFetchCount = supabaseOrders.length;
      if (!pendingLocal.length) return mergedSupabase;
      return [...mergedSupabase, ...pendingLocal]
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    this._lastFetchFromSupabase = false;
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
      status: order.status || 'pendiente'
    };
    // Guardar en localStorage primero — garantiza que no se pierde el pedido
    try { this._localCreate(newOrder); } catch {}

    if (db) {
      // Ruta preferida: Edge Function create-order — revalida los precios
      // contra el catálogo real y aplica límite de frecuencia por IP antes
      // de guardar (ver auditoría de seguridad, hallazgo H-02). Si la función
      // todavía no está desplegada o no responde, cae al insert directo de
      // siempre como respaldo — el pedido nunca se pierde.
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey':        SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ ...order, id: newOrder.id })
        });

        if (res.ok) {
          const serverOrder = await res.json().catch(() => null);
          this._markSynced(newOrder.id, serverOrder?.total);
          return newOrder.id;
        }

        // La función respondió pero rechazó el pedido (datos inválidos o
        // demasiados intentos seguidos) — no seguir al insert directo, que
        // se saltaría exactamente esa validación.
        if (res.status === 400 || res.status === 429) {
          const errBody = await res.json().catch(() => ({}));
          this._markPending(newOrder.id);
          const _toast = typeof showToast === 'function' ? showToast
            : typeof showCartToast === 'function' ? showCartToast : null;
          if (_toast) _toast('⚠ ' + (errBody.error || 'No se pudo registrar el pedido.'));
          return newOrder.id;
        }

        throw new Error(`create-order respondió ${res.status}`);
      } catch (fnErr) {
        console.warn('[MICHT] Edge Function create-order no disponible, uso insert directo:', fnErr.message);
      }

      // ── Respaldo: insert directo (comportamiento previo a la Edge Function) ──
      const dbData = orderToDB(newOrder);
      let { error } = await db.from('pedidos').insert(dbData);

      // Fallback: si falla por columna inexistente (ej: payment_method no agregada aún),
      // reintentar sin ese campo para no perder el pedido
      if (error && (error.code === '42703' || (error.message || '').includes('payment_method'))) {
        const { payment_method, ...fallback } = dbData;
        const retry = await db.from('pedidos').insert(fallback);
        error = retry.error;
      }

      if (error) {
        console.error('[MICHT] Error Supabase al guardar pedido:', error.code, error.message);
        this._markPending(newOrder.id);
        const _toast = typeof showToast === 'function' ? showToast
          : typeof showCartToast === 'function' ? showCartToast : null;
        if (_toast) _toast('⚠ Pedido guardado localmente. Error al sincronizar: ' + (error.message || error.code));
      }
    }
    return newOrder.id;
  },

  // Marca un pedido local como "pendiente de sincronizar" — evita que se
  // limpie como zombie mientras no se confirme que llegó a Supabase.
  _markPending(id) {
    try {
      const stored = Orders.getAll();
      const idx = stored.findIndex(o => o.id === id);
      if (idx !== -1) { stored[idx]._pendingSync = true; Orders.save(stored); }
    } catch {}
  },

  // Marca un pedido local como sincronizado y adopta el total autoritativo
  // que devolvió el servidor (puede diferir un poco si el precio cambió).
  _markSynced(id, serverTotal) {
    try {
      const stored = Orders.getAll();
      const idx = stored.findIndex(o => o.id === id);
      if (idx !== -1) {
        if (typeof serverTotal === 'number') stored[idx].total = serverTotal;
        delete stored[idx]._pendingSync;
        Orders.save(stored);
      }
    } catch {}
  },

  async updateStatus(id, status, paymentMethod = null) {
    // Descontar stock cuando se confirma el pago
    if (status === 'pagado') {
      const order = await this.getById(id);
      if (order && order.status !== 'pagado') {
        // Obtener TODOS los productos de una vez (un solo query) en lugar de
        // hacer N queries individuales con getById dentro del loop
        const allProducts = await CloudProducts.getAll();
        const prodLookup  = {};
        allProducts.forEach(p => { prodLookup[p.id] = p; });

        for (const item of (order.items || [])) {
          const pid     = parseInt(item.productId);
          const product = prodLookup[pid];
          if (!product) continue;

          if (product.type === 'entero') {
            const qty    = parseInt(item.quantity || 1);
            const newQty = Math.max(0, (product.stockQuantity || 0) - qty);
            await CloudProducts.update(pid, { stockQuantity: newQty, inStock: newQty > 0 });
            continue;
          }

          // Entero vendido a partir de un decant (frasco sellado aparte, no el
          // que se usa para sacar decants) — descuenta solo el stock de
          // enteros, sin tocar el ml del frasco de decant ni el inStock general.
          if ((product.enteroStock || 0) > 0 && item.size === 'Unidad') {
            const qty      = parseInt(item.quantity || 1);
            const newStock = Math.max(0, (product.enteroStock || 0) - qty);
            await CloudProducts.update(pid, {
              enteroStock:       newStock,
              availableAsEntero: newStock > 0
            });
            continue;
          }

          const mlUsed = parseInt(item.size) * (item.quantity || 1);
          if (isNaN(mlUsed) || mlUsed <= 0) continue;
          const newRemain  = Math.max(0, (product.bottleRemainingMl || 0) - mlUsed);
          const mlUpdate   = { bottleRemainingMl: newRemain };
          // Agotado si lo que queda ya no alcanza ni para el tamaño más chico
          if (newRemain < minDecantSizeMl(product.sizes)) mlUpdate.inStock = false;
          await CloudProducts.update(pid, mlUpdate);
        }
      }
    }
    // Actualizar localStorage siempre (fuente de verdad local)
    Orders.updateStatus(id, status, paymentMethod);
    if (db) {
      const patch = { status, updated_at: new Date().toISOString() };
      if (paymentMethod) patch.payment_method = paymentMethod;
      let { error } = await db.from('pedidos').update(patch).eq('id', id);
      // Fallback: si falla por columna payment_method inexistente, reintentar sin ella
      if (error && paymentMethod && (error.code === '42703' || (error.message || '').includes('payment_method'))) {
        const { payment_method, ...fallbackPatch } = patch;
        const retry = await db.from('pedidos').update(fallbackPatch).eq('id', id);
        error = retry.error;
      }
      if (error) console.error('Supabase error al cambiar estado:', error?.code);
    }
  },

  async update(id, data) {
    // Actualizar localStorage
    const local = Orders.getAll();
    const idx   = local.findIndex(o => o.id === id);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...data };
      Orders.save(local);
    }
    // Actualizar Supabase
    if (db) {
      const patch = { updated_at: new Date().toISOString() };
      const map = {
        items: 'items', total: 'total', status: 'status',
        customerName: 'customer_name', customerPhone: 'customer_phone',
        customerDni: 'customer_dni', deliveryType: 'delivery_type',
        notes: 'notes', paymentMethod: 'payment_method'
      };
      Object.entries(data).forEach(([k, v]) => { if (map[k]) patch[map[k]] = v; });
      let { error } = await db.from('pedidos').update(patch).eq('id', id);
      // Fallback: si falla por columna payment_method inexistente, reintentar sin ella
      if (error && 'payment_method' in patch && (error.code === '42703' || (error.message || '').includes('payment_method'))) {
        const { payment_method, ...fallbackPatch } = patch;
        const retry = await db.from('pedidos').update(fallbackPatch).eq('id', id);
        error = retry.error;
      }
      if (error) { console.error('Supabase error al actualizar pedido:', error?.code); return error; }
    }
    return null;
  },

  async delete(id) {
    Orders.delete(id); // Eliminar de localStorage siempre, antes de Supabase
    if (db) {
      const { error } = await db.from('pedidos').delete().eq('id', id);
      if (error) console.error('Supabase error al eliminar pedido:', error?.code);
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

// ─── Tabla 'galeria_fotos' + bucket 'galeria' en Supabase ────────────────────
// Esquema completo y políticas RLS: ver supabase/sql/2026-09-09-galeria-fotos.sql
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
//   accords             JSONB DEFAULT '[]',
//   created_at          TIMESTAMPTZ DEFAULT NOW(),
//   updated_at          TIMESTAMPTZ
// );
//
// -- Si ya tienes la tabla creada, ejecuta esto para agregar la columna:
// ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;
// -- Acordes principales (ver supabase/sql/2026-09-08-accords.sql para el detalle):
// ALTER TABLE productos ADD COLUMN IF NOT EXISTS accords JSONB DEFAULT '[]';
// -- SEGURIDAD: habilitar RLS y crear políticas
// ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
// -- Clientes anónimos pueden LEER productos (ver catálogo)
// CREATE POLICY "anon_read_productos" ON productos FOR SELECT TO anon USING (true);
// -- Solo el admin (rol real) puede crear, editar y eliminar productos.
// -- "TO authenticated USING (true)" sería el mismo bug C-01 que en `pedidos`.
// CREATE POLICY "admin_all_productos" ON productos FOR ALL TO authenticated
//   USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
//   WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
//
// ─────────────────────────────────────────────────────────────────────────────

// Columnas visibles para el rol anon (ver supabase/sql/2026-08-04b-ocultar-cost-price.sql)
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
    accords:             product.accords           || []
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
  costPrice: 'cost_price', accords: 'accords'
};

// ─── API de productos (async, usa Supabase si está configurado) ───────────────

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
        if (!('entero_stock' in row)) {
          const cached = storedProducts.find(sp => sp.id === p.id);
          p.enteroStock = cached?.enteroStock || (p.availableAsEntero ? 1 : 0);
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
      const { error } = await db.from('productos').insert(productToDB(newProduct));
      if (error) console.error('Supabase error:', error?.code, error?.message);
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
      if (error && error.code === '42703') {
        const OPTIONAL_COLS = ['stock_quantity', 'available_as_entero', 'entero_price', 'entero_stock', 'cost_price', 'content_description', 'accords'];
        const fallback = { ...patch };
        OPTIONAL_COLS.forEach(col => { delete fallback[col]; });
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

// ─── Cliente Supabase con sesión persistente para Auth de clientes ────────────
// Distinto de `db` (que fuerza rol anónimo en tienda) — este preserva la sesión
// del cliente para login, registro, y consultas de perfil de usuario.
// storageKey separada para que las sesiones de clientes NO interfieran con el admin.
const authClient = SUPABASE_READY
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storageKey: 'micht-customer-auth' }
    })
  : null;
