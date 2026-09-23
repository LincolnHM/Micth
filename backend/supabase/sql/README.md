# Cambios a la base de datos (Supabase)

> Esta carpeta es **privada**: vive en `backend/` y el deploy no la publica. Cómo se crearon las tablas base: `../schema-reference.sql`.

Cada archivo se pega completo en **Supabase → SQL Editor → Run**. Van en orden de fecha. La mayoría se puede volver a correr sin problema (usan `IF NOT EXISTS`, `OR REPLACE`…), pero lee la cabecera del archivo antes de correr uno viejo.

| Archivo | Qué hace |
|---|---|
| `2026-08-02-security-fixes.sql` | Base de seguridad: solo el admin real puede leer/editar pedidos y productos; tabla y función para limitar pedidos por IP. |
| `2026-08-02b-site-settings.sql` | Tabla `site_settings` (campañas por fechas y anuncio de bienvenida). |
| `2026-08-04-cerrar-insert-directo.sql` | ⚠️ **No correr** hasta que la Edge Function `create-order` esté desplegada y probada: cierra el insert directo en `pedidos` y sin la función nadie podría comprar. |
| `2026-08-04b-ocultar-cost-price.sql` | Oculta tu costo de compra (`cost_price`) del catálogo público. |
| `2026-08-08-reabrir-insert-pedidos.sql` | Reabre el insert en `pedidos` (arregla "new row violates row-level security"). |
| `2026-09-08-accords.sql` | Columna `accords` (barras de acordes en la ficha del perfume). |
| `2026-09-08b-tamano-2ml.sql` | Agrega la talla 2ml a los perfumes. **Reemplazado por** `08c` (más robusto, por ID). |
| `2026-09-08c-tamano-2ml-fix.sql` | Igual que `08b`, pero por ID de perfume. |
| `2026-09-08d-diagnostico-2ml.sql` | Solo consulta (no cambia nada): busca a quién le faltó el 2ml. |
| `2026-09-08e-insertar-3-faltantes.sql` | Inserta 3 perfumes que no llegaron a Supabase. **Reemplazado por** `09b`. |
| `2026-09-09-galeria-fotos.sql` | Tabla `galeria_fotos` y bucket `galeria` (fotos de envíos y clientes). |
| `2026-09-09b-forzar-2ml-tres-perfumes.sql` | Crea/fuerza esos 3 perfumes con su 2ml. |
| `2026-09-09c-stock-entero-para-decants.sql` | Columna `entero_stock` (frascos enteros de un perfume que también se vende en decant). |
| `2026-09-12-dupe-of.sql` | Columna `dupe_of` (tarjeta "Se parece a") y sus datos. |
| `2026-09-22-combos.sql` | Tabla `combos` (2–3 perfumes + precio por talla + foto). **Vuelve a correrlo** si ya lo habías corrido antes: agrega las columnas `prices` e `image_url`. |
| `2026-09-23-solo-admin-gastos-y-perfiles.sql` | Seguridad: `gastos` y `perfiles_usuarios` dejan de ser accesibles para cualquier cliente logueado; solo el admin ve todo. Léelo y córrelo cuando puedas (cierra sesión y vuelve a entrar en el panel después). |

## Cómo saber si uno ya está aplicado

En SQL Editor: `select column_name from information_schema.columns where table_name = 'productos';` muestra las columnas que tiene la tabla. Si al guardar en el panel aparece un error que menciona `PGRST204` o "columna", falta correr el SQL de esa columna.
