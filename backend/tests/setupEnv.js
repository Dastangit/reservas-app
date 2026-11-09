// Corre antes de cada archivo de pruebas. dotenv no pisa variables que ya
// existen, asi que vaciarlas aqui evita que las pruebas usen las del .env local
// (por ejemplo, mandar mensajes reales al grupo de Telegram).
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.TELEGRAM_CHAT_ID = '';
// Las pruebas nunca llaman al Nominatim real (geo.test.js simula fetch).
process.env.NOMINATIM_URL = 'http://127.0.0.1:9';
