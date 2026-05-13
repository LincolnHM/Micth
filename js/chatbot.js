// ─── MICHT Decants · Chatbot IA con Groq ──────────────────────────────────────
//
// PASO 1: Ve a https://console.groq.com y crea una cuenta gratis
// PASO 2: Genera una API Key gratuita
// PASO 3: Reemplaza el texto de abajo con tu clave
//
const GROQ_API_KEY = window.GROQ_CONFIG?.apiKey || '';
const GROQ_MODEL   = 'llama-3.1-8b-instant';
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';

let chatHistory    = [];
let catalogReady   = false;
let productsCatalog = [];

// ─── Construir prompt del sistema con el catálogo real ────────────────────────
function buildSystemPrompt(products) {
  const inStock = products.filter(p => p.inStock !== false);
  const catalogText = inStock.map(p => {
    const sizesRaw = p.sizes || {};
    const minPrice = Array.isArray(sizesRaw)
      ? Math.min(...sizesRaw.map(s => s.price))
      : Math.min(...Object.values(sizesRaw));
    return `${p.name}|${p.gender || 'unisex'}|${p.type || ''}|${p.occasion || ''}|desde S/${minPrice}`;
  }).join('\n');

  return `Eres Micht Bot, asistente de MICHT Decants (Soritor, Perú). Ayuda a elegir decants y dirige al WhatsApp +51917452643.
CATÁLOGO (${inStock.length} productos):
${catalogText}
REGLAS: Responde en español, breve (máx 3 oraciones). Pregunta género/ocasión/aroma si no lo dicen. Recomienda 1-3 productos con precio. No inventes productos. Invita a pedir por WhatsApp.`;
}

// ─── Llamada a la API de Groq ─────────────────────────────────────────────────
async function askGroq(userMessage) {
  chatHistory.push({ role: 'user', content: userMessage });

  const systemContent = catalogReady
    ? buildSystemPrompt(productsCatalog)
    : 'Eres el asistente de MICHT Decants. El catálogo se está cargando. Saluda al cliente y pídele que espere un momento.';

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemContent },
        ...chatHistory
      ],
      max_tokens: 280,
      temperature: 0.75
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${res.status}`;
    console.error('[Groq]', res.status, msg);
    throw new Error(msg);
  }

  const data  = await res.json();
  const reply = data.choices[0].message.content.trim();
  chatHistory.push({ role: 'assistant', content: reply });
  return reply;
}

// ─── Interfaz del chat ────────────────────────────────────────────────────────
const Chatbot = {
  isOpen:  false,
  greeted: false,

  init() {
    const fab     = document.getElementById('chatFab');
    const closeBtn = document.getElementById('chatClose');
    const sendBtn  = document.getElementById('chatSend');
    const input    = document.getElementById('chatInput');

    if (!fab) return;

    // Verificar que la API key fue configurada
    if (GROQ_API_KEY === 'TU_API_KEY_DE_GROQ_AQUI') {
      console.warn('[MICHT Chatbot] Agrega tu API key de Groq en js/chatbot.js para activar la IA.');
    }

    fab.addEventListener('click', () => this.toggle());
    closeBtn.addEventListener('click', () => this.close());
    sendBtn.addEventListener('click', () => this.send());
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) this.send(); });

    // Recibir el catálogo cuando esté listo
    document.addEventListener('catalogLoaded', e => {
      productsCatalog = e.detail || [];
      catalogReady    = true;
    });
  },

  toggle() { this.isOpen ? this.close() : this.open(); },

  open() {
    this.isOpen = true;
    document.getElementById('chatWindow').classList.add('open');
    document.getElementById('chatFab').classList.add('hidden');
    if (!this.greeted) {
      this.greeted = true;
      setTimeout(() => {
        this.addMessage('bot', '¡Hola! 👋 Soy el asistente de **MICHT Decants**. Estoy aquí para ayudarte a encontrar tu fragancia perfecta entre nuestros decants árabes y de diseñador. ¿Para quién estás buscando el perfume?');
      }, 300);
    }
    setTimeout(() => document.getElementById('chatInput').focus(), 350);
  },

  close() {
    this.isOpen = false;
    document.getElementById('chatWindow').classList.remove('open');
    document.getElementById('chatFab').classList.remove('hidden');
  },

  addMessage(role, text) {
    const messages = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;
    // Soporte básico de **negrita**
    const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    div.innerHTML = `<div class="chat-bubble">${html}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  },

  showTyping() {
    const messages = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg-bot';
    div.id = 'chatTyping';
    div.innerHTML = `<div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  },

  hideTyping() {
    document.getElementById('chatTyping')?.remove();
  },

  setInputState(disabled) {
    document.getElementById('chatInput').disabled  = disabled;
    document.getElementById('chatSend').disabled   = disabled;
  },

  async send() {
    const input = document.getElementById('chatInput');
    const text  = input.value.trim();
    if (!text) return;

    if (GROQ_API_KEY === 'TU_API_KEY_DE_GROQ_AQUI') {
      this.addMessage('user', text);
      input.value = '';
      this.addMessage('bot', '⚠️ La IA no está configurada aún. El dueño de la tienda debe agregar su API key de Groq. Por ahora puedes escribir directamente al WhatsApp: **+51 917 452 643** 😊');
      return;
    }

    input.value = '';
    this.setInputState(true);
    this.addMessage('user', text);
    this.showTyping();

    try {
      const reply = await askGroq(text);
      this.hideTyping();
      this.addMessage('bot', reply);
    } catch (err) {
      this.hideTyping();
      console.error('[MICHT Chatbot] Error:', err.message);
      const detail = err.message ? ` (${err.message})` : '';
      this.addMessage('bot', `Ups, no pude conectarme a la IA${detail} 😅. Por favor escríbenos por WhatsApp: **+51 917 452 643**`);
    }

    this.setInputState(false);
    document.getElementById('chatInput').focus();
  }
};

document.addEventListener('DOMContentLoaded', () => Chatbot.init());
