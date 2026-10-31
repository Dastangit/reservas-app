// Copia de seguridad de toda la base a <BACKUP_DIR>/<fecha>/ (por defecto
// backend/backups/, ignorado por git). Un archivo .jsonl.gz por coleccion, un
// documento EJSON por linea (conserva ObjectId y fechas), y manifest.json al
// final: una carpeta sin manifest es un respaldo que no termino.
//
//   npm run backup
//   BACKUP_DIR=~/Dastan/respaldos/reservas BACKUP_KEEP=14 npm run backup
//
// Conserva los ultimos BACKUP_KEEP respaldos completos (14 por defecto) y
// borra los mas viejos. Si falla, avisa por Telegram (si esta configurado).
// Restaurar: scripts/restore.js.
//
// Atlas M0 (gratis) no tiene backups automaticos: en la PC lo corre un
// temporizador de systemd (ver docs/RESPALDOS.md). Contiene datos personales
// y hashes de contrasenas: carpetas 700 y archivos 600, nunca en el repo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const mongoose = require('mongoose');

const { EJSON } = mongoose.mongo.BSON;
const STAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

async function backupDatabase(db, root) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(root, stamp);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const counts = {};
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    let count = 0;
    async function* lines() {
      for await (const doc of db.collection(name).find({})) {
        count += 1;
        yield `${EJSON.stringify(doc, { relaxed: false })}\n`;
      }
    }
    await pipeline(
      Readable.from(lines()),
      zlib.createGzip(),
      fs.createWriteStream(path.join(dir, `${name}.jsonl.gz`), { mode: 0o600 }),
    );
    counts[name] = count;
  }

  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    `${JSON.stringify({ created_at: new Date().toISOString(), database: db.databaseName, collections: counts }, null, 2)}\n`,
    { mode: 0o600 },
  );
  return { dir, counts };
}

// Solo cuenta (y borra) respaldos completos con nombre de fecha: nunca toca
// otras carpetas ni respaldos a medias.
function pruneBackups(root, keep) {
  const complete = fs.readdirSync(root)
    .filter((name) => STAMP_RE.test(name) && fs.existsSync(path.join(root, name, 'manifest.json')))
    .sort();
  const old = complete.slice(0, Math.max(0, complete.length - keep));
  for (const name of old) fs.rmSync(path.join(root, name), { recursive: true, force: true });
  return old;
}

const hideCredentials = (text) => String(text).replace(/\/\/[^@/\s]*@/g, '//***@');

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const root = path.resolve((process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups')).replace(/^~(?=\/|$)/, os.homedir()));
  const keep = Number(process.env.BACKUP_KEEP || 14);
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI');
  if (!Number.isInteger(keep) || keep < 1) throw new Error('BACKUP_KEEP debe ser un entero mayor que 0');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  try {
    const { dir, counts } = await backupDatabase(mongoose.connection.db, root);
    for (const [name, count] of Object.entries(counts)) console.log(`${name}: ${count} documentos`);
    console.log(`\nBackup en ${dir}`);
    const removed = pruneBackups(root, keep);
    if (removed.length) console.log(`Borrados ${removed.length} respaldo(s) viejo(s); quedan los ultimos ${keep}.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    const message = hideCredentials(error.message);
    console.error('Error en backup:', message);
    const { sendTelegram } = require('../utils/telegram');
    await sendTelegram(`Respaldo de la base de reservas FALLO\n${message}\nRevisa: journalctl --user -u reservas-respaldo`);
    process.exit(1);
  });
}

module.exports = { backupDatabase, pruneBackups, hideCredentials };
