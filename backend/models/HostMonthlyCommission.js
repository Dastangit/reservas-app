const mongoose = require('mongoose');

// Consolida en un solo registro mensual por host el 10% de comisión que debe
// por las reservas Opci\u00f3n B (pre_booking) donde el turista pag\u00f3 en efectivo
// directo al host -- ese dinero nunca pasa por la plataforma, as\u00ed que el host
// tiene que pagarle ese 10% a Dats por su cuenta. Reemplaza el seguimiento
// reserva-por-reserva (host_fee_status en Booking sigue existiendo como
// respaldo hist\u00f3rico, pero el ciclo de cobro/recordatorio ahora vive aqu\u00ed).
const hostMonthlyCommissionSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  host_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  month: {
    type: Number, // 1-12
    required: true,
  },
  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  }],
  total_amount: {
    type: Number,
    default: 0,
  },
  commission_amount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'reminded_day3', 'warned_day6', 'overdue', 'paid', 'waived'],
    default: 'pending',
  },
  // Fecha en la que cerr\u00f3 el mes (primer d\u00eda del mes siguiente) -- referencia
  // para contar los d\u00edas 3/6/10 del ciclo de cobro.
  period_closed_at: Date,
  reminder_sent_at: Date,
  warning_sent_at: Date,
  paid_at: Date,
  paid_method: String,
  notes: String,
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

hostMonthlyCommissionSchema.index({ tenant_id: 1, host_id: 1, year: 1, month: 1 }, { unique: true });
hostMonthlyCommissionSchema.index({ status: 1 });

module.exports = mongoose.model('HostMonthlyCommission', hostMonthlyCommissionSchema);
