// Restaura un respaldo de scripts/backup.js en la base de MONGODB_URI.
//
//   node scripts/restore.js <carpeta-del-respaldo>                    # solo colecciones vacias
//   node scripts/restore.js <carpeta> --only bookings,users           # algunas colecciones
//   node scripts/restore.js <carpeta> --replace                       # BORRA lo que haya y restaura
//
// Sin --replace se niega a escribir en una coleccion que ya tenga documentos.
// Acepta los respaldos viejos sin comprimir (.jsonl). Los indices no van en el
// respaldo: Mongoose los crea al arrancar el backend.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const mongoose = require('mongoose');

const { EJSON } = mongoose.mongo.BSON;
const BATCH = 500;

function backupFiles(dir) {
  const files = {};
  for (const file of fs.readdirSync(dir)) {
    const m = file.match(/^(.+)\.jsonl(\.gz)?$/);
    if (m) files[m[1]] = { file: path.join(dir, file), gzip: Boolean(m[2]) };
  }
  return files;
}

async function restoreDatabase(db, dir, { only = null, replace = false } = {}) {
  const files = backupFiles(dir);
  const names = only || Object.keys(files);
  const missing = names.filter((name) => !files[name]);
  if (missing.length) throw new Error(`No estan en el respaldo: ${missing.join(', ')}`);

  if (!replace) {
    const busy = [];
    for (const name of names) {
      if (await db.collection(name).estimatedDocumentCount() > 0) busy.push(name);
    }
    if (busy.length) throw new Error(`Ya tienen documentos (usa --replace para borrarlos): ${busy.join(', ')}`);
  }

  const counts = {};
  for (const name of names) {
    const collection = db.collection(name);
    if (replace) await collection.deleteMany({});
    let input = fs.createReadStream(files[name].file);
    if (files[name].gzip) input = input.pipe(zlib.createGunzip());
    let batch = [];
    let count = 0;
    for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
      if (!line.trim()) continue;
      batch.push(EJSON.parse(line, { relaxed: false }));
      if (batch.length >= BATCH) {
        await collection.insertMany(batch);
        count += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await collection.insertMany(batch);
      count += batch.length;
    }
    counts[name] = count;
  }
  return counts;
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--only');
  const onlyIndex = args.indexOf('--only');
  const only = onlyIndex >= 0 ? (args[onlyIndex + 1] || '').split(',').filter(Boolean) : null;
  const replace = args.includes('--replace');
  if (!dir || !fs.existsSync(dir)) throw new Error('Indica la carpeta del respaldo: node scripts/restore.js <carpeta>');
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI');

  const target = process.env.MONGODB_URI.replace(/\/\/[^@/]*@/, '//***@').split('?')[0];
  console.log(`Restaurando ${dir}\nen ${target}${replace ? '  (--replace: se BORRA lo que haya)' : ''}`);

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  try {
    const counts = await restoreDatabase(mongoose.connection.db, dir, { only, replace });
    for (const [name, count] of Object.entries(counts)) console.log(`${name}: ${count} documentos`);
    console.log('\nListo. Reinicia el backend para que cree los indices.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error al restaurar:', error.message);
    process.exit(1);
  });
}

module.exports = { restoreDatabase };
