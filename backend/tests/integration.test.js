// Tests de integracion: la app Express real contra una MongoDB en memoria
// (mongodb-memory-server). Nunca tocan la base de produccion.
// Las variables se fijan ANTES de cargar la app: dotenv no pisa las existentes.
process.env.SENTRY_DSN = '';
process.env.VAPID_PUBLIC_KEY = '';
process.env.VAPID_PRIVATE_KEY = '';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/never-used';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const Experience = require('../models/Experience');
const ExperienceBooking = require('../models/ExperienceBooking');

jest.setTimeout(60000);

let mongod;
let tenant;
let host;
let admin;
let property;
let seq = 0;

const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

const makeUser = (role, extra = {}) => {
  seq += 1;
  return User.create({
    tenant_id: tenant._id,
    email: `${role}${seq}@test.dev`,
    password_hash: 'password123',
    name: `${role} ${seq}`,
    role,
    phone: '+5355512345',
    host_status: 'approved',
    organizer_status: 'approved',
    ...extra,
  });
};

const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const bookingBody = (checkIn, checkOut, extra = {}) => ({
  property_id: String(property._id),
  check_in: checkIn,
  check_out: checkOut,
  num_guests: 2,
  booking_type: 'pre_booking',
  payment_option: 'full_payment',
  tourist_data: { name: 'T', email: 't@test.dev', phone: '+5355512345' },
  ...extra,
});

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  tenant = await Tenant.create({ name: 'Test', domain: 'elysioexperiences.com', admin_email: 'admin@test.dev' });
  host = await makeUser('host');
  admin = await makeUser('admin');
  property = await Property.create({
    tenant_id: tenant._id,
    host_id: host._id,
    name: 'Casa Test',
    type: 'casa_particular',
    description: 'desc',
    location: { city: 'Habana' },
    max_guests: 4,
    price_per_night: 30,
    status: 'active',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('auth', () => {
  test('organizador puede registrarse y queda pendiente sin sesion', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: 'org@test.dev', password: 'password123', name: 'Org', phone: '+5355500000', role: 'organizer' });
    expect(res.status).toBe(201);
    expect(res.body.data.pending_approval).toBe(true);
    expect(res.body.data.token).toBeUndefined();
  });

  test('errores de validacion traen `error` legible', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x', password: '1', name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  test('login con password incorrecta no revela si la cuenta esta pendiente', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'org@test.dev', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });
});

describe('reservas de propiedades', () => {
  test('no permite solapar fechas, si el mismo dia de salida/entrada', async () => {
    const t1 = await makeUser('tourist');
    const t2 = await makeUser('tourist');

    const first = await request(app).post('/api/bookings').set(auth(t1)).send(bookingBody(day(10), day(13)));
    expect(first.status).toBe(201);

    const overlap = await request(app).post('/api/bookings').set(auth(t2)).send(bookingBody(day(12), day(14)));
    expect(overlap.status).toBe(400);

    const turnover = await request(app).post('/api/bookings').set(auth(t2)).send(bookingBody(day(13), day(15)));
    expect(turnover.status).toBe(201);
  });

  test('dos reservas simultaneas de las mismas fechas: sobrevive exactamente una', async () => {
    const [a, b] = await Promise.all([makeUser('tourist'), makeUser('tourist')]);
    const results = await Promise.all([
      request(app).post('/api/bookings').set(auth(a)).send(bookingBody(day(40), day(42))),
      request(app).post('/api/bookings').set(auth(b)).send(bookingBody(day(40), day(42))),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 400]);
    const alive = await Booking.countDocuments({ property_id: property._id, check_in: new Date(day(40)), status: 'pending_payment' });
    expect(alive).toBe(1);
  });

  test('maximo 3 reservas sin pagar por turista', async () => {
    const t = await makeUser('tourist');
    for (let i = 0; i < 3; i += 1) {
      const r = await request(app).post('/api/bookings').set(auth(t)).send(bookingBody(day(60 + i * 3), day(61 + i * 3)));
      expect(r.status).toBe(201);
    }
    const fourth = await request(app).post('/api/bookings').set(auth(t)).send(bookingBody(day(80), day(81)));
    expect(fourth.status).toBe(429);
  });

  test('propiedad suspendida no se puede reservar ni aparece en busqueda', async () => {
    const suspended = await Property.create({
      tenant_id: tenant._id, host_id: host._id, name: 'Suspendida', type: 'hostel', description: 'd',
      location: { city: 'Trinidad' }, max_guests: 2, price_per_night: 10, status: 'active', suspended: true,
    });
    const t = await makeUser('tourist');
    const res = await request(app).post('/api/bookings').set(auth(t))
      .send({ ...bookingBody(day(90), day(91)), property_id: String(suspended._id) });
    expect(res.status).toBe(404);

    const search = await request(app).get('/api/search?city=Trinidad');
    expect(search.body.data.results.map((p) => p.name)).not.toContain('Suspendida');
  });

  test('busqueda con fechas excluye reservadas y bloqueadas, con total correcto', async () => {
    const blocked = await Property.create({
      tenant_id: tenant._id, host_id: host._id, name: 'Bloqueada', type: 'hostel', description: 'd',
      location: { city: 'Vinales' }, max_guests: 2, price_per_night: 10, status: 'active',
      blocked_dates: [{ start_date: new Date(day(100)), end_date: new Date(day(105)) }],
    });
    await Property.create({
      tenant_id: tenant._id, host_id: host._id, name: 'Libre', type: 'hostel', description: 'd',
      location: { city: 'Vinales' }, max_guests: 2, price_per_night: 10, status: 'active',
    });
    const res = await request(app).get(`/api/search?city=Vinales&check_in=${day(101)}&check_out=${day(103)}`);
    expect(res.body.data.results.map((p) => p.name)).toEqual(['Libre']);
    expect(res.body.data.total_count).toBe(1);
    expect(blocked).toBeTruthy();
  });

  test('el admin puede completar una reserva aprobada tras el check-in', async () => {
    const t = await makeUser('tourist');
    const booking = await Booking.create({
      tenant_id: tenant._id, property_id: property._id, tourist_id: t._id, host_id: host._id,
      check_in: new Date(day(-3)), check_out: new Date(day(-1)), num_nights: 2, num_guests: 1,
      booking_type: 'pre_booking', total_amount: 60, payment_option: 'full_payment',
      tourist_data: { phone: '+5355512345' }, status: 'approved',
    });
    const res = await request(app).post(`/api/bookings/${booking._id}/complete`).set(auth(admin));
    expect(res.status).toBe(200);
    expect((await Booking.findById(booking._id)).status).toBe('completed');
  });
});

describe('propiedades', () => {
  test('una propiedad no publicada da 404 al publico pero no a su host', async () => {
    const pending = await Property.create({
      tenant_id: tenant._id, host_id: host._id, name: 'Pendiente', type: 'hostel', description: 'd',
      location: { city: 'X' }, max_guests: 2, price_per_night: 10, admin_notes: 'nota interna',
    });
    expect((await request(app).get(`/api/properties/${pending._id}`)).status).toBe(404);
    const own = await request(app).get(`/api/properties/${pending._id}`).set(auth(host));
    expect(own.status).toBe(200);
    expect(own.body.data.property.admin_notes).toBe('nota interna');
  });

  test('no se puede guardar el public_id de una imagen ajena', async () => {
    const res = await request(app).put(`/api/properties/${property._id}`).set(auth(host)).send({
      images: [{ url: 'https://res.cloudinary.com/x/a.jpg', public_id: 'reservas-app/uploads/otro-usuario/a' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.property.images[0].public_id).toBeUndefined();
    expect(res.body.data.property.changes_pending_review).toBe(true);
  });
});

describe('excursiones', () => {
  let organizer;
  let experience;

  beforeAll(async () => {
    organizer = await makeUser('organizer');
    experience = await Experience.create({
      tenant_id: tenant._id, organizer_id: organizer._id, title: 'Tour', description: 'd',
      location: { city: 'Habana' }, date: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      max_participants: 5, pricing: [{ audience: 'tourist', currency: 'USD', amount: 20 }], status: 'active',
    });
  });

  test('cancelar dos veces a la vez solo libera los cupos una vez', async () => {
    const t = await makeUser('tourist');
    const book = await request(app).post(`/api/experiences/${experience._id}/book`).set(auth(t)).send({
      payment_info: [{ audience: 'tourist', currency: 'USD', num_spots: 2 }],
      tourist_data: { phone: '+5355512345' },
    });
    expect(book.status).toBe(201);
    expect((await Experience.findById(experience._id)).current_participants).toBe(2);

    const id = book.body.data.booking_id;
    await Promise.all([
      request(app).post(`/api/experience-bookings/${id}/cancel`).set(auth(t)),
      request(app).post(`/api/experience-bookings/${id}/cancel`).set(auth(t)),
    ]);
    expect((await Experience.findById(experience._id)).current_participants).toBe(0);
    expect((await ExperienceBooking.findById(id)).status).toBe('cancelled');
  });

  test('la lista de espera rechaza cupos negativos', async () => {
    const t = await makeUser('tourist');
    const res = await request(app).post(`/api/experiences/${experience._id}/waitlist`).set(auth(t))
      .send({ num_spots_requested: -50 });
    expect(res.status).toBe(400);
  });

  test('una excursion creada a las 09:00 se guarda como 09:00 de Cuba', async () => {
    const res = await request(app).post('/api/organizer/experiences').set(auth(organizer)).send({
      title: 'Hora', description: 'd', location: { city: 'Habana' }, max_participants: 3,
      pricing: [{ audience: 'tourist', currency: 'USD', amount: 10 }], date: '2027-01-15T09:00',
    });
    expect(res.status).toBe(201);
    const saved = await Experience.findById(res.body.data.experience_id);
    expect(saved.date.toISOString()).toBe('2027-01-15T14:00:00.000Z');
  });
});

describe('health', () => {
  test('responde ok con la base conectada', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('connected');
  });
});

describe('bloqueo por propiedad', () => {
  test('cinco reservas simultaneas de las mismas fechas: exactamente una', async () => {
    const tourists = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser('tourist')));
    const results = await Promise.all(tourists.map((t) => request(app).post('/api/bookings').set(auth(t))
      .send(bookingBody(day(200), day(203)))));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const alive = await Booking.countDocuments({
      property_id: property._id, check_in: new Date(day(200)), status: 'pending_payment',
    });
    expect(alive).toBe(1);
  });

  test('el host no puede bloquear fechas que ya tienen una reserva', async () => {
    const res = await request(app).post(`/api/properties/${property._id}/availability/block`).set(auth(host))
      .send({ start_date: day(201), end_date: day(202) });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DATE_CONFLICT');
  });

  test('bloquear fechas libres funciona y libera el lock', async () => {
    const res = await request(app).post(`/api/properties/${property._id}/availability/block`).set(auth(host))
      .send({ start_date: day(300), end_date: day(302), reason: 'mantenimiento' });
    expect(res.status).toBe(201);
    const fresh = await Property.findById(property._id).select('+booking_lock_until');
    expect(fresh.booking_lock_until).toBeNull();
  });
});

// TOTP calculado a mano segun RFC 6238 (lo que hacen Google Authenticator y
// Authy), sin otplib: si otplib cambia de comportamiento, estas pruebas fallan.
const crypto = require('crypto');
const base32Decode = (text) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of text.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  return Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
};
const totpAt = (secretBase32, unixSeconds) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(unixSeconds / 30)));
  const h = crypto.createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
};
const now = () => Date.now() / 1000;

describe('2FA (otplib)', () => {
  const login = async (user) => (await request(app).post('/api/auth/login')
    .send({ email: user.email, password: 'password123' })).body.data.pending_token;
  const verify = async (user, code) => request(app).post('/api/auth/verify-2fa').send({ pending_token: await login(user), code });

  test('el calculo manual coincide con el vector oficial del RFC 6238', () => {
    // RFC 6238, apendice B: secreto ASCII "12345678901234567890", T=59 -> 94287082 (8 digitos).
    expect(totpAt('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59)).toBe('287082');
  });

  test('login con codigo valido y el mismo codigo no se puede reutilizar', async () => {
    const { authenticator } = require('otplib');
    const secret = authenticator.generateSecret(20);
    const user = await makeUser('admin', { two_factor: { enabled: true, secret } });

    const code = authenticator.generate(secret);
    expect(code).toBe(totpAt(secret, now()));
    const ok = await verify(user, code);
    expect(ok.status).toBe(200);
    expect(ok.body.data.token).toBeTruthy();

    expect((await verify(user, code)).status).toBe(401);
  });

  test('tolera 30 s de desfase del telefono, pero no 90 s', async () => {
    const secret = require('otplib').authenticator.generateSecret(20);
    const user = await makeUser('admin', { two_factor: { enabled: true, secret } });
    expect((await verify(user, totpAt(secret, now() - 90))).status).toBe(401);
    expect((await verify(user, totpAt(secret, now() - 30))).status).toBe(200);
  });

  test('secretos de antes de la actualizacion (speakeasy, 32 bytes) siguen sirviendo', async () => {
    const secret = crypto.randomBytes(32).toString('hex').slice(0, 32); // 32 bytes ASCII como speakeasy
    const base32 = (() => {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      const bits = [...Buffer.from(secret)].map((b) => b.toString(2).padStart(8, '0')).join('');
      return bits.match(/.{1,5}/g).map((c) => alphabet[parseInt(c.padEnd(5, '0'), 2)]).join('');
    })();
    const user = await makeUser('admin', { two_factor: { enabled: true, secret: base32 } });
    expect((await verify(user, totpAt(base32, now()))).status).toBe(200);
  });

  test('un secreto danado da 401, no 500', async () => {
    const user = await makeUser('admin', { two_factor: { enabled: true, secret: 'NO-ES-BASE32!' } });
    expect((await verify(user, '123456')).status).toBe(401);
  });

  test('activar: setup da el QR y la clave, y enable acepta el codigo de la app', async () => {
    const user = await makeUser('admin');
    const setup = await request(app).post('/api/auth/2fa/setup').set(auth(user));
    expect(setup.status).toBe(200);
    expect(setup.body.data.qr_code).toMatch(/^data:image\/png;base64,/);
    const key = setup.body.data.manual_entry_key;
    expect(key).toMatch(/^[A-Z2-7]{32}$/); // 20 bytes

    const wrong = await request(app).post('/api/auth/2fa/enable').set(auth(user)).send({ code: '000000' });
    expect(wrong.status).toBe(400);
    const enable = await request(app).post('/api/auth/2fa/enable').set(auth(user)).send({ code: totpAt(key, now()) });
    expect(enable.status).toBe(200);
    expect(enable.body.data.backup_codes.length).toBeGreaterThan(0);
  });

  test('setup no reemplaza un 2FA ya activo', async () => {
    const user = await makeUser('admin', { two_factor: { enabled: true, secret: require('otplib').authenticator.generateSecret(20) } });
    const res = await request(app).post('/api/auth/2fa/setup').set(auth(user));
    expect(res.status).toBe(400);
  });
});
