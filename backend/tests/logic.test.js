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

  test('descarta public_id de la carpeta de otro usuario', () => {
    const [img] = sanitizeImages(
      [{ url: 'https://res.cloudinary.com/x/a.jpg', public_id: 'reservas-app/uploads/otro/a' }],
      user,
    );
    expect(img.public_id).toBeUndefined();
  });

  test('conserva public_id propio o ya existente en el documento', () => {
    const images = sanitizeImages([
      { url: 'https://x/a.jpg', public_id: 'reservas-app/uploads/u1/a' },
      { url: 'https://x/b.jpg', public_id: 'reservas-app/properties/legacy' },
    ], user, [{ public_id: 'reservas-app/properties/legacy' }]);
    expect(images.map((i) => i.public_id)).toEqual(['reservas-app/uploads/u1/a', 'reservas-app/properties/legacy']);
  });

  test('descarta URLs que no son http(s)', () => {
    expect(sanitizeImages([{ url: 'javascript:alert(1)' }], user)).toEqual([]);
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
