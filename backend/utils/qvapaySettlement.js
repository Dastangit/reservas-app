const OrphanedPayment = require('../models/OrphanedPayment');
const Booking = require('../models/Booking');
const { notifyAdmins } = require('./pushNotifications');

// TODO: confirmar el string exacto de "pagado" con una transaccion real de
// QvaPay (ver nota historica en webhookController). Mientras tanto se aceptan
// los valores habituales.
const PAID_STATUSES = ['paid', 'completed', 'success', 'complete'];
const FAILED_STATUSES = ['cancelled', 'canceled', 'expired', 'failed'];

// QvaPay podria reportar el monto neto (tras sus comisiones), asi que solo se
// marca cuando es claramente menor al fee esperado.
const AMOUNT_TOLERANCE = 0.9;

const classifyQvaPayStatus = (status) => ({
  isPaid: PAID_STATUSES.includes(status),
  isFailed: FAILED_STATUSES.includes(status),
});

const transactionUuid = (transaction) => String(transaction.transaction_uuid || transaction.uuid || '');

// Registra un pago que el admin debe revisar a mano. Es idempotente por
// (order_id, reason): los reintentos del webhook no crean registros repetidos.
async function recordOrphanedPayment(transaction, orderId, reason, tenantId, body) {
  const existing = await OrphanedPayment.findOne({ order_id: String(orderId), reason });
  if (existing) return false;

  await OrphanedPayment.create({
    tenant_id: tenantId || undefined,
    invoice_id: transactionUuid(transaction),
    order_id: String(orderId),
    payment_status: transaction.status,
    price_amount: transaction.amount,
    price_currency: 'USD',
    reason,
    raw_payload: transaction,
  });

  notifyAdmins(tenantId || null, {
    title: 'Pago que requiere revision',
    body,
    url: '/admin/orphaned-payments',
  });
  return true;
}

// Aplica el resultado de una transaccion de QvaPay (ya re-consultada con
// nuestras credenciales) a una reserva. Lo usan el webhook y el cron de
// expiracion. Los cambios de estado son atomicos (filtro por status), asi que
// si ambos coinciden solo uno actua. Devuelve: 'paid' | 'failed' | 'pending' |
// 'orphaned' | 'noop'.
async function settleQvaPayTransaction(booking, transaction) {
  const { isPaid, isFailed } = classifyQvaPayStatus(transaction.status);
  const tenantId = booking.tenant_id;

  if (isPaid && booking.status === 'pending_payment') {
    const result = await Booking.updateOne(
      { _id: booking._id, status: 'pending_payment' },
      {
        $set: {
          status: 'pending_approval',
          payment_stage: 'paid',
          fee_paid: true,
          fee_paid_at: new Date(),
          fee_transaction_id: transactionUuid(transaction),
        },
        $push: { status_history: { status: 'pending_approval', changed_at: new Date(), changed_by: 'system' } },
      },
    );
    if (result.modifiedCount !== 1) return 'noop';

    notifyAdmins(tenantId, {
      title: 'Nueva reserva pendiente de aprobacion',
      body: `Reserva ${booking._id.toString().slice(-6)} pagada, lista para revisar.`,
      url: '/admin/bookings',
    });

    const paidAmount = Number(transaction.amount);
    if (Number.isFinite(paidAmount) && paidAmount < booking.fee_amount * AMOUNT_TOLERANCE) {
      await recordOrphanedPayment(
        transaction, booking._id, 'amount_mismatch', tenantId,
        `Reserva ${booking._id.toString().slice(-6)}: QvaPay reporta ${paidAmount} y el fee es ${booking.fee_amount}.`,
      );
    }
    return 'paid';
  }

  if (isFailed && booking.status === 'pending_payment') {
    const result = await Booking.updateOne(
      { _id: booking._id, status: 'pending_payment' },
      {
        // payment_stage tiene un enum propio: cualquier fallo de QvaPay se guarda como 'failed'.
        $set: { status: 'cancelled', payment_stage: 'failed' },
        $push: { status_history: { status: 'cancelled', changed_at: new Date(), changed_by: 'system' } },
      },
    );
    return result.modifiedCount === 1 ? 'failed' : 'noop';
  }

  // Llego un pago pero la reserva ya no esta esperando pago (se cancelo, vencio
  // o se rechazo) y su fee nunca se registro como pagado: el dinero esta en
  // QvaPay sin reserva. Hay que avisar al admin para reembolsar o resolver.
  if (isPaid && !booking.fee_paid) {
    const created = await recordOrphanedPayment(
      transaction, booking._id, 'booking_not_pending', tenantId,
      `Reserva ${booking._id.toString().slice(-6)} esta ${booking.status} pero QvaPay recibio el pago del fee.`,
    );
    return created ? 'orphaned' : 'noop';
  }

  if (!isPaid && !isFailed && booking.status === 'pending_payment') {
    await Booking.updateOne({ _id: booking._id, status: 'pending_payment' }, { $set: { payment_stage: 'pending' } });
    return 'pending';
  }

  return 'noop';
}

module.exports = { classifyQvaPayStatus, recordOrphanedPayment, settleQvaPayTransaction };
