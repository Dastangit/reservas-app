const webpush = require('web-push');
const env = require('../config/env');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

if (env.vapid.publicKey && env.vapid.privateKey) {
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
}

// Le manda una notificaci\u00f3n push a TODOS los admins del tenant, en todos sus
// dispositivos suscritos. Se usa para los 5 eventos que requieren acci\u00f3n:
// reserva nueva, propiedad nueva, reset de contrase\u00f1a, pago hu\u00e9rfano,
// comisi\u00f3n vencida. Nunca debe romper el flujo principal si falla -- por eso
// no se usa await en los call sites, y aqu\u00ed se atrapa cualquier error.
async function notifyAdmins(tenantId, { title, body, url }) {
  try {
    if (!env.vapid.publicKey || !env.vapid.privateKey) {
      console.warn('[Push] VAPID keys no configuradas, notificaci\u00f3n omitida.');
      return;
    }

    const adminFilter = { role: 'admin' };
    if (tenantId) adminFilter.tenant_id = tenantId;
    const adminIds = await User.find(adminFilter).distinct('_id');
    if (adminIds.length === 0) return;

    const subscriptions = await PushSubscription.find({ user_id: { $in: adminIds } });

    const payload = JSON.stringify({ title, body, url: url || '/admin/dashboard' });

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
        );
      } catch (error) {
        // 404/410 = la suscripci\u00f3n ya no es v\u00e1lida (navegador desinstal\u00f3,
        // permiso revocado, etc.) -- se limpia para no seguir intentando.
        if (error.statusCode === 404 || error.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
        } else {
          console.error('[Push] Error enviando notificaci\u00f3n:', error.message);
        }
      }
    }));
  } catch (error) {
    console.error('[Push] Error general en notifyAdmins:', error.message);
  }
}

module.exports = { notifyAdmins };
