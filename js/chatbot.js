// ─── MICHT Decants · Chatbot IA con Google Gemini ────────────────────────────
const GEMINI_API_KEY = window.GROQ_CONFIG?.apiKey || '';
const GEMINI_MODEL   = 'gemini-2.0-flash';

let chatHistory     = [];
let catalogReady    = false;
let productsCatalog = [];

// ─── Construir prompt del sistema con el catálogo real ────────────────────────
function buildSystemPrompt(products) {
  const inStock = products.filter(p => p.inStock !== false);
  const catalogText = inStock.map(p => {
    const sizesRaw = p.sizes || {};
    const prices = Array.isArray(sizesRaw)
      ? sizesRaw.map(s => `${s.ml}ml=S/${s.price}`).join(', ')
      : Object.entries(sizesRaw).map(([ml, price]) => `${ml}=S/${price}`).join(', ') || 'consultar';
    return `• ${p.name} (${p.brand}) | ${p.gender || 'unisex'} | ${p.type || ''} | ${p.occasion || ''} | ${prices}`;
  }).join('\n');

  return `Eres Micht Bot, asistente virtual de MICHT Decants, tienda peruana de decants de perfumes árabes y de diseñador en Soritor, Perú.

Tu misión: ayudar al cliente a encontrar su fragancia ideal y animarlo a pedir por WhatsApp +51 917 452 643.

CATÁLOGO DISPONIBLE (${inStock.length} productos con stock):
${catalogText}

INSTRUCCIONES:
- Responde siempre en español, de forma amigable y breve (máximo 4 oraciones)
- Si el cliente no especifica qué busca, haz 1-2 preguntas: ¿para quién?, ¿qué ocasión?, ¿qué aroma le gusta?
- Recomienda 1 a 3 productos del catálogo con su precio
- No inventes productos que no estén en el catálogo
- Termina invitando a pedir por WhatsApp
- Usa emojis con moderación`;
}

// ─── Llamada a la API de Gemini ───────────────────────────────────────────────
async function askGemini(userMessage) {
  chatHistory.push({ role: 'user', content: userMessage });

  const systemContent = catalogReady
    ? buildSystemPrompt(productsCatalog)
    : 'Eres el asistente de MICHT Decants. El catálogo se está cargando. Saluda al cliente y pídele que espere un momento.';

  const contents = chatHistory.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemContent }] },
      contents,
      generationConfig: {
        maxOutputTokens: 350,
        temperature: 0.75
      }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${res.status}`;
    console.error('[Gemini]', res.status, msg);
    throw new Error(msg);
  }

  const data  = await res.json();
  const reply = data.candidates[0].content.parts[0].text.trim();
  chatHistory.push({ role: 'assistant', content: reply });
  return reply;
}

// ─── Interfaz del chat ────────────────────────────────────────────────────────
const Chatbot = {
  isOpen:  false,
  greeted: false,

  init() {
    const fab      = document.getElementById('chatFab');
    const closeBtn = document.getElementById('chatClose');
    const sendBtn  = document.getElementById('chatSend');
    const input    = document.getElementById('chatInput');

    if (!fab) return;

    fab.addEventListener('click', () => this.toggle());
    closeBtn.addEventListener('click', () => this.close());
    sendBtn.addEventListener('click', () => this.send());
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) this.send(); });

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
    document.getElementById('chatInput').disabled = disabled;
    document.getElementById('chatSend').disabled  = disabled;
  },

  async send() {
    const input = document.getElementById('chatInput');
    const text  = input.value.trim();
    if (!text) return;

    if (!GEMINI_API_KEY) {
      this.addMessage('user', text);
      input.value = '';
      this.addMessage('bot', '⚠️ La IA no está configurada aún. Por ahora puedes escribir directamente al WhatsApp: **+51 917 452 643** 😊');
      return;
    }

    input.value = '';
    this.setInputState(true);
    this.addMessage('user', text);
    this.showTyping();

    try {
      const reply = await askGemini(text);
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
