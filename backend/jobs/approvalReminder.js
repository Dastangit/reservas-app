const cron = require('node-cron');
const Booking = require('../models/Booking');
const { notifyAdmins } = require('../utils/pushNotifications');

const DAY_MS = 24 * 60 * 60 * 1000;

// Los Terminos prometen aprobar en 24 h, pero las reservas de propiedades no
// caducan (el turista ya pago el fee). Este job avisa al admin, una vez al dia
// por reserva, de las que llevan mas de 24 h pagadas sin aprobar ni rechazar.
const remindPendingApprovals = async () => {
  try {
    const now = Date.now();
    const overdue = await Booking.find({
      status: 'pending_approval',
      fee_paid_at: { $lt: new Date(now - DAY_MS) },
      $or: [
        { approval_reminder_sent_at: { $exists: false } },
        { approval_reminder_sent_at: null },
        { approval_reminder_sent_at: { $lt: new Date(now - DAY_MS) } },
      ],
    }).select('_id tenant_id fee_paid_at');

    if (overdue.length === 0) return 0;

    // Un aviso por tenant con el total, en vez de uno por reserva.
    const byTenant = new Map();
    for (const b of overdue) {
      const key = String(b.tenant_id);
      byTenant.set(key, { tenantId: b.tenant_id, count: (byTenant.get(key)?.count || 0) + 1 });
    }
    for (const { tenantId, count } of byTenant.values()) {
      notifyAdmins(tenantId, {
        title: 'Reservas pagadas sin aprobar',
        body: `${count} reserva(s) llevan mas de 24 h esperando aprobacion (los Terminos prometen 24 h).`,
        url: '/admin/bookings',
      });
    }

    await Booking.updateMany(
      { _id: { $in: overdue.map((b) => b._id) } },
      { $set: { approval_reminder_sent_at: new Date() } },
    );
    return overdue.length;
  } catch (error) {
    console.error('[Cron] Error en recordatorio de aprobaciones:', error.message);
    return 0;
  }
};

const startApprovalReminderCron = () => {
  cron.schedule('30 * * * *', remindPendingApprovals);
  console.log('[Cron] Approval reminder job started (hourly)');
};

module.exports = { startApprovalReminderCron, remindPendingApprovals };
