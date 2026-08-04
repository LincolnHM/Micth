// ─── MICHT Decants — Edge Function: crear pedido validado ────────────────────
//
// Por qué existe: antes, el navegador insertaba el pedido directo en Supabase
// con el total que el propio navegador calculaba — cualquiera podía saltarse
// checkout.js con un POST manual y mandar un total inventado, o inundar la
// tabla `pedidos` de pedidos falsos sin límite. Esta función es el único
// camino "de confianza": recalcula cada precio contra el catálogo real y
// aplica un límite de frecuencia por IP antes de guardar nada.
//
// El insert directo se mantiene en el cliente SOLO como respaldo si esta
// función no está desplegada o no responde (ver js/supabase-config.js) —
// para que nunca se pierda un pedido por una caída de la función. Una vez
// desplegada esta función y confirmado que funciona, hay que cerrar ese
// respaldo a nivel de base de datos (ver supabase/sql/2026-08-04-cerrar-insert-directo.sql)
// para que YA NO se pueda insertar un pedido saltándose esta validación
// (como hizo la prueba con curl directo a /rest/v1/pedidos).
//
// Desplegar (Supabase CLI):
//   supabase functions deploy create-order
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los inyecta Supabase
// automáticamente en cada función, no hace falta configurar variables de entorno.
//
// Requiere el SQL de supabase/sql/2026-08-02-security-fixes.sql ya ejecutado
// (crea la función check_order_rate_limit que se usa abajo).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.111.0';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
// Service role: necesaria para poder insertar en `pedidos` una vez que el
// insert directo con la key pública se cierra (ver SQL 2026-08-04). Supabase
// la inyecta sola en cada Edge Function, no hace falta configurarla a mano.
// Es segura de usar aquí PORQUE el pedido ya pasó por toda la validación de
// arriba (precios recalculados, límite de frecuencia) — nunca se expone al navegador.
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = new Set([
  'https://michtdecants.com',
  'https://www.michtdecants.com',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://michtdecants.com';
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}

const RULES = {
  name:  (v: string) => /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]{2,}$/.test(v.trim()),
  dni:   (v: string) => /^\d{8}$/.test(v.trim()),
  phone: (v: string) => /^9\d{8}$/.test(v.trim()) && !/^(\d)\1{8}$/.test(v.trim()),
};

function generateOrderId(): string {
  const now  = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `ORD-${date}-${time}${rand}`;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST')    return json({ error: 'Método no permitido' }, 405, headers);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400, headers);
  }

  // ── 1. Límite de frecuencia por IP ───────────────────────────────────────
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const { data: allowed, error: rlError } = await supabase.rpc('check_order_rate_limit', {
    p_ip: ip, p_max: 8, p_window_seconds: 60,
  });
  if (!rlError && allowed === false) {
    return json({ error: 'Demasiados pedidos seguidos. Espera un minuto e intenta de nuevo.' }, 429, headers);
  }

  // ── 2. Validar forma básica (espejo de las reglas de checkout.js, pero en el servidor) ──
  const deliveryType = body.deliveryType === 'envio' ? 'envio' : 'recojo';
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length)     return json({ error: 'El pedido no tiene productos.' }, 400, headers);
  if (items.length > 30) return json({ error: 'Demasiados productos en un solo pedido.' }, 400, headers);

  const customerName = String(body.customerName || '').trim();
  if (!RULES.name(customerName)) {
    return json({ error: 'Nombre inválido.' }, 400, headers);
  }

  if (deliveryType === 'envio') {
    const dni   = String(body.customerDni   || '').trim();
    const phone = String(body.customerPhone || '').trim();
    if (!RULES.dni(dni))     return json({ error: 'DNI inválido.' }, 400, headers);
    if (!RULES.phone(phone)) return json({ error: 'Celular inválido.' }, 400, headers);
    if (!String(body.department || '').trim() || !String(body.province || '').trim()) {
      return json({ error: 'Falta el departamento o la provincia.' }, 400, headers);
    }
    if (String(body.shalomOffice || '').trim().length < 5) {
      return json({ error: 'Indica la agencia Shalom con dirección.' }, 400, headers);
    }
  }

  // ── 3. Recalcular precios reales desde el catálogo — el total del navegador nunca se usa tal cual ──
  const productIds = [...new Set(
    items.map((i: any) => parseInt(i.productId)).filter((n: number) => !isNaN(n))
  )];
  if (!productIds.length) return json({ error: 'Productos inválidos.' }, 400, headers);

  const { data: products, error: prodError } = await supabase
    .from('productos')
    .select('id, name, brand, type, sizes, entero_price')
    .in('id', productIds);

  if (prodError || !products) {
    return json({ error: 'No se pudo verificar el catálogo. Intenta de nuevo.' }, 502, headers);
  }
  const productMap = new Map(products.map((p: any) => [p.id, p]));

  let subtotal = 0;
  const itemsSnapshot: any[] = [];
  for (const raw of items) {
    const productId = parseInt(raw.productId);
    const product = productMap.get(productId);
    if (!product) return json({ error: `Uno de los productos ya no existe (id ${raw.productId}).` }, 400, headers);

    const quantity  = Math.min(Math.max(parseInt(raw.quantity) || 1, 1), 20);
    const size      = String(raw.size || '').trim();
    const isEntero  = product.type === 'entero' || size === 'Unidad';

    const unitPrice = isEntero
      ? parseFloat(product.entero_price) || 0
      : parseFloat((product.sizes || {})[size]) || 0;

    if (unitPrice <= 0) {
      return json({ error: `"${product.name}" (${size || 'Unidad'}) no está disponible con ese precio.` }, 400, headers);
    }

    subtotal += unitPrice * quantity;
    itemsSnapshot.push({
      productId, productName: product.name, brand: product.brand,
      size: size || 'Unidad', price: unitPrice, quantity,
    });
  }

  // Nota (limitación conocida — ver informe de seguridad M-01/C-01): el 10%
  // de primera compra se aplica sobre el subtotal ya verificado, pero esta
  // función todavía no revalida contra `perfiles_usuarios` si el DNI ya usó
  // el descuento antes — esa tabla solo es legible por su propio dueño.
  // Impacto si se abusa: como máximo 10% de descuento indebido, no acceso a
  // datos ni control de precio arbitrario — mucho menor que lo ya cerrado aquí.
  const hasDiscount = body.hasDiscount === true;
  const total = Math.round((hasDiscount ? subtotal * 0.9 : subtotal) * 100) / 100;

  // ── 4. Guardar el pedido ─────────────────────────────────────────────────
  const id = typeof body.id === 'string' && /^ORD-[\w-]{6,40}$/.test(body.id)
    ? body.id
    : generateOrderId();

  const { error: insertError } = await supabase.from('pedidos').insert({
    id,
    customer_name:  customerName,
    customer_phone: String(body.customerPhone || '').trim(),
    customer_dni:   String(body.customerDni   || '').trim(),
    delivery_type:  deliveryType,
    department:     String(body.department    || '').trim(),
    province:       String(body.province      || '').trim(),
    shalom_office:  String(body.shalomOffice  || '').trim(),
    notes:          String(body.notes || '').slice(0, 300),
    items:          itemsSnapshot,
    total,
    status:         'pendiente',
    payment_method: body.paymentMethod === 'yape' ? 'yape' : null,
  });

  if (insertError) {
    console.error('create-order insert error', insertError);
    return json({ error: 'No se pudo registrar el pedido. Intenta de nuevo.' }, 502, headers);
  }

  return json({ id, total, status: 'pendiente' }, 201, headers);
});
