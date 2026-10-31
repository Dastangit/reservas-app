// Copia de seguridad de toda la base a backend/backups/<fecha>/ (ignorado por git).
// Un archivo por coleccion, un documento EJSON por linea (conserva ObjectId y fechas).
//
//   npm run backup
//
// Restaurar una coleccion:
//   mongoimport --uri "<MONGODB_URI>" --collection bookings --file backups/<fecha>/bookings.jsonl
//
// Atlas M0 (gratis) no tiene backups automaticos: programa este script en tu PC
// (Programador de tareas de Windows) y guarda la carpeta en un sitio seguro y
// privado -- contiene datos personales de usuarios. Nunca la subas al repo.
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const { EJSON } = mongoose.mongo.BSON;

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(__dirname, '..', 'backups', stamp);
  fs.mkdirSync(dir, { recursive: true });

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    const out = fs.createWriteStream(path.join(dir, `${name}.jsonl`));
    let count = 0;
    for await (const doc of db.collection(name).find({})) {
      out.write(`${EJSON.stringify(doc, { relaxed: false })}\n`);
      count += 1;
    }
    await new Promise((resolve) => out.end(resolve));
    console.log(`${name}: ${count} documentos`);
  }

  console.log(`\nBackup en ${dir}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Error en backup:', error.message);
  process.exit(1);
});
