# MICHT Decants — michtdecants.com

Tienda de decants de perfumes (árabes y de diseñador) en Perú. Es un sitio estático (HTML + CSS + JavaScript, sin compilar nada) publicado en **GitHub Pages**, con **Supabase** como base de datos y los pedidos que llegan por WhatsApp.

## Dos carpetas, dos mundos

| Carpeta | Qué es | ¿Sale al sitio público? |
|---|---|---|
| **`frontend/`** | Todo lo que ve el visitante: páginas, estilos, scripts, imágenes | **Sí** — es lo único que se publica |
| **`backend/`** | Lo que vive en el servidor: SQL de la base de datos y Edge Functions de Supabase | **No, nunca** |

Regla de oro: **si algo no debe verlo el público (SQL, políticas, funciones de servidor, notas internas), va en `backend/`.** El deploy solo sube `frontend/`, así que lo de `backend/`, `tools/`, este README y `.github/` no se puede descargar desde el dominio.

> Ojo: dentro de `frontend/` sí queda la clave pública (`anon`) de Supabase en `js/shared/supabase-config.js`. Es normal y por diseño (cualquier web con Supabase la muestra); los datos los protegen las políticas RLS del `backend/`. **Nunca** pongas en `frontend/` una clave `service_role` ni contraseñas.

## Cómo se publica

`git push` a la rama `master` → GitHub Actions (`.github/workflows/deploy.yml`) publica la carpeta `frontend/` en unos minutos. Dominio: `frontend/CNAME`.

**Antes de subir cambios de `frontend/js/` o `frontend/css/`:** corre `node tools/bump-version.mjs`. Cambia el número `?v=` de los archivos en los HTML; sin eso, Cloudflare/GitHub pueden seguir mostrando la versión vieja en caché.

## Estructura

```
frontend/                       ← lo público (la raíz del sitio)
  index.html                    Tienda (catálogo, combos, carrito, checkout)
  nosotros/  contacto/          Páginas informativas
  admin/index.html              Panel de administración (login con Supabase)
  404.html  admin.html          Página de error · redirección /admin.html → /admin/
  css/style.css                 Todos los estilos (tienda + admin)
  js/
    shared/   Lo que usan la tienda Y el admin
              data-core.js · catalog.js (catálogo inicial de perfumes) · data.js (APIs locales)
              supabase-config.js (conexión) · cloud-orders / cloud-products / cloud-combos / cloud-gallery
    store/    Solo la tienda: cart, catalog-view, combos-carousel, product-detail, init, checkout,
              customer-auth, scent-finder, carousel, gallery, announcement, seasonal-theme, animaciones…
    admin/    Solo el panel: un archivo por sección (products, orders, combos, pricing, cash, stats…)
  imgGato/                      Mascota, logo e íconos de la app
  img PERFUMES/                 Fotos de los decants
  imgPerfumesEnteros/           Fotos de perfumes enteros
  images/                       QR de Yape
  manifest.json · sw.js         App instalable (PWA)
  robots.txt · sitemap*.xml     SEO

backend/                        ← privado (no se publica)
  supabase/
    schema-reference.sql        Cómo se crearon las tablas base (solo referencia)
    sql/                        Cambios a la base de datos, en orden de fecha (ver sql/README.md)
    functions/create-order/     Edge Function: validación de pedidos en el servidor

tools/bump-version.mjs          Actualiza el ?v= de scripts y estilos (ver arriba)
.github/workflows/deploy.yml    Publica frontend/ en GitHub Pages
```

## Probar el sitio en tu PC

```
cd frontend
python -m http.server 8000
```

y abre `http://localhost:8000`. (Hay que servir la carpeta `frontend/`, no la raíz del repositorio: las rutas del sitio empiezan en `/`.)

## Reglas para no romper nada

- **No hay bundler.** Cada archivo de `frontend/js/` es un script normal cargado con `<script>` en los HTML, y el **orden importa**: primero `js/shared/`, luego `js/store/` (en `index.html`) o `js/admin/` (en `admin/index.html`). Si agregas un archivo nuevo, agrégalo también en el HTML, en el lugar correcto.
- **Las carpetas de imágenes conservan su nombre a propósito** (`img PERFUMES`, `imgGato`…): sus rutas están guardadas en Supabase, en `sitemap-images.xml` y en enlaces ya indexados por Google. Renombrarlas rompería fotos.
- **Cambiar `frontend/js/shared/catalog.js` no actualiza los perfumes que ya están en Supabase.** Ese archivo solo siembra la base la primera vez. Para cambiar precios o datos de perfumes existentes usa el panel admin o un SQL en `backend/supabase/sql/`.
- **Una columna nueva en Supabase** necesita su SQL (y, si la tabla `productos` la lee el público, un `GRANT SELECT`). Ejemplo: `backend/supabase/sql/2026-09-22-combos.sql`.

## Base de datos y funciones

- SQL: cada archivo de `backend/supabase/sql/` se pega en **Supabase → SQL Editor → Run**. La lista, en orden y con qué hace cada uno, está en `backend/supabase/sql/README.md`.
- Edge Function: `cd backend` y luego `supabase functions deploy create-order` (requiere la CLI de Supabase). Hasta que esté desplegada, la tienda guarda los pedidos con inserción directa como respaldo. **No corras `2026-08-04-cerrar-insert-directo.sql` antes de desplegarla y probarla.**
