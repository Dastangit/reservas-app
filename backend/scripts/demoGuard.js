// Barrera para los seeds de datos DEMO. En agosto de 2026 las casas demo (con
// valoraciones inventadas) acabaron en la base real porque el .env local
// apunta a produccion y NODE_ENV no era 'production'. Ahora hace falta:
//   - ALLOW_DEMO_SEED=true de forma explicita, y
//   - una base que NO sea de MongoDB Atlas (*.mongodb.net), es decir local.
// Para probar con datos demo sin riesgo: `npm run dev:local` (Mongo en memoria).
function assertDemoSeedAllowed() {
  const uri = process.env.MONGODB_URI || '';
  const target = uri.replace(/\/\/[^@]*@/, '//***@').split('?')[0];
  console.log(`[demo seed] Base de destino: ${target || '(sin MONGODB_URI)'}`);

  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('Seed demo bloqueado: define ALLOW_DEMO_SEED=true si de verdad quieres datos de ejemplo.');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production' || /mongodb\.net/i.test(uri)) {
    console.error('Seed demo bloqueado: la base de destino parece real (produccion o Atlas). Usa una base local.');
    process.exit(1);
  }
}

module.exports = { assertDemoSeedAllowed };
