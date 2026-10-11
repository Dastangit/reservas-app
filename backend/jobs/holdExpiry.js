const cron = require('node-cron');
const Booking = require('../models/Booking');
const Experience = require('../models/Experience');
const ExperienceBooking = require('../models/ExperienceBooking');
const ExperienceWaitlist = require('../models/ExperienceWaitlist');
const { promoteNextWaitlistEntry } = require('../utils/experienceWaitlist');
const { findTransactionsByRemoteIds } = require('../utils/qvapay');
const { settleQvaPayTransaction } = require('../utils/qvapaySettlement');
const { notifyAdmins } = require('../utils/pushNotifications');

// Si el turista ya aviso "Ya pague" por PayPal, la reserva NO se cancela al
// vencer el hold de 3 h: el admin tiene este margen extra para revisar la
// cuenta y confirmar. Cancelarla antes dejaba dinero cobrado sin reserva.
const MANUAL_REVIEW_GRACE_MS = 72 * 60 * 60 * 1000;

const cancelPendingBooking = (bookingId) => Booking.updateOne(
  { _id: bookingId, status: 'pending_payment' },
  {
    $set: { status: 'cancelled', payment_stage: 'expired' },
    $push: { status_history: { status: 'cancelled', changed_at: new Date(), changed_by: 'system' } },
  },
);

const expireHolds = async () => {
  try {
    const now = new Date();
    const expired = await Booking.find({
      status: 'pending_payment',
      hold_expires_at: { $lt: now },
    }).select('_id tenant_id payment_method payment_needs_review hold_expires_at fee_amount fee_paid status');

    if (expired.length === 0) return;

    // Antes de cancelar una reserva de QvaPay se consulta si en realidad se
    // pago (el webhook pudo no llegar). Una sola consulta para todo el lote.
    const qvapayIds = expired.filter((b) => b.payment_method === 'qvapay').map((b) => String(b._id));
    let transactions = new Map();
    if (qvapayIds.length > 0) {
      try {
        transactions = await findTransactionsByRemoteIds(qvapayIds);
      } catch (error) {
        // Sin confirmacion de QvaPay no se cancela nada de QvaPay en esta pasada.
        console.error('[Cron] No se pudo consultar QvaPay antes de expirar holds:', error.message);
        transactions = null;
      }
    }

    let cancelled = 0;
    for (const booking of expired) {
      if (booking.payment_method === 'paypal_manual' && booking.payment_needs_review) {
        if (now - booking.hold_expires_at < MANUAL_REVIEW_GRACE_MS) continue;
        const result = await cancelPendingBooking(booking._id);
        if (result.modifiedCount === 1) {
          cancelled += 1;
          notifyAdmins(booking.tenant_id, {
            title: 'Pago PayPal sin confirmar: reserva cancelada',
            body: `Reserva ${String(booking._id).slice(-6)} se cancelo tras 72 h sin confirmar el pago manual. Si el dinero llego, reembolsa.`,
            url: '/admin/bookings',
          });
        }
        continue;
      }

      if (booking.payment_method === 'qvapay') {
        if (transactions === null) continue;
        const transaction = transactions.get(String(booking._id));
        if (transaction) {
          const outcome = await settleQvaPayTransaction(booking, transaction);
          if (outcome === 'paid' || outcome === 'failed') continue;
          // Transaccion aun en curso: se le da hasta 24 h extra antes de cancelar.
          if (outcome === 'pending' && now - booking.hold_expires_at < 24 * 60 * 60 * 1000) continue;
        }
      }

      const result = await cancelPendingBooking(booking._id);
      cancelled += result.modifiedCount;
    }

    if (cancelled > 0) {
      console.log(`[Cron] Expired ${cancelled} holds`);
    }
  } catch (error) {
    console.error('[Cron] Error expiring holds:', error.message);
  }
};

// Vence las reservas de excursion que el admin no aprobo dentro de las 24h.
// NO es un plazo de pago -- no hay fee de plataforma de por medio (se
// decidio no cobrar dos veces al cliente, ver plan del modulo secc. 2).
// Libera los cupos y promueve al siguiente en la lista de espera si aplica.
const expireExperienceHolds = async () => {
  try {
    const expired = await ExperienceBooking.find({
      status: 'pending_approval',
      hold_expires_at: { $lt: new Date() },
    }).select('_id tenant_id experience_id num_spots');

    let count = 0;
    for (const booking of expired) {
      // Atomico: si el admin la aprobo/rechazo en el mismo instante, no se
      // liberan los cupos dos veces.
      const result = await ExperienceBooking.updateOne(
        { _id: booking._id, status: 'pending_approval' },
        {
          $set: { status: 'expired' },
          $push: { status_history: { status: 'expired', changed_at: new Date(), changed_by: 'system' } },
        },
      );
      if (result.modifiedCount !== 1) continue;
      count += 1;

      await Experience.updateOne(
        { _id: booking.experience_id, tenant_id: booking.tenant_id },
        { $inc: { current_participants: -booking.num_spots } },
      );

      await promoteNextWaitlistEntry(booking.tenant_id, booking.experience_id);
    }

    if (count > 0) {
      console.log(`[Cron] Expired ${count} experience booking holds`);
    }
  } catch (error) {
    console.error('[Cron] Error expiring experience holds:', error.message);
  }
};

// Vence los reclamos de lista de espera que no se confirmaron dentro de su
// ventana (ver computeClaimWindowMs), libera el cupo reservado y promueve
// al siguiente en la fila.
const expireWaitlistClaims = async () => {
  try {
    const expired = await ExperienceWaitlist.find({
      status: 'notified',
      claim_expires_at: { $lt: new Date() },
    }).select('_id tenant_id experience_id num_spots_requested');

    let count = 0;
    for (const entry of expired) {
      const result = await ExperienceWaitlist.updateOne(
        { _id: entry._id, status: 'notified' },
        { $set: { status: 'expired' } },
      );
      if (result.modifiedCount !== 1) continue;
      count += 1;

      await Experience.updateOne(
        { _id: entry.experience_id, tenant_id: entry.tenant_id },
        { $inc: { current_participants: -entry.num_spots_requested } },
      );

      await promoteNextWaitlistEntry(entry.tenant_id, entry.experience_id);
    }

    if (count > 0) {
      console.log(`[Cron] Expired ${count} waitlist claims`);
    }
  } catch (error) {
    console.error('[Cron] Error expiring waitlist claims:', error.message);
  }
};

const runHoldExpiry = async () => {
  await expireHolds();
  await expireExperienceHolds();
  await expireWaitlistClaims();
};

const startHoldExpiryCron = () => {
  cron.schedule('*/5 * * * *', runHoldExpiry);
  console.log('[Cron] Hold expiry job started (every 5 minutes)');
};

module.exports = { startHoldExpiryCron, runHoldExpiry, MANUAL_REVIEW_GRACE_MS };
