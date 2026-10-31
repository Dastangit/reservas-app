// Corre antes de cada archivo de pruebas. dotenv no pisa variables que ya
// existen, asi que vaciarlas aqui evita que las pruebas usen las del .env local
// (por ejemplo, mandar mensajes reales al grupo de Telegram).
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.TELEGRAM_CHAT_ID = '';
