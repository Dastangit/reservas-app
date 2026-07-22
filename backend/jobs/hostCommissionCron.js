const cron = require('node-cron');
const Booking = require('../models/Booking');
const HostMonthlyCommission = require('../models/HostMonthlyCommission');

// Recalcula (upsert) la comisi\u00f3n del mes en curso por host, sumando las
// reservas Opci\u00f3n B (pre_booking) ya completadas. Solo el mes actual -- no
// hace falta reconstruir historial viejo, el objetivo es poder cobrarle al
// host lo que va acumulando este mes.
const recomputeCommissions = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const rangeStart = new Date(year, month - 1, 1);
  const rangeEnd = new Date(year, month, 1);

  const grouped = await Booking.aggregate([
    {
      $match: {
        booking_type: 'pre_booking',
        status: 'completed',
        check_out: { $gte: rangeStart, $lt: rangeEnd },
      },
    },
    {
      $group: {
        _id: { tenant_id: '$tenant_id', host_id: '$host_id' },
        bookings: { $push: '$_id' },
        total_amount: { $sum: '$total_amount' },
      },
    },
  ]);

  for (const g of grouped) {
    const commission_amount = Math.round(g.total_amount * 0.10 * 100) / 100;

    const existing = await HostMonthlyCommission.findOne({
      tenant_id: g._id.tenant_id,
      host_id: g._id.host_id,
      year,
      month,
    });

    if (existing) {
      // Si ya est\u00e1 paid/waived no se toca el status ni los recordatorios,
      // solo se refrescan los montos por si aparecieron reservas nuevas.
      existing.bookings = g.bookings;
      existing.total_amount = g.total_amount;
      existing.commission_amount = commission_amount;
      await existing.save();
    } else {
      await HostMonthlyCommission.create({
        tenant_id: g._id.tenant_id,
        host_id: g._id.host_id,
        year,
        month,
        bookings: g.bookings,
        total_amount: g.total_amount,
        commission_amount,
        period_closed_at: rangeEnd,
      });
    }
  }
};

// Avanza el status de las comisiones de meses ya cerrados seg\u00fan d\u00edas
// transcurridos desde el cierre del mes. IMPORTANTE: nunca suspende a nadie
// autom\u00e1ticamente -- d\u00eda 10+ solo llega a "overdue" para que el admin decida
// manualmente (bot\u00f3n en el panel), tal como se acord\u00f3.
const advanceReminderStatus = async () => {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const openOnes = await HostMonthlyCommission.find({
    status: { $in: ['pending', 'reminded_day3', 'warned_day6'] },
    period_closed_at: { $lte: now },
  });

  for (const c of openOnes) {
    const daysSinceClosed = Math.floor((now - c.period_closed_at) / dayMs);

    if (daysSinceClosed >= 10) {
      c.status = 'overdue';
    } else if (daysSinceClosed >= 6 && c.status !== 'warned_day6') {
      c.status = 'warned_day6';
      c.warning_sent_at = now;
    } else if (daysSinceClosed >= 3 && c.status === 'pending') {
      c.status = 'reminded_day3';
      c.reminder_sent_at = now;
    }

    if (c.isModified()) {
      await c.save();
    }
  }
};

const runHostCommissionJob = async () => {
  try {
    await recomputeCommissions();
    await advanceReminderStatus();
  } catch (error) {
    console.error('[Cron] Error en host commission job:', error.message);
  }
};

const startHostCommissionCron = () => {
  // Una vez al d\u00eda alcanza -- es un ciclo mensual, no necesita m\u00e1s frecuencia.
  cron.schedule('0 6 * * *', runHostCommissionJob);
  console.log('[Cron] Host commission job started (daily at 6am)');
};

module.exports = { startHostCommissionCron, runHostCommissionJob };
