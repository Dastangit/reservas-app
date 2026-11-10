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
// Nunca llamar a QvaPay real desde los tests (el .env local puede tener credenciales).
process.env.QVAPAY_APP_ID = '';
process.env.QVAPAY_APP_SECRET = '';

// La suite ronda las 100 peticiones por minuto desde la misma IP, el tope del
// limite general de la API (apiLimiter): con unos tests mas, cortaria los ultimos.
jest.mock('../middleware/rateLimiter', () => ({
  ...jest.requireActual('../middleware/rateLimiter'),
  apiLimiter: (req, res, next) => next(),
}));

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
const Feedback = require('../models/Feedback');
const { demoServices } = require('../scripts/demoServices');

jest.setTimeout(60000);

let mongod;
let tenant;
let host;
let admin;
let property;
let seq = 0;

const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
// Punto GeoJSON ([lng, lat]) para el mapa de los formularios.
const pt = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
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
  offer_accepted: true,
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
    services: demoServices(),
    amenities: ['Terraza'],
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

  test('reservar exige aceptar lo que incluye y guarda una copia de la oferta', async () => {
    const t = await makeUser('tourist');
    const noAccept = await request(app).post('/api/bookings').set(auth(t))
      .send(bookingBody(day(500), day(502), { offer_accepted: undefined }));
    expect(noAccept.status).toBe(400);
    expect(noAccept.body.error).toMatch(/includes/);

    const ok = await request(app).post('/api/bookings').set(auth(t)).send(bookingBody(day(500), day(502)));
    expect(ok.status).toBe(201);
    const saved = await Booking.findById(ok.body.data.booking_id);
    expect(saved.offer_accepted_at).toBeInstanceOf(Date);
    expect(saved.offer_snapshot.amenities).toEqual(['Terraza']);
    expect(saved.offer_snapshot.services.items.find((i) => i.key === 'wifi').status).toBe('included');
    expect(saved.offer_snapshot.services.air_conditioning.schedule).toMatchObject({ mode: 'hours', from: '20:00' });
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
  test('acepta los tipos de alojamiento nuevos y rechaza los desconocidos', async () => {
    const h = await makeUser('host');
    const body = (type) => ({
      name: `Tipo ${type}`, type, description: 'd', max_guests: 2, price_per_night: 50,
      location: { city: 'Madrid', country: 'ES', neighborhood: 'Sol', geo: pt(-3.7038, 40.4168) }, services: demoServices(),
    });
    for (const type of ['apartment', 'villa', 'private_room', 'hotel']) {
      const res = await request(app).post('/api/properties').set(auth(h)).send(body(type));
      expect(res.status).toBe(201);
    }
    const bad = await request(app).post('/api/properties').set(auth(h)).send(body('castle'));
    expect(bad.status).toBe(400);
  });

  test('publicar exige pais y la busqueda filtra por pais', async () => {
    const h = await makeUser('host');
    const base = {
      name: 'Casa Global', type: 'casa_particular', description: 'd', max_guests: 2, price_per_night: 40,
      services: demoServices(),
    };
    const noCountry = await request(app).post('/api/properties').set(auth(h)).send({ ...base, location: { city: 'Cancun', neighborhood: 'Centro', geo: pt(-86.85, 21.16) } });
    expect(noCountry.status).toBe(400);
    const ok = await request(app).post('/api/properties').set(auth(h)).send({ ...base, location: { city: 'Cancun', country: 'mx', neighborhood: 'Centro', geo: pt(-86.85, 21.16) } });
    expect(ok.status).toBe(201);

    const created = await Property.findOne({ name: 'Casa Global' });
    expect(created.location.country).toBe('MX');
    await Property.updateOne({ _id: created._id }, { status: 'active' });

    const mx = await request(app).get('/api/properties?country=MX');
    expect(mx.body.data.properties.map((p) => p.name)).toContain('Casa Global');
    const es = await request(app).get('/api/properties?country=ES');
    expect(es.body.data.properties.map((p) => p.name)).not.toContain('Casa Global');
  });

  test('publicar exige contestar cada servicio, aunque sea "no tiene"', async () => {
    const h = await makeUser('host');
    const base = {
      name: 'Casa Servicios', type: 'house', description: 'd', max_guests: 2, price_per_night: 40,
      location: { city: 'Lima', country: 'PE', neighborhood: 'Miraflores', geo: pt(-77.04, -12.05) },
    };
    const none = await request(app).post('/api/properties').set(auth(h)).send(base);
    expect(none.status).toBe(400);
    const partial = demoServices();
    partial.items.pop();
    const missing = await request(app).post('/api/properties').set(auth(h)).send({ ...base, services: partial });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toMatch(/city_guide/);

    const ok = await request(app).post('/api/properties').set(auth(h))
      .send({ ...base, services: demoServices(), amenities: ['Piscina', ' ', 'Piscina'] });
    expect(ok.status).toBe(201);
    const saved = await Property.findById(ok.body.data.property_id);
    expect(saved.services.items).toHaveLength(10);
    expect(saved.amenities).toEqual(['Piscina']);
  });

  test('el admin no aprueba una propiedad sin servicios, punto en el mapa ni barrio', async () => {
    const legacy = await Property.create({
      tenant_id: tenant._id, host_id: host._id, name: 'Sin servicios', type: 'hostel', description: 'd',
      location: { city: 'X', country: 'MX' }, max_guests: 2, price_per_night: 10,
    });
    const denied = await request(app).post(`/api/admin/properties/${legacy._id}/approve`).set(auth(admin));
    expect(denied.status).toBe(400);

    await Property.updateOne({ _id: legacy._id }, { services: demoServices() });
    const noMap = await request(app).post(`/api/admin/properties/${legacy._id}/approve`).set(auth(admin));
    expect(noMap.status).toBe(400);
    expect(noMap.body.error).toMatch(/map/);

    await Property.updateOne({ _id: legacy._id }, { 'location.geo': pt(-99.13, 19.43) });
    const noNeighborhood = await request(app).post(`/api/admin/properties/${legacy._id}/approve`).set(auth(admin));
    expect(noNeighborhood.status).toBe(400);
    expect(noNeighborhood.body.error).toMatch(/neighborhood/);

    await Property.updateOne({ _id: legacy._id }, { 'location.neighborhood': 'Roma' });
    const ok = await request(app).post(`/api/admin/properties/${legacy._id}/approve`).set(auth(admin));
    expect(ok.status).toBe(200);
  });

  test('empeorar la oferta marca revision y avisa a las reservas futuras; mejorarla no', async () => {
    const offered = await Property.create({
      tenant_id: tenant._id, host_id: host._id, name: 'Casa Oferta', type: 'house', description: 'd',
      location: { city: 'Quito', country: 'EC' }, max_guests: 2, price_per_night: 25, status: 'active',
      services: demoServices(), amenities: ['Piscina'],
    });
    const t = await makeUser('tourist');
    const mk = (offset, status) => Booking.create({
      tenant_id: tenant._id, property_id: offered._id, tourist_id: t._id, host_id: host._id,
      check_in: new Date(day(offset)), check_out: new Date(day(offset + 2)), num_nights: 2, num_guests: 1,
      booking_type: 'pre_booking', total_amount: 50, payment_option: 'full_payment',
      tourist_data: { phone: '+5355512345' }, status,
    });
    const future = await mk(30, 'approved');
    const past = await mk(-10, 'completed');

    const better = await request(app).put(`/api/properties/${offered._id}`).set(auth(host))
      .send({ services: demoServices({ items: { laundry: 'included' } }) });
    expect(better.status).toBe(200);
    expect(better.body.data.property.changes_pending_review).toBe(true);
    expect((await Booking.findById(future._id)).offer_changed_at).toBeUndefined();

    const worse = await request(app).put(`/api/properties/${offered._id}`).set(auth(host))
      .send({ services: demoServices({ items: { laundry: 'included', wifi: 'unavailable' } }), amenities: [] });
    expect(worse.status).toBe(200);
    const flagged = await Booking.findById(future._id);
    expect(flagged.offer_changed_at).toBeInstanceOf(Date);
    expect(flagged.offer_changes).toEqual(expect.arrayContaining(['items.wifi', 'amenities']));
    expect((await Booking.findById(past._id)).offer_changed_at).toBeUndefined();
  });

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

  const experienceBody = (extra = {}) => ({
    title: 'Hora', description: 'd', location: { city: 'Habana', country: 'cu', geo: pt(-82.36, 23.13) }, timezone: 'America/Havana',
    max_participants: 3, pricing: [{ audience: 'tourist', currency: 'USD', amount: 10 }], date: '2027-01-15T09:00',
    ...extra,
  });

  test('una excursion creada a las 09:00 se guarda como 09:00 de su zona horaria', async () => {
    const res = await request(app).post('/api/organizer/experiences').set(auth(organizer)).send(experienceBody());
    expect(res.status).toBe(201);
    const saved = await Experience.findById(res.body.data.experience_id);
    expect(saved.date.toISOString()).toBe('2027-01-15T14:00:00.000Z');
    expect(saved.location.country).toBe('CU');

    const madrid = await request(app).post('/api/organizer/experiences').set(auth(organizer)).send(experienceBody({
      location: { city: 'Madrid', country: 'ES', geo: pt(-3.7038, 40.4168) }, timezone: 'Europe/Madrid',
    }));
    expect(madrid.status).toBe(201);
    expect((await Experience.findById(madrid.body.data.experience_id)).date.toISOString()).toBe('2027-01-15T08:00:00.000Z');
  });

  test('el precio admite cualquier moneda ISO (y USDT) pero no codigos inventados', async () => {
    const mx = await request(app).post('/api/organizer/experiences').set(auth(organizer)).send(experienceBody({
      location: { city: 'Oaxaca', country: 'MX', geo: pt(-96.72, 17.06) }, timezone: 'America/Mexico_City',
      pricing: [{ audience: 'tourist', currency: 'mxn', amount: 450 }, { audience: 'local', currency: 'USDT', amount: 20 }],
    }));
    expect(mx.status).toBe(201);
    const saved = await Experience.findById(mx.body.data.experience_id);
    expect(saved.pricing.map((p) => p.currency)).toEqual(['MXN', 'USDT']);

    const fake = await request(app).post('/api/organizer/experiences').set(auth(organizer)).send(experienceBody({
      pricing: [{ audience: 'tourist', currency: 'XYZ', amount: 10 }],
    }));
    expect(fake.status).toBe(400);
  });

  test('se reserva en la moneda de la excursion aunque llegue en minusculas', async () => {
    const cop = await Experience.create({
      tenant_id: tenant._id, organizer_id: organizer._id, title: 'Tour COP', description: 'd',
      location: { city: 'Cartagena', country: 'CO' }, date: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      max_participants: 5, pricing: [{ audience: 'tourist', currency: 'COP', amount: 80000 }], status: 'active',
    });
    const t = await makeUser('tourist');
    const res = await request(app).post(`/api/experiences/${cop._id}/book`).set(auth(t)).send({
      payment_info: [{ audience: 'tourist', currency: 'cop', num_spots: 2 }],
      tourist_data: { phone: '+5355512345' },
    });
    expect(res.status).toBe(201);
    const booking = await ExperienceBooking.findById(res.body.data.booking_id);
    expect(booking.payment_info[0]).toMatchObject({ currency: 'COP', amount: 160000 });
  });

  test('dos excursiones de fecha unica a la misma hora se pueden publicar', async () => {
    const other = await makeUser('organizer');
    const body = experienceBody({ date: '2027-03-01T10:00' });
    const first = await request(app).post('/api/organizer/experiences').set(auth(organizer)).send(body);
    const second = await request(app).post('/api/organizer/experiences').set(auth(other)).send(body);
    expect([first.status, second.status]).toEqual([201, 201]);
  });

  test('crear una excursion exige pais y zona horaria validos', async () => {
    const noCountry = await request(app).post('/api/organizer/experiences').set(auth(organizer))
      .send(experienceBody({ location: { city: 'Habana', geo: pt(-82.36, 23.13) } }));
    expect(noCountry.status).toBe(400);
    const badZone = await request(app).post('/api/organizer/experiences').set(auth(organizer))
      .send(experienceBody({ timezone: 'Marte/Olympus' }));
    expect(badZone.status).toBe(400);
    const badCountry = await request(app).post('/api/organizer/experiences').set(auth(organizer))
      .send(experienceBody({ location: { city: 'X', country: 'ZZ', geo: pt(-82.36, 23.13) } }));
    expect(badCountry.status).toBe(400);
  });

  test('editar solo la fecha usa la zona horaria que ya tenia la excursion', async () => {
    const created = await request(app).post('/api/organizer/experiences').set(auth(organizer)).send(experienceBody({
      location: { city: 'CDMX', country: 'MX', geo: pt(-99.13, 19.43) }, timezone: 'America/Mexico_City',
    }));
    const id = created.body.data.experience_id;
    const res = await request(app).put(`/api/organizer/experiences/${id}`).set(auth(organizer)).send({ date: '2027-02-10T10:00' });
    expect(res.status).toBe(200);
    expect((await Experience.findById(id)).date.toISOString()).toBe('2027-02-10T16:00:00.000Z');
  });

  test('el organizador lista sus series con el numero de ocurrencias, y solo las suyas', async () => {
    const create = await request(app).post('/api/organizer/recurrences').set(auth(organizer)).send({
      title: 'Serie', description: 'd', location: { city: 'Madrid', country: 'ES', geo: pt(-3.7038, 40.4168) }, timezone: 'Europe/Madrid', max_participants: 3,
      pricing: [{ audience: 'tourist', currency: 'USD', amount: 10 }],
      recurrence: { start_date: day(1), days_of_week: [0, 1, 2, 3, 4, 5, 6], time_of_day: '09:00' },
    });
    expect(create.status).toBe(201);

    const res = await request(app).get('/api/organizer/recurrences').set(auth(organizer));
    expect(res.status).toBe(200);
    const serie = res.body.data.recurrences.find((r) => r._id === create.body.data.recurrence_id);
    expect(serie.occurrences_generated).toBe(create.body.data.occurrences_generated);
    expect(serie.occurrences_generated).toBeGreaterThan(0);

    // Las ocurrencias heredan la zona y caen a las 09:00 de Madrid (08:00 o 07:00 UTC segun el horario).
    const occurrences = await Experience.find({ recurrence_id: serie._id });
    expect(occurrences.every((o) => o.timezone === 'Europe/Madrid')).toBe(true);
    const madridHour = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }).format(d));
    expect(occurrences.every((o) => madridHour(o.date) === 9)).toBe(true);

    const other = await makeUser('organizer');
    const otherRes = await request(app).get('/api/organizer/recurrences').set(auth(other));
    expect(otherRes.body.data.recurrences).toHaveLength(0);
  });
});

describe('direccion exacta y zona aproximada', () => {
  const { distanceMeters } = require('../utils/geo');
  const exact = pt(-75.5144, 10.4236);
  const hidden = (location) => {
    expect(location.address).toBeUndefined();
    expect(location.geo).toBeUndefined();
    expect(location.approx.type).toBe('Point');
  };

  let h;
  let id;
  beforeAll(async () => {
    h = await makeUser('host');
    const res = await request(app).post('/api/properties').set(auth(h)).send({
      name: 'Casa Privada', type: 'house', description: 'd', max_guests: 2, price_per_night: 40,
      services: demoServices(),
      // approx enviado por el cliente: se ignora, lo calcula el servidor.
      location: {
        city: 'Cartagena', country: 'CO', neighborhood: 'Centro', address: 'Calle 1 #2-3', geo: exact, approx: exact,
      },
    });
    expect(res.status).toBe(201);
    id = res.body.data.property_id;
    await Property.updateOne({ _id: id }, { status: 'active' });
  });

  test('la zona aproximada queda a 150-300 m del punto exacto', async () => {
    const saved = await Property.findById(id).lean();
    expect(saved.location.geo.coordinates).toEqual(exact.coordinates);
    const d = distanceMeters(saved.location.geo, saved.location.approx);
    expect(d).toBeGreaterThanOrEqual(149);
    expect(d).toBeLessThanOrEqual(301);
  });

  test('el publico no ve la direccion ni el punto exacto; el dueno si', async () => {
    const list = await request(app).get('/api/properties?country=CO');
    hidden(list.body.data.properties.find((p) => p._id === id).location);
    const search = await request(app).get('/api/search?city=Cartagena');
    hidden(search.body.data.results.find((p) => p._id === id).location);
    const detail = await request(app).get(`/api/properties/${id}`);
    hidden(detail.body.data.property.location);
    const otherTourist = await makeUser('tourist');
    hidden((await request(app).get(`/api/properties/${id}`).set(auth(otherTourist))).body.data.property.location);

    const own = await request(app).get(`/api/properties/${id}`).set(auth(h));
    expect(own.body.data.property.location).toMatchObject({ address: 'Calle 1 #2-3', geo: exact });
  });

  test('publicar o cambiar la ubicacion exige el barrio', async () => {
    const res = await request(app).post('/api/properties').set(auth(h)).send({
      name: 'Sin barrio', type: 'house', description: 'd', max_guests: 2, price_per_night: 40,
      services: demoServices(), location: { city: 'Cartagena', country: 'CO', neighborhood: ' ', geo: exact },
    });
    expect(res.status).toBe(400);
    const edit = await request(app).put(`/api/properties/${id}`).set(auth(h))
      .send({ location: { city: 'Cartagena', country: 'CO', geo: exact } });
    expect(edit.status).toBe(400);
    const priceOnly = await request(app).put(`/api/properties/${id}`).set(auth(h)).send({ price_per_night: 41 });
    expect(priceOnly.status).toBe(200);
  });

  test('editar sin mover el punto conserva la zona; moverlo la recalcula', async () => {
    const before = (await Property.findById(id).lean()).location.approx;
    const same = await request(app).put(`/api/properties/${id}`).set(auth(h))
      .send({ location: { city: 'Cartagena', country: 'CO', address: 'Calle 1 #2-3', neighborhood: 'Getsemani' } });
    expect(same.status).toBe(200);
    const kept = (await Property.findById(id).lean()).location;
    expect(kept.geo.coordinates).toEqual(exact.coordinates);
    expect(kept.approx).toEqual(before);

    const moved = pt(-75.55, 10.40);
    await request(app).put(`/api/properties/${id}`).set(auth(h))
      .send({ location: { city: 'Cartagena', country: 'CO', neighborhood: 'Manga', geo: moved } });
    const after = (await Property.findById(id).lean()).location;
    expect(after.approx).not.toEqual(before);
    expect(distanceMeters(moved, after.approx)).toBeLessThanOrEqual(301);

    const bad = await request(app).put(`/api/properties/${id}`).set(auth(h))
      .send({ location: { city: 'Cartagena', country: 'CO', neighborhood: 'Manga', geo: pt(-200, 10) } });
    expect(bad.status).toBe(400);
    await request(app).put(`/api/properties/${id}`).set(auth(h))
      .send({ location: { city: 'Cartagena', country: 'CO', neighborhood: 'Centro', address: 'Calle 1 #2-3', geo: exact } });
  });

  test('el turista recibe la direccion solo con la reserva aprobada', async () => {
    const t = await makeUser('tourist');
    const booking = await Booking.create({
      tenant_id: tenant._id, property_id: id, tourist_id: t._id, host_id: h._id,
      check_in: new Date(day(600)), check_out: new Date(day(602)), num_nights: 2, num_guests: 1,
      booking_type: 'pre_booking', total_amount: 80, payment_option: 'full_payment',
      tourist_data: { phone: '+5355512345' }, status: 'pending_approval',
    });
    const mine = async () => (await request(app).get('/api/bookings').set(auth(t))).body.data.bookings
      .find((b) => b._id === String(booking._id)).property_id.location;
    const one = async () => (await request(app).get(`/api/bookings/${booking._id}`).set(auth(t)))
      .body.data.booking.property_id.location;

    hidden(await mine());
    hidden(await one());
    const forHost = await request(app).get(`/api/bookings/${booking._id}`).set(auth(h));
    expect(forHost.body.data.booking.property_id.location.address).toBe('Calle 1 #2-3');

    await Booking.updateOne({ _id: booking._id }, { status: 'approved' });
    expect(await mine()).toMatchObject({ address: 'Calle 1 #2-3', geo: exact });
    expect(await one()).toMatchObject({ address: 'Calle 1 #2-3', geo: exact });
  });
});

describe('buscador de direcciones', () => {
  const { resetForTests } = require('../utils/nominatim');
  const nominatimItem = {
    lat: '19.4326', lon: '-99.1332', display_name: 'Zocalo, Ciudad de Mexico, Mexico',
    address: { road: 'Plaza de la Constitucion', house_number: '1', suburb: 'Centro', city: 'Ciudad de Mexico', country_code: 'mx' },
  };
  let fetchSpy;
  beforeEach(() => {
    resetForTests();
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => [nominatimItem] });
  });
  afterEach(() => fetchSpy.mockRestore());

  test('devuelve el punto y los datos del lugar, con User-Agent propio y en cache', async () => {
    const h = await makeUser('host');
    const res = await request(app).get('/api/geo/search?q=Zocalo&country=MX&lang=es').set(auth(h));
    expect(res.status).toBe(200);
    expect(res.body.data.results[0]).toMatchObject({
      geo: pt(-99.1332, 19.4326), address: 'Plaza de la Constitucion 1', neighborhood: 'Centro',
      city: 'Ciudad de Mexico', country: 'MX',
    });
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/countrycodes=mx/);
    expect(url).toMatch(/accept-language=es/);
    expect(options.headers['User-Agent']).toMatch(/^ElysioExperiences\//);

    await request(app).get('/api/geo/search?q=zocalo&country=MX&lang=es').set(auth(h));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('solo para quien publica, y con una busqueda de al menos 3 letras', async () => {
    const t = await makeUser('tourist');
    expect((await request(app).get('/api/geo/search?q=Zocalo').set(auth(t))).status).toBe(403);
    expect((await request(app).get('/api/geo/search?q=Zocalo')).status).toBe(401);
    const h = await makeUser('host');
    expect((await request(app).get('/api/geo/search?q=ab').set(auth(h))).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('si Nominatim falla responde 502 sin romper', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503 });
    const h = await makeUser('host');
    const res = await request(app).get('/api/geo/search?q=Calle falsa').set(auth(h));
    expect(res.status).toBe(502);
  });
});

describe('sesion', () => {
  test('dos renovaciones seguidas dan tokens distintos y el viejo queda revocado', async () => {
    const u = await makeUser('tourist');
    const login = await request(app).post('/api/auth/login').send({ email: u.email, password: 'password123' });
    expect(login.status).toBe(200);
    const first = login.body.data.refresh_token;

    const r1 = await request(app).post('/api/auth/refresh').send({ refresh_token: first });
    expect(r1.status).toBe(200);
    const second = r1.body.data.refresh_token;
    expect(second).not.toBe(first);

    const r2 = await request(app).post('/api/auth/refresh').send({ refresh_token: second });
    expect(r2.status).toBe(200);
    expect(r2.body.data.refresh_token).not.toBe(second);

    const reused = await request(app).post('/api/auth/refresh').send({ refresh_token: first });
    expect(reused.status).toBe(401);
  });
});

describe('IP del cliente detras de Vercel', () => {
  const { clientIp } = require('../utils/clientIp');
  const fakeReq = (headers, ip = '10.0.0.9') => ({ ip, headers });
  const prev = process.env.PROXY_SECRET;
  afterAll(() => { process.env.PROXY_SECRET = prev; });

  test('con el secreto correcto usa la IP que puso Vercel, no lo que escribio el cliente', () => {
    process.env.PROXY_SECRET = 'secreto-de-prueba';
    expect(clientIp(fakeReq({ 'x-elysio-proxy': 'secreto-de-prueba', 'x-forwarded-for': '203.0.113.7, 76.76.21.1' }))).toBe('203.0.113.7');
    // Un cliente que mete su propia cabecera queda a la izquierda y se ignora.
    expect(clientIp(fakeReq({ 'x-elysio-proxy': 'secreto-de-prueba', 'x-forwarded-for': '1.1.1.1, 203.0.113.7, 76.76.21.1' }))).toBe('203.0.113.7');
  });

  test('con el secreto correcto prefiere x-elysio-client-ip del middleware de Vercel', () => {
    process.env.PROXY_SECRET = 'secreto-de-prueba';
    const xff = '1.1.1.1, 64.252.1.2, 76.76.21.1';
    expect(clientIp(fakeReq({ 'x-elysio-proxy': 'secreto-de-prueba', 'x-elysio-client-ip': '203.0.113.7', 'x-forwarded-for': xff }))).toBe('203.0.113.7');
    expect(clientIp(fakeReq({ 'x-elysio-proxy': 'secreto-de-prueba', 'x-elysio-client-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    // Un valor que no es IP se ignora y se cae a x-forwarded-for.
    expect(clientIp(fakeReq({ 'x-elysio-proxy': 'secreto-de-prueba', 'x-elysio-client-ip': 'basura', 'x-forwarded-for': xff }))).toBe('64.252.1.2');
    // Sin el secreto, la cabecera no vale nada.
    expect(clientIp(fakeReq({ 'x-elysio-proxy': 'otro', 'x-elysio-client-ip': '203.0.113.7' }))).toBe('10.0.0.9');
  });

  test('sin secreto, con uno equivocado o sin configurar usa req.ip', () => {
    process.env.PROXY_SECRET = 'secreto-de-prueba';
    expect(clientIp(fakeReq({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('10.0.0.9');
    expect(clientIp(fakeReq({ 'x-elysio-proxy': 'otro', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('10.0.0.9');
    process.env.PROXY_SECRET = '';
    expect(clientIp(fakeReq({ 'x-elysio-proxy': '', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('10.0.0.9');
  });
});

describe('pagos', () => {
  test('sin credenciales de QvaPay, crear factura da 503 con codigo y no llama afuera', async () => {
    const t = await makeUser('tourist');
    const res = await request(app).post('/api/payments/create-invoice').set(auth(t)).send({ booking_id: String(new mongoose.Types.ObjectId()) });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('qvapay_unavailable');
  });
});

describe('feedback', () => {
  test('el admin lista y responde el feedback en /api/feedback', async () => {
    const t = await makeUser('tourist');
    const sent = await request(app).post('/api/feedback').set(auth(t)).send({ message: 'Hola', category: 'other' });
    expect(sent.status).toBe(201);

    const list = await request(app).get('/api/feedback').set(auth(admin));
    expect(list.status).toBe(200);
    const item = list.body.data.feedback.find((f) => f.message === 'Hola');
    expect(item).toBeDefined();

    const reply = await request(app).post(`/api/feedback/${item._id}/respond`).set(auth(admin)).send({ response: 'Gracias' });
    expect(reply.status).toBe(200);

    const denied = await request(app).get('/api/feedback').set(auth(t));
    expect(denied.status).toBe(403);
  });

  test('un reclamo va sobre una reserva propia y el admin la ve con lo ofrecido', async () => {
    const t = await makeUser('tourist');
    const other = await makeUser('tourist');
    const booking = await Booking.create({
      tenant_id: tenant._id, property_id: property._id, tourist_id: t._id, host_id: host._id,
      check_in: new Date(day(520)), check_out: new Date(day(522)), num_nights: 2, num_guests: 1,
      booking_type: 'pre_booking', total_amount: 60, payment_option: 'full_payment',
      tourist_data: { phone: '+5355512345' }, status: 'approved',
      offer_snapshot: { services: demoServices(), amenities: ['Terraza'] },
    });

    const noBooking = await request(app).post('/api/feedback').set(auth(t))
      .send({ category: 'complaint', message: 'No habia wifi' });
    expect(noBooking.status).toBe(400);
    const notMine = await request(app).post('/api/feedback').set(auth(other))
      .send({ category: 'complaint', booking_id: String(booking._id), message: 'No habia wifi' });
    expect(notMine.status).toBe(404);

    const sent = await request(app).post('/api/feedback').set(auth(t))
      .send({ category: 'complaint', booking_id: String(booking._id), message: 'No habia wifi' });
    expect(sent.status).toBe(201);
    expect((await Feedback.findById(sent.body.data.feedback_id)).category).toBe('complaint');

    const list = await request(app).get('/api/feedback?category=complaint').set(auth(admin));
    const item = list.body.data.feedback.find((f) => f.message === 'No habia wifi');
    expect(item.booking_id.property_id.name).toBe('Casa Test');
    expect(item.booking_id.offer_snapshot.services.items).toHaveLength(10);
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
