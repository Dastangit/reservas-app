const mongoose = require('mongoose');

// Registro inmutable de acciones sensibles del admin -- quién hizo qué,
// sobre qué recurso, y cuándo. No reemplaza status_history (que vive en cada
// documento), sino que da una vista cronológica única de todas las acciones
// administrativas juntas, útil para auditorías o disputas.
const adminActionLogSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
  },
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  target_type: String, // 'Booking', 'Property', 'User', 'HostMonthlyCommission', etc.
  target_id: mongoose.Schema.Types.ObjectId,
  metadata: mongoose.Schema.Types.Mixed,
  ip_address: String,
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
});

adminActionLogSchema.index({ tenant_id: 1, created_at: -1 });
adminActionLogSchema.index({ admin_id: 1, created_at: -1 });
adminActionLogSchema.index({ target_type: 1, target_id: 1 });

module.exports = mongoose.model('AdminActionLog', adminActionLogSchema);
