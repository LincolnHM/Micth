// ─── Preguntas frecuentes ─────────────────────────────────────────────────────
// Un solo lugar para los textos: se muestran en la sección "¿Cómo comprar?"
// (#faqList) y algunas también como desplegables en la ficha de cada perfume
// (las que tienen `enFicha`, con su título `fichaTitle`).
//
// Duraciones: sprays de cada tamaño (SPRAYS_BY_SIZE en product-detail.js: 2ml 39,
// 3ml 50, 5ml 90, 10ml 180) ÷ unas 6 atomizaciones al día.

const STORE_FAQ = [
  {
    key: 'decant',
    q: '¿Qué es un decant?',
    a: 'Es una porción de un perfume original en un frasco pequeño con atomizador (2, 3, 5 o 10 ml). Te permite probar o usar perfumes de lujo pagando solo por lo que necesitas, sin comprar el frasco completo.'
  },
  {
    key: 'originales',
    q: '¿Los perfumes son originales?',
    a: 'Sí. Cada decant se prepara a partir del frasco original del perfume.'
  },
  {
    key: 'tamano',
    q: '¿Qué tamaño me conviene?',
    enFicha: true,
    a: 'Con unas 6 atomizaciones al día: <strong>2 ml</strong> (39 sprays) ≈ 6 días · <strong>3 ml</strong> (50 sprays) ≈ 8 días · <strong>5 ml</strong> (90 sprays) ≈ 15 días · <strong>10 ml</strong> (180 sprays) ≈ 1 mes. Si recién lo vas a probar, elige 2 o 3 ml; si ya es tu favorito, 5 o 10 ml.'
  },
  {
    key: 'envio',
    q: '¿Cuándo envían mi pedido?',
    fichaTitle: '¿En cuánto tiempo llega mi pedido?',
    enFicha: true,
    a: 'Lo preparamos el <strong>mismo día</strong> que confirmamos tu pago. <strong>En Soritor</strong> lo recoges en Jr. Las Flores N°620 o te lo llevamos con delivery gratis (desde 2 decants o 1 perfume entero); coordinamos la hora por WhatsApp. <strong>Al resto del Perú</strong> lo enviamos por Shalom ese mismo día, según el horario de atención de la agencia; el tiempo de llegada depende de Shalom y de tu ciudad, y el flete lo pagas al recoger.'
  },
  {
    key: 'pago',
    q: '¿Cómo pago?',
    enFicha: true,
    a: 'Solo con <strong>Yape</strong>, al 917 452 643 o escaneando el QR que te mostramos al finalizar tu pedido. Después nos envías la captura del pago por WhatsApp para confirmarlo.'
  },
  {
    key: 'delivery',
    q: '¿Dónde recojo o hacen delivery?',
    a: 'Puedes recoger en Jr. Las Flores N°620, Soritor (San Martín), coordinando la hora por WhatsApp. En Soritor también hacemos delivery gratis desde 2 decants o 1 perfume entero.'
  },
  {
    key: 'parecido',
    q: '¿Qué significa "Se parece a"?',
    a: 'Son perfumes árabes con un aroma parecido a un perfume famoso de diseñador o nicho, a un precio más accesible. Busca el perfume famoso que te gusta y te mostramos cuáles se le parecen.'
  },
  {
    key: 'descuento',
    q: '¿Cómo obtengo el 10% de descuento?',
    a: 'Creando tu cuenta en la tienda: tienes 10% de descuento en tu primera compra (uno por DNI).'
  }
];

function faqItemHtml(item, title) {
  return `
    <details class="faq-item">
      <summary>${title || item.q}</summary>
      <div class="faq-answer"><p>${item.a}</p></div>
    </details>`;
}

// Preguntas que van como desplegables en la ficha de un perfume
function faqForProductHtml() {
  return STORE_FAQ.filter(f => f.enFicha)
    .sort((a, b) => ['envio', 'tamano', 'pago'].indexOf(a.key) - ['envio', 'tamano', 'pago'].indexOf(b.key))
    .map(f => faqItemHtml(f, f.fichaTitle)).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('faqList');
  if (list) list.innerHTML = STORE_FAQ.map(f => faqItemHtml(f)).join('');
});
