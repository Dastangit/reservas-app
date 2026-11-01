// Entorno local completo SIN tocar produccion: API real + MongoDB en memoria
// con datos demo + frontend estatico.  `npm run dev:local`
//   Web: http://localhost:5500   API: http://localhost:3000
//   Usuarios (password: password123): admin@test.dev, host@test.dev,
//   tourist@test.dev, org@test.dev, suspended@test.dev
// Los datos se pierden al parar el proceso.
const path = require('path');

const BACKEND = path.join(__dirname, '..');
const FRONTEND = path.join(__dirname, '..', '..', 'frontend');
process.env.SENTRY_DSN = '';
process.env.VAPID_PUBLIC_KEY = '';
process.env.VAPID_PRIVATE_KEY = '';
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.TELEGRAM_CHAT_ID = '';
process.env.MONGODB_URI = 'mongodb://unused';
process.env.JWT_SECRET = 'dev-secret';
process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret';
process.env.NODE_ENV = 'development';
// Nada de servicios externos reales desde el entorno local.
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.QVAPAY_APP_ID = '';
process.env.QVAPAY_APP_SECRET = '';
const express = require(path.join(BACKEND, 'node_modules/express'));
const mongoose = require(path.join(BACKEND, 'node_modules/mongoose'));
const { MongoMemoryServer } = require(path.join(BACKEND, 'node_modules/mongodb-memory-server'));

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const app = require(path.join(BACKEND, 'app'));
  const Tenant = require(path.join(BACKEND, 'models/Tenant'));
  const User = require(path.join(BACKEND, 'models/User'));
  const Property = require(path.join(BACKEND, 'models/Property'));
  const Experience = require(path.join(BACKEND, 'models/Experience'));

  const tenant = await Tenant.create({ name: 'Elysio', domain: 'elysioexperiences.com', admin_email: 'admin@test.dev' });
  const mk = (email, role, extra = {}) => User.create({
    tenant_id: tenant._id, email, password_hash: 'password123', name: role, role, phone: '+5355512345',
    host_status: 'approved', organizer_status: 'approved', ...extra,
  });
  await mk('admin@test.dev', 'admin');
  const host = await mk('host@test.dev', 'host');
  await mk('suspended@test.dev', 'host', { status: 'suspended' });
  await mk('tourist@test.dev', 'tourist');
  const organizer = await mk('org@test.dev', 'organizer');
  await Property.create({
    tenant_id: tenant._id, host_id: host._id, name: 'Casa Azul', type: 'casa_particular',
    description: 'Casa de prueba en el Vedado', location: { city: 'La Habana', country: 'CU' }, max_guests: 4,
    price_per_night: 35, status: 'active',
  });
  await Property.create({
    tenant_id: tenant._id, host_id: host._id, name: 'Pendiente de revisar', type: 'hostel',
    description: 'pendiente', location: { city: 'Trinidad', country: 'CU' }, max_guests: 2, price_per_night: 15,
  });
  await Experience.create({
    tenant_id: tenant._id, organizer_id: organizer._id, title: 'Tour Habana Vieja', description: 'Paseo',
    location: { city: 'La Habana', country: 'CU' }, timezone: 'America/Havana',
    // Siempre en el futuro (antes era una fecha fija que ya habia pasado).
    date: new Date(Date.now() + 14 * 24 * 3600 * 1000), max_participants: 8,
    pricing: [{ audience: 'tourist', currency: 'USD', amount: 25 }], status: 'active',
  });
  await Property.create({
    tenant_id: tenant._id, host_id: host._id, name: 'Apartamento Roma Norte', type: 'apartment',
    description: 'Departamento de prueba en CDMX', location: { city: 'Ciudad de México', country: 'MX' }, max_guests: 3,
    price_per_night: 60, status: 'active',
  });
  await Experience.create({
    tenant_id: tenant._id, organizer_id: organizer._id, title: 'Tapas por el centro', description: 'Ruta gastronómica',
    location: { city: 'Madrid', country: 'ES' }, timezone: 'Europe/Madrid',
    date: new Date(Date.now() + 10 * 24 * 3600 * 1000), max_participants: 10,
    pricing: [{ audience: 'tourist', currency: 'USD', amount: 40 }], status: 'active',
  });

  app.listen(3000, () => console.log('API http://localhost:3000'));

  const web = express();
  web.use(express.static(FRONTEND));
  web.get('*', (req, res) => res.sendFile(path.join(FRONTEND, 'index.html')));
  web.listen(5500, () => console.log('WEB http://localhost:5500'));
})().catch((e) => { console.error(e); process.exit(1); });
