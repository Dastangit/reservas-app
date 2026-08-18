const cron = require('node-cron');
const Booking = require('../models/Booking');
const Experience = require('../models/Experience');
const ExperienceBooking = require('../models/ExperienceBooking');
const ExperienceWaitlist = require('../models/ExperienceWaitlist');
const { promoteNextWaitlistEntry } = require('../utils/experienceWaitlist');

const expireHolds = async () => {
  try {
    const result = await Booking.updateMany(
      {
        status: 'pending_payment',
        hold_expires_at: { $lt: new Date() },
      },
      {
        $set: { status: 'cancelled' },
        $push: {
          status_history: {
            status: 'cancelled',
            changed_at: new Date(),
            changed_by: 'system',
          },
        },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[Cron] Expired ${result.modifiedCount} holds`);
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
    });

    for (const booking of expired) {
      booking.status = 'expired';
      booking.status_history.push({ status: 'expired', changed_at: new Date(), changed_by: 'system' });
      await booking.save();

      await Experience.findOneAndUpdate(
        { _id: booking.experience_id, tenant_id: booking.tenant_id },
        { $inc: { current_participants: -booking.num_spots } }
      );

      await promoteNextWaitlistEntry(booking.tenant_id, booking.experience_id);
    }

    if (expired.length > 0) {
      console.log(`[Cron] Expired ${expired.length} experience booking holds`);
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
    });

    for (const entry of expired) {
      entry.status = 'expired';
      await entry.save();

      await Experience.findOneAndUpdate(
        { _id: entry.experience_id, tenant_id: entry.tenant_id },
        { $inc: { current_participants: -entry.num_spots_requested } }
      );

      await promoteNextWaitlistEntry(entry.tenant_id, entry.experience_id);
    }

    if (expired.length > 0) {
      console.log(`[Cron] Expired ${expired.length} waitlist claims`);
    }
  } catch (error) {
    console.error('[Cron] Error expiring waitlist claims:', error.message);
  }
};

const startHoldExpiryCron = () => {
  cron.schedule('*/5 * * * *', async () => {
    await expireHolds();
    await expireExperienceHolds();
    await expireWaitlistClaims();
  });
  console.log('[Cron] Hold expiry job started (every 5 minutes)');
};

module.exports = { startHoldExpiryCron };
