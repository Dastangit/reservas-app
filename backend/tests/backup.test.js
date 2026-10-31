// Respaldo y restauracion contra una MongoDB en memoria: lo que se respalda
// vuelve identico (ObjectId, fechas, decimales, anidados) y nada se pisa sin
// --replace.
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { backupDatabase, pruneBackups, hideCredentials } = require('../scripts/backup');
const { restoreDatabase } = require('../scripts/restore');

jest.setTimeout(60000);

let mongod;
let conn;
let db;
let root;

const { ObjectId, Decimal128 } = mongoose.mongo;
const docs = {
  bookings: [
    { _id: new ObjectId(), check_in: new Date('2026-11-02T00:00:00Z'), fee: Decimal128.fromString('12.50'), guests: { adults: 2, kids: [3, 7] } },
    { _id: new ObjectId(), status: 'pending_payment', property_id: new ObjectId(), note: 'línea con acentos y "comillas"' },
  ],
  users: [{ _id: new ObjectId(), email: 'a@test.dev', two_factor: { enabled: false } }],
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  conn = await mongoose.createConnection(mongod.getUri('respaldo')).asPromise();
  db = conn.db;
});

afterAll(async () => {
  await conn?.close();
  await mongod?.stop();
});

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'respaldo-'));
  await db.dropDatabase();
  for (const [name, list] of Object.entries(docs)) await db.collection(name).insertMany(list);
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

test('respaldar, vaciar y restaurar devuelve los mismos documentos', async () => {
  const { dir, counts } = await backupDatabase(db, root);
  expect(counts).toEqual({ bookings: 2, users: 1 });
  expect(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).collections).toEqual(counts);
  expect(fs.statSync(path.join(dir, 'users.jsonl.gz')).mode & 0o777).toBe(0o600);
  expect(fs.statSync(dir).mode & 0o777).toBe(0o700);

  await db.dropDatabase();
  expect(await restoreDatabase(db, dir)).toEqual(counts);

  for (const [name, list] of Object.entries(docs)) {
    const back = await db.collection(name).find({}).sort({ _id: 1 }).toArray();
    const original = [...list].sort((a, b) => String(a._id).localeCompare(String(b._id)));
    expect(back).toEqual(original);
  }
});

test('sin --replace no escribe en colecciones con datos; con --replace las reemplaza', async () => {
  const { dir } = await backupDatabase(db, root);
  await db.collection('bookings').insertOne({ extra: true });

  await expect(restoreDatabase(db, dir)).rejects.toThrow(/bookings/);
  expect(await db.collection('bookings').countDocuments()).toBe(3);

  await restoreDatabase(db, dir, { replace: true, only: ['bookings'] });
  expect(await db.collection('bookings').countDocuments()).toBe(2);
  expect(await db.collection('bookings').findOne({ extra: true })).toBeNull();
});

test('restaura respaldos viejos sin comprimir (.jsonl)', async () => {
  const dir = path.join(root, 'viejo');
  fs.mkdirSync(dir);
  const { EJSON } = mongoose.mongo.BSON;
  fs.writeFileSync(path.join(dir, 'users.jsonl'), docs.users.map((d) => EJSON.stringify(d, { relaxed: false })).join('\n'));
  await db.dropDatabase();
  expect(await restoreDatabase(db, dir)).toEqual({ users: 1 });
  expect(await db.collection('users').findOne({})).toEqual(docs.users[0]);
});

test('una coleccion pedida que no esta en el respaldo es un error', async () => {
  const { dir } = await backupDatabase(db, root);
  await expect(restoreDatabase(db, dir, { only: ['pagos'] })).rejects.toThrow(/pagos/);
});

test('conserva solo los ultimos N respaldos completos y no toca nada mas', () => {
  const stamps = ['2026-10-01T03-00-00-000Z', '2026-10-02T03-00-00-000Z', '2026-10-03T03-00-00-000Z'];
  for (const s of stamps) {
    fs.mkdirSync(path.join(root, s));
    fs.writeFileSync(path.join(root, s, 'manifest.json'), '{}');
  }
  fs.mkdirSync(path.join(root, '2026-09-01T03-00-00-000Z')); // a medias: sin manifest
  fs.mkdirSync(path.join(root, 'otra-carpeta'));

  expect(pruneBackups(root, 2)).toEqual([stamps[0]]);
  expect(fs.readdirSync(root).sort()).toEqual(['2026-09-01T03-00-00-000Z', stamps[1], stamps[2], 'otra-carpeta'].sort());
});

test('los errores no muestran la contrasena de la base', () => {
  expect(hideCredentials('fallo en mongodb+srv://user:secreto@dats.x.mongodb.net/Dats'))
    .toBe('fallo en mongodb+srv://***@dats.x.mongodb.net/Dats');
});
