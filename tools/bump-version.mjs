// Actualiza el número de versión (?v=...) de todos los scripts y estilos LOCALES
// en las páginas HTML del sitio.
//
//   Uso:  node tools/bump-version.mjs
//
// Para qué: GitHub Pages y Cloudflare guardan los archivos en caché. Si un .js
// o .css cambia pero su "?v=" no, muchos visitantes siguen viendo la versión
// vieja (pasó con el CSS del loader). Corre esto ANTES de cada "git push" en
// el que hayas tocado algo de frontend/js/ o frontend/css/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'frontend');   // todo lo público vive aquí
const pad = n => String(n).padStart(2, '0');
const now = new Date();
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

// Páginas HTML: las de frontend/ y las de sus carpetas de primer nivel (admin/, nosotros/, contacto/)
const pages = [];
for (const entry of fs.readdirSync(site, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html')) pages.push(path.join(site, entry.name));
  if (entry.isDirectory() && ['admin', 'nosotros', 'contacto'].includes(entry.name)) {
    const idx = path.join(site, entry.name, 'index.html');
    if (fs.existsSync(idx)) pages.push(idx);
  }
}

// src="js/..." | src="../js/..." | href="css/..." | href="../css/..."  (solo archivos locales .js/.css)
const LOCAL_ASSET = /((?:src|href)=")((?:\.\.\/)*(?:js|css)\/[^"?#]+\.(?:js|css))(?:\?v=[^"]*)?(")/g;

let total = 0;
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  let count = 0;
  const out = html.replace(LOCAL_ASSET, (_, pre, file, post) => { count++; return `${pre}${file}?v=${stamp}${post}`; });
  if (count && out !== html) fs.writeFileSync(page, out, 'utf8');
  if (count) console.log(`  ${path.relative(root, page).padEnd(24)} ${count} archivos`);
  total += count;
}
console.log(`Listo: ${total} referencias ahora usan ?v=${stamp}`);
