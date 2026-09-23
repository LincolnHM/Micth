// ─── Exportar catálogo PDF ────────────────────────────────────────────────────

async function exportCatalogPDF() {
  const btn   = document.getElementById('exportPdfBtn');
  const label = document.getElementById('exportPdfLabel');
  if (btn)   { btn.disabled = true; btn.style.opacity = '.55'; }
  if (label) { label.textContent = 'Generando…'; }

  // Abrir ventana ANTES del await — iOS Safari bloquea window.open si no es
  // respuesta directa y síncrona al click del usuario (popup blocker)
  const win = window.open('', '_blank', 'width=920,height=760');
  if (!win) { showToast('Activa las ventanas emergentes para exportar el PDF.'); if (btn) { btn.disabled = false; btn.style.opacity = ''; } if (label) { label.textContent = 'Exportar PDF'; } return; }
  win.document.open();
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Generando catálogo…</title><style>body{background:#0a0a0a;color:#7c4fb0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:1.1rem;letter-spacing:.1em}</style></head><body>Generando catálogo…</body></html>');

  try {
    const all  = await withTimeout(CloudProducts.getAll(), 15000, 'el catálogo');

    // Re-aplicar imágenes: PRODUCT_IMAGE_MAP > DEFAULT_PRODUCTS > lo que venga de Supabase
    const imgMap = typeof PRODUCT_IMAGE_MAP !== 'undefined' ? PRODUCT_IMAGE_MAP : {};
    const defById = {};
    if (typeof DEFAULT_PRODUCTS !== 'undefined') {
      DEFAULT_PRODUCTS.forEach(p => { if (p.imageUrl) defById[p.id] = p.imageUrl; });
    }
    all.forEach(p => {
      if (imgMap[p.name])               p.imageUrl = imgMap[p.name];   // mapa por nombre (máx. prioridad)
      else if (!p.imageUrl && defById[p.id]) p.imageUrl = defById[p.id]; // fallback DEFAULT_PRODUCTS por id
    });

    const base = window.location.origin;
    const date = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' });

    // ── Helpers ──────────────────────────────────────────────────────────────
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // Resuelve URL de imagen: admite data URIs (incluyendo SVG), http y rutas relativas con espacios
    const resolveImg = url => {
      if (!url || url.trim() === '') return '';
      if (url.startsWith('data:')) return url;           // SVG generado o base64 — usar directo
      if (url.startsWith('http'))  return encodeURI(url); // URL externa
      const path = url.startsWith('/') ? url : '/' + url;
      return encodeURI(base + path);                     // ruta relativa → absoluta (encodes espacios)
    };

    const gLabel = g => ({ hombre:'Hombre', mujer:'Mujer', unisex:'Unisex' }[g] || 'Unisex');
    const gColor = g => ({ hombre:'#2563eb', mujer:'#db2777', unisex:'#7c3aed' }[g] || '#7c3aed');
    const gIcon  = g => ({ hombre:'♂', mujer:'♀', unisex:'⚥' }[g] || '⚥');
    const oLabel = o => ({ dia:'Solo Día', noche:'Solo Noche', ambas:'Día & Noche' }[o] || 'Día & Noche');
    const oIcon  = o => ({ dia:'☀', noche:'☾', ambas:'☀☾' }[o] || '☀☾');

    // ── Merge: unir decant + entero del mismo perfume ─────────────────────────
    const enteroProds = all.filter(p => p.type === 'entero');
    const decantProds = all.filter(p => p.type !== 'entero');

    const normKey = p => (p.brand + '@@' + p.name).toLowerCase().trim();
    const enteroByKey = {};
    enteroProds.forEach(e => { enteroByKey[normKey(e)] = e; });

    const usedEnteroKeys = new Set();
    const mergedCards    = [];

    decantProds.forEach(d => {
      const key           = normKey(d);
      const matchedEntero = enteroByKey[key];
      let   enteroInfo    = null;

      if (matchedEntero && !usedEnteroKeys.has(key)) {
        usedEnteroKeys.add(key);
        enteroInfo = { sizes: matchedEntero.sizes, inStock: matchedEntero.inStock };
      } else if ((d.enteroStock || 0) > 0 && d.enteroPrice > 0) {
        enteroInfo = { sizes: { 'Unidad': d.enteroPrice }, inStock: d.enteroStock > 0 };
      }

      mergedCards.push({ ...d, _decantSizes: d.sizes, _enteroInfo: enteroInfo });
    });

    // Enteros sin decant coincidente → sección propia
    const standaloneEnteros = enteroProds.filter(e => !usedEnteroKeys.has(normKey(e)));

    // ── Separar secciones ─────────────────────────────────────────────────────
    const diseCards   = mergedCards.filter(p => p.type === 'diseñador');
    const arabeCards  = mergedCards.filter(p => p.type === 'arabe');
    // Productos con tipo inesperado → mostrarlos igualmente en "Otros"
    const otrosCards  = mergedCards.filter(p => p.type !== 'diseñador' && p.type !== 'arabe');
    const enteroCards = standaloneEnteros;

    // ── Render de tarjeta ─────────────────────────────────────────────────────
    const renderCard = c => {
      const isEnteroOnly = !c._decantSizes;
      const g   = (c.gender   || 'unisex').toLowerCase();
      const o   = (c.occasion || 'ambas').toLowerCase();
      const gc  = gColor(g);
      const img = resolveImg(c.imageUrl);
      // Todos se muestran — sin stock solo lleva un badge informativo, sin difuminar
      const sinStock = !c.inStock && !(c._enteroInfo?.inStock);

      const imgHtml = img
        ? `<img class="c-img" src="${esc(img)}" alt="${esc(c.name)}" loading="lazy"
               onerror="this.style.display='none';this.nextSibling.style.display='flex'"
             ><div class="c-img-ph" style="display:none">${esc((c.brand||'?').charAt(0))}</div>`
        : `<div class="c-img-ph">${esc((c.brand||'?').charAt(0))}</div>`;

      // Precios decant
      let decantHtml = '';
      if (!isEnteroOnly && c._decantSizes) {
        const rows = Object.entries(c._decantSizes).map(([ml, pr]) =>
          `<tr><td class="td-s">${esc(ml)}</td><td class="td-p">${pr > 0 ? 'S/ ' + parseFloat(pr).toFixed(2) : '—'}</td></tr>`
        ).join('');
        decantHtml = `<div class="pr-col"><div class="pr-lbl">Decant</div><table class="pt"><tbody>${rows}</tbody></table></div>`;
      }

      // Precios entero (o espacio para llenar)
      let enteroHtml = '';
      if (!isEnteroOnly) {
        if (c._enteroInfo) {
          const rows = Object.entries(c._enteroInfo.sizes).map(([sz, pr]) =>
            `<tr><td class="td-s">${esc(sz)}</td><td class="td-p">${pr > 0 ? 'S/ ' + parseFloat(pr).toFixed(2) : '—'}</td></tr>`
          ).join('');
          enteroHtml = `<div class="pr-col"><div class="pr-lbl">Entero</div><table class="pt"><tbody>${rows}</tbody></table></div>`;
        } else {
          enteroHtml = `<div class="pr-col"><div class="pr-lbl">Entero</div><div class="blank-price">S/&nbsp;<span class="blank-line">___________</span></div></div>`;
        }
      } else {
        const rows = Object.entries(c.sizes || {}).map(([sz, pr]) =>
          `<tr><td class="td-s">${esc(sz)}</td><td class="td-p">${pr > 0 ? 'S/ ' + parseFloat(pr).toFixed(2) : '—'}</td></tr>`
        ).join('');
        enteroHtml = `<div class="pr-col" style="grid-column:1/-1"><div class="pr-lbl">Precio</div><table class="pt"><tbody>${rows}</tbody></table></div>`;
      }

      return `
      <div class="card">
        <div class="c-head">
          <div class="c-img-wrap">${imgHtml}</div>
          <div class="c-info">
            <div class="c-brand">${esc(c.brand)}</div>
            <div class="c-name">${esc(c.name)}</div>
            <div class="c-badges">
              <span class="badge" style="background:${gc}14;color:${gc};border:1px solid ${gc}33">${gIcon(g)} ${gLabel(g)}</span>
              <span class="badge b-occ">${oIcon(o)} ${oLabel(o)}</span>
              ${c.olfFamily ? `<span class="badge b-olf">${esc(c.olfFamily)}</span>` : ''}
              ${sinStock ? '<span class="badge" style="background:#fff0f0;color:#c0392b;border:1px solid #f5a5a5">Sin stock</span>' : ''}
            </div>
          </div>
        </div>
        <div class="c-prices">${decantHtml}${enteroHtml}</div>
      </div>`;
    };

    // ── Render de sección: chunks de 6, orden Hombre → Mujer → Unisex → Marca → Nombre ──
    let _firstSection = true;

    // mergeUnisex=true → unisex se muestra con hombre (Diseñador sin grupo Unisex separado)
    const renderSection = (title, icon, cards, mergeUnisex = false) => {
      if (!cards.length) return '';

      const isFirst   = _firstSection;
      _firstSection   = false;

      // Unisex en Diseñador va con Hombre (posición 0); en Árabes tiene su propio grupo (posición 2)
      const gOrd = mergeUnisex
        ? { hombre: 0, unisex: 0, mujer: 1 }
        : { hombre: 0, mujer: 1, unisex: 2 };

      // Ordenar: género → marca → nombre (sin headers dentro del grid)
      const sorted = [...cards].sort((a, b) => {
        const ga = gOrd[(a.gender||'unisex').toLowerCase()] ?? (mergeUnisex ? 0 : 2);
        const gb = gOrd[(b.gender||'unisex').toLowerCase()] ?? (mergeUnisex ? 0 : 2);
        if (ga !== gb) return ga - gb;
        const bc = a.brand.localeCompare(b.brand, 'es');
        return bc !== 0 ? bc : a.name.localeCompare(b.name, 'es');
      });

      // Partir en grupos de 6
      const chunks = [];
      for (let i = 0; i < sorted.length; i += 6) chunks.push(sorted.slice(i, i + 6));

      let html = `<div class="section${isFirst ? '' : ' new-page'}">`;
      html += `<div class="sec-title"><span>${icon}</span> ${title}<span class="sec-count">${cards.length} fragancia${cards.length !== 1 ? 's' : ''}</span></div>`;

      chunks.forEach((chunk, ci) => {
        const breakAfter = ci < chunks.length - 1;
        html += `<div class="chunk-grid${breakAfter ? ' break-after' : ''}">`;
        html += chunk.map(renderCard).join('');
        html += '</div>';
      });

      html += '</div>';
      return html;
    };

    const totalAll  = all.length;
    const totalDisp = all.filter(p => p.inStock).length;

    // ── HTML completo ─────────────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>MICHT Decants — Catálogo ${date}</title>
<base href="${base}/">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Georgia','Times New Roman',serif;color:#1a1005;background:#fff;font-size:11pt;line-height:1.4}

/* Barra acción */
.pbar{position:sticky;top:0;z-index:200;background:#1a1005;padding:9px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.pbar-btn{background:#7c4fb0;color:#111;border:none;border-radius:6px;padding:7px 20px;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:.4px}
.pbar-btn:hover{background:#a87fd0}
.pbar-hint{color:#aaa;font-size:10px;font-family:sans-serif}

/* Layout */
.wrap{max-width:780px;margin:0 auto;padding:12px 16px 20px}

/* Cabecera */
.dh{text-align:center;padding-bottom:10px;margin-bottom:12px;border-bottom:2px solid #7c4fb0}
.logo{font-size:20pt;font-weight:900;letter-spacing:2px}
.logo span{color:#7c4fb0}
.sub{font-size:7pt;letter-spacing:3px;text-transform:uppercase;color:#888;margin-top:2px}
.meta{display:flex;justify-content:center;gap:16px;margin-top:6px;font-size:7pt;color:#666;font-family:sans-serif}
.meta b{color:#7c4fb0}

/* Sección */
.section{margin-bottom:10px}
.sec-title{display:flex;align-items:center;gap:8px;font-size:9.5pt;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1a1005;border-bottom:1.5px solid #7c4fb0;padding-bottom:4px;margin-bottom:8px}
.sec-count{margin-left:auto;font-size:7pt;font-weight:400;color:#aaa;text-transform:none;letter-spacing:0;font-family:sans-serif}

/* Grid de 6 por página: 2 columnas × 3 filas de altura fija */
.chunk-grid{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:78mm;gap:4mm;page-break-inside:avoid;break-inside:avoid}
.break-after{page-break-after:always;break-after:page}
.new-page{page-break-before:always;break-before:page}

/* Tarjeta — altura fija por grid-auto-rows, overflow recortado */
.card{border:1px solid #dcd4b8;border-radius:10px;padding:12px 14px;background:#fffef9;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;height:100%;box-shadow:inset 0 0 10px rgba(124,79,176,0.03)}

.c-head{display:flex;gap:12px;margin-bottom:8px;align-items:center}
.c-img-wrap{flex-shrink:0;width:86px;height:86px;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:8px;border:1px solid #eae5d8;padding:4px}
.c-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:4px}
.c-img-ph{width:86px;height:86px;background:#efe6f7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22pt;color:#7c4fb0;font-weight:900;font-family:serif}
.c-info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px}
.c-brand{font-size:8pt;letter-spacing:1px;text-transform:uppercase;color:#8f5fc0;font-weight:700;font-family:sans-serif}
.c-name{font-size:12.5pt;font-weight:800;color:#1a1005;line-height:1.2;font-family:'Georgia',serif;margin:1px 0 3px}
.c-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}
.badge{font-size:7.2pt;padding:2px 6px;border-radius:20px;font-family:sans-serif;font-weight:600;white-space:nowrap}
.b-occ{background:#f5f0e4;color:#7a5f20;border:1px solid #d6c88a}
.b-olf{background:#f4f4f4;color:#666;border:1px solid #e0e0e0;font-style:italic;font-weight:400}

/* Precios */
.c-prices{display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1px solid #ebdcb2;padding-top:6px;margin-top:3px}
.pr-col{}
.pr-lbl{font-size:7pt;text-transform:uppercase;letter-spacing:1px;color:#aaa;font-family:sans-serif;font-weight:700;margin-bottom:3px}
.pt{width:100%;border-collapse:collapse;font-family:sans-serif}
.pt tr{border-top:1px solid #f5f0ea}
.pt tr:first-child{border-top:none}
.td-s{color:#555;font-size:8.5pt;padding:2.5px 0;font-weight:600}
.td-p{text-align:right;font-weight:700;font-size:9.5pt;color:#1a1005;padding:2.5px 0}
.blank-price{font-size:9pt;color:#888;font-family:sans-serif;margin-top:2px}
.blank-line{color:#ccc;letter-spacing:1px}

/* Pie */
.df{margin-top:15px;padding-top:6px;border-top:1px solid #ddc9ef;text-align:center;font-size:7pt;color:#aaa;font-family:sans-serif}
.df b{color:#7c4fb0}

@media print{
  .pbar{display:none!important}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{margin:0.4cm 0.6cm;size:A4 portrait}
  .wrap{max-width:100%!important;width:100%!important;margin:0!important;padding:2px 4px 6px!important}
  .dh{display:flex!important;justify-content:space-between!important;align-items:center!important;padding-bottom:4px!important;margin-bottom:8px!important;border-bottom:1.5px solid #7c4fb0!important;text-align:left!important}
  .logo{font-size:16pt!important;font-weight:900!important}
  .sub{display:none!important}
  .meta{margin-top:0!important;font-size:7.2pt!important;gap:12px!important;display:flex!important;flex-direction:row!important}
  .sec-title{font-size:9pt;padding-bottom:2px;margin-bottom:4px}
  .section{margin-bottom:4px}
}
</style>
</head>
<body>

<div class="pbar">
  <button class="pbar-btn" onclick="window.print()">🖨&nbsp; Imprimir / Guardar PDF</button>
  <span class="pbar-hint">Elige <b style="color:#7c4fb0">"Guardar como PDF"</b> como destino · Incluye <b style="color:#7c4fb0">todos</b> los perfumes</span>
</div>

<div class="wrap">
  <div class="dh">
    <div class="logo">MICHT<span>Decants</span></div>
    <div class="sub">Catálogo de Fragancias &amp; Precios</div>
    <div class="meta">
      <span>Actualizado: <b>${date}</b></span>
      <span>Disponibles: <b>${totalDisp}</b> de <b>${totalAll}</b> fragancias</span>
      <span>WhatsApp: <b>917 452 643</b></span>
    </div>
  </div>

  ${renderSection('Diseñador', '💧', diseCards, true)}
  ${renderSection('Árabes', '🌙', arabeCards)}
  ${otrosCards.length ? renderSection('Otros', '✦', otrosCards) : ''}
  ${renderSection('Perfumes Enteros', '🛍', enteroCards)}

  <div class="df">
    <b>MICHT Decants</b> &nbsp;·&nbsp; WhatsApp 917 452 643 &nbsp;·&nbsp; Catálogo generado el ${date}<br>
    <span style="font-size:6.5pt;margin-top:2px;display:inline-block">Precios en soles peruanos (S/). Disponibilidad sujeta a stock.</span>
  </div>
</div>

</body>
</html>`;

    win.document.write(html);
    win.document.close();

  } catch (err) {
    console.error('[MICHT] Error generando PDF:', err);
    if (win && !win.closed) win.close();
    showToast('Error al generar el catálogo. Intenta de nuevo.');
  } finally {
    if (btn)   { btn.disabled = false; btn.style.opacity = ''; }
    if (label) { label.textContent = 'Exportar PDF'; }
  }
}
