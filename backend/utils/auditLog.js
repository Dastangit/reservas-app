const AdminActionLog = require('../models/AdminActionLog');

// Helper para registrar una acci\u00f3n admin sin que un fallo de logging rompa
// la acci\u00f3n real (ej. si esto falla, la reserva se aprueba igual -- solo se
// pierde el registro de auditor\u00eda de ESA acci\u00f3n puntual, nunca al rev\u00e9s).
async function logAdminAction({ tenant_id, admin_id, action, target_type, target_id, metadata, ip_address }) {
  try {
    await AdminActionLog.create({
      tenant_id,
      admin_id,
      action,
      target_type,
      target_id,
      metadata,
      ip_address,
    });
  } catch (error) {
    console.error('[AuditLog] No se pudo registrar la acci\u00f3n:', action, error.message);
  }
}

module.exports = { logAdminAction };
