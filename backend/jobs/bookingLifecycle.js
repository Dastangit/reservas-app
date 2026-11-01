const cron = require('node-cron');
const Booking = require('../models/Booking');
const ExperienceBooking = require('../models/ExperienceBooking');
const Review = require('../models/Review');
const { recomputePropertyRating } = require('../utils/reviews');

const DAY_MS = 24 * 60 * 60 * 1000;

// Margen tras el check-out / la excursion antes de completar automaticamente:
// deja tiempo al host u organizador para reportar un problema.
const AUTO_COMPLETE_AFTER_MS = DAY_MS;

// Resenas ciegas: si la otra parte no escribe la suya en este plazo, la que
// existe se publica igual (si no, el host podia silenciar malas resenas).
const REVIEW_REVEAL_AFTER_MS = 14 * DAY_MS;

// Antes, una reserva solo pasaba a "completed" si el host pulsaba el boton.
// Como la comision mensual y las resenas dependen de ese estado, el host que
// no lo pulsaba no pagaba comision ni recibia resenas.
const autoCompleteBookings = async () => {
  const cutoff = new Date(Date.now() - AUTO_COMPLETE_AFTER_MS);
  const result = await Booking.updateMany(
    { status: 'approved', check_out: { $lt: cutoff } },
    {
      $set: { status: 'completed' },
      $push: { status_history: { status: 'completed', changed_at: new Date(), changed_by: 'system' } },
    },
  );
  return result.modifiedCount;
};

const autoCompleteExperienceBookings = async () => {
  const candidates = await ExperienceBooking.find({ status: 'approved' })
    .populate('experience_id', 'date duration_hours')
    .select('_id experience_id');

  const now = Date.now();
  const dueIds = candidates
    .filter((b) => {
      const exp = b.experience_id;
      if (!exp?.date) return false;
      const endsAt = new Date(exp.date).getTime() + (Number(exp.duration_hours) || 0) * 60 * 60 * 1000;
      return endsAt + AUTO_COMPLETE_AFTER_MS < now;
    })
    .map((b) => b._id);

  if (dueIds.length === 0) return 0;

  const result = await ExperienceBooking.updateMany(
    { _id: { $in: dueIds }, status: 'approved' },
    {
      $set: { status: 'completed' },
      $push: { status_history: { status: 'completed', changed_at: new Date(), changed_by: 'system' } },
    },
  );
  return result.modifiedCount;
};

const revealStaleReviews = async () => {
  const cutoff = new Date(Date.now() - REVIEW_REVEAL_AFTER_MS);
  const stale = await Review.find({ status: 'submitted', submitted_at: { $lt: cutoff } }).select('_id property_id');
  if (stale.length === 0) return 0;

  await Review.updateMany(
    { _id: { $in: stale.map((r) => r._id) }, status: 'submitted' },
    { $set: { status: 'visible', revealed_at: new Date() } },
  );

  const propertyIds = [...new Set(stale.map((r) => String(r.property_id)))];
  for (const propertyId of propertyIds) {
    await recomputePropertyRating(propertyId);
  }
  return stale.length;
};

const runBookingLifecycle = async () => {
  try {
    const completed = await autoCompleteBookings();
    const completedExp = await autoCompleteExperienceBookings();
    const revealed = await revealStaleReviews();
    if (completed + completedExp + revealed > 0) {
      console.info(`[Cron] Lifecycle: ${completed} reservas y ${completedExp} reservas de excursion completadas, ${revealed} resenas publicadas`);
    }
  } catch (error) {
    console.error('[Cron] Error en booking lifecycle:', error.message);
  }
};

const startBookingLifecycleCron = () => {
  // Cada hora; los cambios son idempotentes. Corre antes del cron de comisiones (6am).
  cron.schedule('15 * * * *', runBookingLifecycle);
  console.info('[Cron] Booking lifecycle job started (hourly)');
};

module.exports = {
  startBookingLifecycleCron, runBookingLifecycle, AUTO_COMPLETE_AFTER_MS, REVIEW_REVEAL_AFTER_MS,
};
