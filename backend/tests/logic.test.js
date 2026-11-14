// Tests de comportamiento (sin base de datos): los modelos se simulan con
// jest.spyOn sobre sus metodos estaticos.
jest.mock('../utils/pushNotifications', () => ({ notifyAdmins: jest.fn() }));

const Booking = require('../models/Booking');
const Experience = require('../models/Experience');
const OrphanedPayment = require('../models/OrphanedPayment');
const { parseLocalDateTime } = require('../utils/timezone');
const { sanitizeImages } = require('../utils/images');
const { parsePagination } = require('../utils/helpers');
const { generateOccurrences } = require('../utils/experienceRecurrence');
const { settleQvaPayTransaction } = require('../utils/qvapaySettlement');
const validate = require('../middleware/validate');
const errorHandler = require('../middleware/errorHandler');
const { normalizeServices, offerChanges, removedAmenities } = require('../utils/propertyServices');
const { demoServices } = require('../scripts/demoServices');

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('timezone de excursiones (America/Havana)', () => {
  test('09:00 en octubre (UTC-4) se guarda como 13:00Z', () => {
    expect(parseLocalDateTime('2026-10-20T09:00').toISOString()).toBe('2026-10-20T13:00:00.000Z');
  });

  test('09:00 en diciembre (UTC-5) se guarda como 14:00Z', () => {
    expect(parseLocalDateTime('2026-12-20T09:00').toISOString()).toBe('2026-12-20T14:00:00.000Z');
  });

  test('respeta un valor que ya trae zona horaria', () => {
    expect(parseLocalDateTime('2026-12-20T09:00:00Z').toISOString()).toBe('2026-12-20T09:00:00.000Z');
  });
});

describe('sanitizeImages', () => {
  const user = 'u1';
  const cdn = (file) => `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || 'x'}/${file}`;

  test('descarta public_id de la carpeta de otro usuario', () => {
    const [img] = sanitizeImages(
      [{ url: cdn('a.jpg'), public_id: 'reservas-app/uploads/otro/a' }],
      user,
    );
    expect(img.public_id).toBeUndefined();
  });

  test('conserva public_id propio o ya existente en el documento', () => {
    const images = sanitizeImages([
      { url: cdn('a.jpg'), public_id: 'reservas-app/uploads/u1/a' },
      { url: cdn('b.jpg'), public_id: 'reservas-app/properties/legacy' },
    ], user, [{ public_id: 'reservas-app/properties/legacy' }]);
    expect(images.map((i) => i.public_id)).toEqual(['reservas-app/uploads/u1/a', 'reservas-app/properties/legacy']);
  });

  test('descarta URLs que no son http(s)', () => {
    expect(sanitizeImages([{ url: 'javascript:alert(1)' }], user)).toEqual([]);
  });

  test('solo acepta fotos nuevas de Cloudinary; las que ya estaban se conservan', () => {
    const images = sanitizeImages([
      { url: 'https://tracker.example/foto.jpg' },
      { url: 'http://res.cloudinary.com/x/a.jpg' },
      { url: 'https://images.unsplash.com/antigua.jpg' },
      { url: cdn('nueva.jpg') },
    ], user, [{ url: 'https://images.unsplash.com/antigua.jpg' }]);
    expect(images.map((i) => i.url)).toEqual(['https://images.unsplash.com/antigua.jpg', cdn('nueva.jpg')]);
  });
});

describe('parsePagination', () => {
  test('acota limit y page', () => {
    expect(parsePagination({ page: '-3', limit: '0' })).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(parsePagination({ page: '2', limit: '100000' }, { maxLimit: 50 })).toEqual({ page: 2, limit: 50, skip: 50 });
  });
});

describe('middlewares', () => {
  test('errorHandler no expone el mensaje de un 500 en produccion', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    errorHandler(new Error('connection string mongodb://secret'), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Server Error' });
    process.env.NODE_ENV = prev;
  });

  test('validate devuelve `error` legible ademas de `errors`', async () => {
    const { body } = require('express-validator');
    const req = { body: { email: 'no-es-email' } };
    await body('email').isEmail().withMessage('Valid email is required').run(req);
    const res = mockRes();
    validate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toBe('Valid email is required');
  });
});

describe('generateOccurrences', () => {
  test('genera en hora de Cuba, respeta end_date inclusiva y limita el horizonte', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-11T12:00:00Z'));
    jest.spyOn(Experience, 'findOne').mockResolvedValue(null);
    const created = [];
    jest.spyOn(Experience, 'create').mockImplementation(async (doc) => { created.push(doc.date.toISOString()); });

    const count = await generateOccurrences({
      _id: 'r1',
      status: 'active',
      generate_horizon_days: 100000,
      recurrence: {
        days_of_week: [1], // lunes
        time_of_day: '09:00',
        start_date: new Date('2026-10-01'),
        end_date: new Date('2026-11-30'),
      },
    });

    jest.useRealTimers();
    expect(created[0]).toBe('2026-10-12T13:00:00.000Z');
    expect(created[created.length - 1]).toBe('2026-11-30T14:00:00.000Z');
    expect(count).toBe(8);
  });
});

describe('settleQvaPayTransaction', () => {
  const booking = { _id: 'b1', tenant_id: 't1', status: 'pending_payment', fee_amount: 7, fee_paid: false };

  test('un pago confirmado pasa la reserva a pending_approval', async () => {
    const update = jest.spyOn(Booking, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    const outcome = await settleQvaPayTransaction({ ...booking, _id: { toString: () => 'abcdef123456' } }, { status: 'paid', amount: 7 });
    expect(outcome).toBe('paid');
    expect(update.mock.calls[0][1].$set.status).toBe('pending_approval');
  });

  test('un fallo guarda payment_stage valido para el enum', async () => {
    const update = jest.spyOn(Booking, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    await settleQvaPayTransaction(booking, { status: 'canceled' });
    expect(update.mock.calls[0][1].$set.payment_stage).toBe('failed');
  });

  test('pago que llega con la reserva ya cerrada se registra como huerfano', async () => {
    jest.spyOn(OrphanedPayment, 'findOne').mockResolvedValue(null);
    const create = jest.spyOn(OrphanedPayment, 'create').mockResolvedValue({});
    const outcome = await settleQvaPayTransaction(
      { ...booking, status: 'cancelled', _id: { toString: () => 'abcdef123456' } },
      { status: 'paid', amount: 7 },
    );
    expect(outcome).toBe('orphaned');
    expect(create.mock.calls[0][0].reason).toBe('booking_not_pending');
  });

  test('con la factura correcta y el monto completo, confirma', async () => {
    const update = jest.spyOn(Booking, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    const outcome = await settleQvaPayTransaction(
      { ...booking, invoice_id: 'inv-1', _id: { toString: () => 'abcdef123456' } },
      { status: 'paid', amount: 7, transaction_uuid: 'inv-1' },
    );
    expect(outcome).toBe('paid');
    expect(update.mock.calls[0][1].$set.status).toBe('pending_approval');
  });

  test.each([
    ['otro movimiento con el mismo remote_id', { transaction_uuid: 'otra', amount: 7 }, 'invoice_mismatch'],
    ['la factura, pero por menos del fee', { transaction_uuid: 'inv-1', amount: 1 }, 'amount_mismatch'],
  ])('%s: no confirma, queda para revisar', async (_label, tx, reason) => {
    jest.spyOn(OrphanedPayment, 'findOne').mockResolvedValue(null);
    const create = jest.spyOn(OrphanedPayment, 'create').mockResolvedValue({});
    const update = jest.spyOn(Booking, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    const outcome = await settleQvaPayTransaction(
      { ...booking, invoice_id: 'inv-1', _id: { toString: () => 'abcdef123456' } },
      { status: 'paid', ...tx },
    );
    expect(outcome).toBe('review');
    expect(update.mock.calls).toHaveLength(1);
    expect(update.mock.calls[0][1].$set).toEqual(expect.objectContaining({ payment_needs_review: true }));
    expect(update.mock.calls[0][1].$set.status).toBeUndefined();
    expect(create.mock.calls[0][0].reason).toBe(reason);
  });
});

describe('holdExpiry', () => {
  test('no cancela una reserva PayPal con "Ya pague" dentro del margen de revision', async () => {
    const { runHoldExpiry } = require('../jobs/holdExpiry');
    const ExperienceBooking = require('../models/ExperienceBooking');
    const ExperienceWaitlist = require('../models/ExperienceWaitlist');

    const selectable = (value) => ({ select: () => Promise.resolve(value) });
    jest.spyOn(Booking, 'find').mockReturnValue(selectable([
      {
        _id: 'paypal1', payment_method: 'paypal_manual', payment_needs_review: true,
        hold_expires_at: new Date(Date.now() - 60 * 60 * 1000),
      },
      { _id: 'plain1', payment_method: undefined, hold_expires_at: new Date(Date.now() - 60 * 1000) },
    ]));
    jest.spyOn(ExperienceBooking, 'find').mockReturnValue(selectable([]));
    jest.spyOn(ExperienceWaitlist, 'find').mockReturnValue(selectable([]));
    const update = jest.spyOn(Booking, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(console, 'log').mockImplementation(() => {});

    await runHoldExpiry();

    const cancelledIds = update.mock.calls.map((call) => call[0]._id);
    expect(cancelledIds).toEqual(['plain1']);
  });

  test('el margen de revision es de 24 h y vale tambien para QvaPay por revisar', async () => {
    const { runHoldExpiry } = require('../jobs/holdExpiry');
    const ExperienceBooking = require('../models/ExperienceBooking');
    const ExperienceWaitlist = require('../models/ExperienceWaitlist');

    const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000);
    const selectable = (value) => ({ select: () => Promise.resolve(value) });
    jest.spyOn(Booking, 'find').mockReturnValue(selectable([
      { _id: 'paypalOld', payment_method: 'paypal_manual', payment_needs_review: true, hold_expires_at: hoursAgo(25) },
      { _id: 'qvapayReview', payment_method: 'qvapay', payment_needs_review: true, hold_expires_at: hoursAgo(5) },
    ]));
    jest.spyOn(ExperienceBooking, 'find').mockReturnValue(selectable([]));
    jest.spyOn(ExperienceWaitlist, 'find').mockReturnValue(selectable([]));
    const update = jest.spyOn(Booking, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(console, 'info').mockImplementation(() => {});

    await runHoldExpiry();

    expect(update.mock.calls.map((call) => call[0]._id)).toEqual(['paypalOld']);
  });
});

describe('approvalReminder', () => {
  test('avisa una vez por tenant y marca las reservas avisadas', async () => {
    const { remindPendingApprovals } = require('../jobs/approvalReminder');
    const { notifyAdmins } = require('../utils/pushNotifications');
    notifyAdmins.mockClear();
    jest.spyOn(Booking, 'find').mockReturnValue({
      select: () => Promise.resolve([
        { _id: 'a', tenant_id: 't1' }, { _id: 'b', tenant_id: 't1' }, { _id: 'c', tenant_id: 't2' },
      ]),
    });
    const updateMany = jest.spyOn(Booking, 'updateMany').mockResolvedValue({ modifiedCount: 3 });

    const count = await remindPendingApprovals();

    expect(count).toBe(3);
    expect(notifyAdmins).toHaveBeenCalledTimes(2);
    expect(updateMany.mock.calls[0][0]._id.$in).toEqual(['a', 'b', 'c']);
  });
});

describe('servicios declarados por el anfitrion', () => {
  const norm = (input) => normalizeServices(input).value;

  test('exige contestar todo, aunque sea "no tiene"', () => {
    expect(normalizeServices(undefined).error).toBeDefined();
    const missing = demoServices();
    missing.items = missing.items.filter((i) => i.key !== 'wifi');
    expect(normalizeServices(missing).error).toMatch(/wifi/);
    expect(normalizeServices(demoServices({ air_conditioning: { available: 'si' } })).error).toMatch(/Air conditioning/);
    expect(normalizeServices(demoServices({
      house_rules: { quiet_hours: { enabled: true, from: '23:00' }, lights_out: { enabled: false } },
    })).error).toMatch(/Quiet hours/);
  });

  test('con A/C, el respaldo debe decir si lo mantiene encendido', () => {
    const energy = { kind: 'generator', schedule: { mode: 'always' } };
    expect(normalizeServices(demoServices({ energy_backup: energy })).error).toMatch(/air conditioning/);
    const noAc = demoServices({ energy_backup: energy, air_conditioning: { available: false } });
    expect(normalizeServices(noAc).value.energy_backup.powers_ac).toBeUndefined();
  });

  test('normaliza: orden fijo, sin claves extra y notas acotadas', () => {
    const input = demoServices();
    input.items.reverse();
    input.items[0].note = 'x'.repeat(500);
    input.extra = 'ignorado';
    const { value } = normalizeServices(input);
    expect(value.items[0].key).toBe('wifi');
    expect(value.items.find((i) => i.key === 'city_guide').note).toHaveLength(200);
    expect(value.extra).toBeUndefined();
  });

  test('las mejoras no se avisan; quitar, cobrar aparte o recortar si', () => {
    const before = norm(demoServices());
    const better = norm(demoServices({
      items: { laundry: 'included', kitchen: 'included' },
      house_rules: { quiet_hours: { enabled: false }, lights_out: { enabled: false } },
    }));
    expect(offerChanges(before, better)).toEqual([]);

    const worse = norm(demoServices({
      items: { wifi: 'extra_cost' },
      air_conditioning: { available: true, schedule: { mode: 'hours', from: '22:00', to: '06:00' } },
      energy_backup: { kind: 'none' },
      house_rules: { quiet_hours: { enabled: true, from: '23:00', to: '07:00' }, lights_out: { enabled: true, at: '23:30' } },
    }));
    expect(offerChanges(before, worse)).toEqual(['energy_backup', 'air_conditioning', 'items.wifi', 'house_rules.lights_out']);

    const noteOnly = demoServices();
    noteOnly.items[0].note = 'Solo en la sala';
    expect(offerChanges(before, norm(noteOnly))).toEqual(['items.wifi']);
  });

  test('quitar un servicio de la lista libre cuenta, cambiar mayusculas no', () => {
    expect(removedAmenities(['Piscina', 'Terraza'], ['piscina '])).toEqual(['Terraza']);
    expect(removedAmenities(['Piscina'], ['PISCINA', 'Jardin'])).toEqual([]);
  });
});
