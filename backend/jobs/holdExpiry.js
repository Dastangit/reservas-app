const cron = require('node-cron');
const Booking = require('../models/Booking');

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

const startHoldExpiryCron = () => {
  cron.schedule('*/5 * * * *', expireHolds);
  console.log('[Cron] Hold expiry job started (every 5 minutes)');
};

module.exports = { startHoldExpiryCron };
