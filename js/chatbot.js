// ─── MICHT Decants · Chatbot IA ───────────────────────────────────────────────
// DESACTIVADO: el sitio se despliega en GitHub Pages (hosting estático puro),
// que no puede ejecutar el backend /api/chat que este código espera. El botón
// del chat está oculto en index.html (#chatFab, display:none) hasta que exista
// un backend real (ej. Supabase Edge Function) que reciba el mensaje y llame
// a Groq con la API key guardada del lado del servidor.

let chatHistory     = [];
let catalogReady    = false;
let productsCatalog = [];

// ─── Llamada al proxy seguro en el servidor ───────────────────────────────────
async function askGroq(userMessage) {
  chatHistory.push({ role: 'user', content: userMessage });

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message:  userMessage,
      history:  chatHistory.slice(-6)   // últimos 3 turnos de contexto
    })
  });

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    const msg = data?.error || `Error ${res.status}`;
    throw new Error(msg);
  }

  const reply = data.reply;
  if (!reply) throw new Error('Respuesta vacía del asistente');

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

    fab.addEventListener('click',   () => this.toggle());
    closeBtn.addEventListener('click', () => this.close());
    sendBtn.addEventListener('click',  () => this.send());
    input.addEventListener('keydown',  e => { if (e.key === 'Enter' && !e.shiftKey) this.send(); });

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
        this.addMessage('bot', '¡Hola! 👋 Soy el asistente de **MICHT Decants**. Estoy aquí para ayudarte a encontrar tu fragancia perfecta. ¿Para quién estás buscando el perfume?');
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
      console.error('[MICHT Chatbot]', err.message);

      // Mensajes de error descriptivos según tipo
      let userMsg = 'Ups, ocurrió un error 😅 Por favor inténtalo de nuevo más tarde.';
      if (err.message.includes('429') || err.message.toLowerCase().includes('demasiado')) {
        userMsg = 'Estás enviando muchos mensajes seguidos 😅 Espera un momento e intenta de nuevo.';
      } else if (err.message.includes('503') || err.message.toLowerCase().includes('disponible')) {
        userMsg = 'El asistente no está disponible ahora mismo. Por favor inténtalo de nuevo más tarde.';
      }
      this.addMessage('bot', userMsg);
    }

    this.setInputState(false);
    document.getElementById('chatInput').focus();
  }
};

document.addEventListener('DOMContentLoaded', () => Chatbot.init());
