const mongoose = require('mongoose');

// Guarda la suscripci\u00f3n de Web Push de cada dispositivo del admin (puede
// tener varias -- tel\u00e9fono, laptop, etc). El objeto {endpoint, keys} es
// exactamente lo que devuelve pushManager.subscribe() en el navegador.
const pushSubscriptionSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  endpoint: {
    type: String,
    required: true,
    unique: true,
  },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
});

pushSubscriptionSchema.index({ user_id: 1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
