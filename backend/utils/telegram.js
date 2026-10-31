const axios = require('axios');

// Segundo canal de avisos al admin (opcional). El web push depende de que el
// navegador del admin siga suscrito; para los avisos con plazo (reserva pagada
// pendiente, recordatorios) se manda tambien un mensaje por un bot de Telegram.
// Configuracion: TELEGRAM_BOT_TOKEN (de @BotFather) y TELEGRAM_CHAT_ID (el chat
// del admin con el bot). Si falta alguna, el canal se ignora.
const isTelegramConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

async function sendTelegram(text) {
  if (!isTelegramConfigured()) return { ok: false, reason: 'not_configured' };
  try {
    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      { chat_id: process.env.TELEGRAM_CHAT_ID, text: String(text).slice(0, 4000), disable_web_page_preview: true },
      { timeout: 8000 },
    );
    return { ok: true };
  } catch (error) {
    console.error('[Telegram] No se pudo enviar el aviso:', error.response?.data?.description || error.message);
    return { ok: false, reason: 'error' };
  }
}

module.exports = { sendTelegram, isTelegramConfigured };
