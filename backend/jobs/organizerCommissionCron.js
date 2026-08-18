const cron = require('node-cron');
const ExperienceBooking = require('../models/ExperienceBooking');
const OrganizerMonthlyCommission = require('../models/OrganizerMonthlyCommission');
const { notifyAdmins } = require('../utils/pushNotifications');

const COMMISSION_RATE = 0.10;

// Recalcula (upsert) la comisión del mes en curso por organizador,
// desglosada por moneda -- no se puede sumar CUP + USD + USDT en un total
// único (ver plan del módulo, sección 2). Se agrupa por el mes en que
// ocurrió la excursión (experience.date), no por cuándo se completó la
// reserva.
const recomputeCommissions = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const rangeStart = new Date(year, month - 1, 1);
  const rangeEnd = new Date(year, month, 1);

  const grouped = await ExperienceBooking.aggregate([
    { $match: { status: 'completed' } },
    {
      $lookup: {
        from: 'experiences',
        localField: 'experience_id',
        foreignField: '_id',
        as: 'experience',
      },
    },
    { $unwind: '$experience' },
    { $match: { 'experience.date': { $gte: rangeStart, $lt: rangeEnd } } },
    { $unwind: '$payment_info' },
    {
      $group: {
        _id: {
          tenant_id: '$tenant_id',
          organizer_id: '$organizer_id',
          currency: '$payment_info.currency',
        },
        total_amount: { $sum: '$payment_info.amount' },
        booking_ids: { $addToSet: '$_id' },
      },
    },
  ]);

  // Reagrupa por organizador -- junta las distintas monedas en un solo totals[].
  const byOrganizer = new Map();
  for (const row of grouped) {
    const key = `${row._id.tenant_id}:${row._id.organizer_id}`;
    if (!byOrganizer.has(key)) {
      byOrganizer.set(key, {
        tenant_id: row._id.tenant_id,
        organizer_id: row._id.organizer_id,
        bookings: new Set(),
        totals: [],
      });
    }
    const g = byOrganizer.get(key);
    row.booking_ids.forEach((id) => g.bookings.add(id.toString()));
    g.totals.push({
      currency: row._id.currency,
      total_amount: row.total_amount,
      commission_amount: Math.round(row.total_amount * COMMISSION_RATE * 100) / 100,
    });
  }

  for (const g of byOrganizer.values()) {
    const existing = await OrganizerMonthlyCommission.findOne({
      tenant_id: g.tenant_id,
      organizer_id: g.organizer_id,
      year,
      month,
    });

    if (existing) {
      // Si ya está paid/waived no se toca el status ni los recordatorios,
      // solo se refrescan los montos por si aparecieron reservas nuevas.
      existing.experience_bookings = Array.from(g.bookings);
      existing.totals = g.totals;
      await existing.save();
    } else {
      await OrganizerMonthlyCommission.create({
        tenant_id: g.tenant_id,
        organizer_id: g.organizer_id,
        year,
        month,
        experience_bookings: Array.from(g.bookings),
        totals: g.totals,
        period_closed_at: rangeEnd,
      });
    }
  }
};

// Mismo ciclo de recordatorios que hostCommissionCron.js -- nunca suspende
// a nadie automáticamente, día 10+ solo llega a "overdue" para que el admin
// decida manualmente.
const advanceReminderStatus = async () => {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const openOnes = await OrganizerMonthlyCommission.find({
    status: { $in: ['pending', 'reminded_day3', 'warned_day6'] },
    period_closed_at: { $lte: now },
  });

  for (const c of openOnes) {
    const daysSinceClosed = Math.floor((now - c.period_closed_at) / dayMs);

    if (daysSinceClosed >= 10) {
      const wasOverdue = c.status === 'overdue';
      c.status = 'overdue';
      if (!wasOverdue) {
        const summary = c.totals.map((t) => `${t.commission_amount} ${t.currency}`).join(' + ');
        notifyAdmins(c.tenant_id, {
          title: 'Comisión de organizador vencida',
          body: `Una comisión de ${summary} lleva más de 10 días sin pagarse.`,
          url: '/admin/organizer-commissions',
        });
      }
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

const runOrganizerCommissionJob = async () => {
  try {
    await recomputeCommissions();
    await advanceReminderStatus();
  } catch (error) {
    console.error('[Cron] Error en organizer commission job:', error.message);
  }
};

const startOrganizerCommissionCron = () => {
  // Una vez al día alcanza -- es un ciclo mensual, no necesita más frecuencia.
  cron.schedule('0 6 * * *', runOrganizerCommissionJob);
  console.log('[Cron] Organizer commission job started (daily at 6am)');
};

module.exports = { startOrganizerCommissionCron, runOrganizerCommissionJob };
