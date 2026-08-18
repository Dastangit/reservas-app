const mongoose = require('mongoose');

// Calcado de HostMonthlyCommission.js, pero con desglose por moneda -- no
// se puede sumar CUP + USD + USDT en un solo total_amount. Cada comisión
// se paga en la misma moneda en que el organizador cobró al cliente (sin
// conversión de FX).
const organizerMonthlyCommissionSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  organizer_id: {
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
  experience_bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExperienceBooking',
  }],
  totals: [{
    currency: {
      type: String,
      enum: ['CUP', 'USD', 'USDT'],
      required: true,
    },
    total_amount: {
      type: Number,
      default: 0,
    },
    commission_amount: {
      type: Number, // 10% de total_amount, misma moneda
      default: 0,
    },
  }],
  status: {
    type: String,
    enum: ['pending', 'reminded_day3', 'warned_day6', 'overdue', 'paid', 'waived'],
    default: 'pending',
  },
  period_closed_at: Date,
  reminder_sent_at: Date,
  warning_sent_at: Date,
  paid_at: Date,
  paid_method: String,
  notes: String,
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

organizerMonthlyCommissionSchema.index({ tenant_id: 1, organizer_id: 1, year: 1, month: 1 }, { unique: true });
organizerMonthlyCommissionSchema.index({ status: 1 });

module.exports = mongoose.model('OrganizerMonthlyCommission', organizerMonthlyCommissionSchema);
