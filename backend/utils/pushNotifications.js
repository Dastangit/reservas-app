const webpush = require('web-push');
const env = require('../config/env');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');
const { sendTelegram, isTelegramConfigured } = require('./telegram');

if (env.vapid.publicKey && env.vapid.privateKey) {
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
}

const isPushConfigured = () => Boolean(env.vapid.publicKey && env.vapid.privateKey);

// Le manda una notificacion a TODOS los admins del tenant: web push a todos sus
// dispositivos suscritos y, si `urgent`, tambien por Telegram (segundo canal
// para los avisos que tienen plazo). Nunca debe romper el flujo principal:
// los call sites no usan await y aqui se atrapa cualquier error.
// Devuelve un resumen ({ push_sent, push_failed, push_devices, telegram }) que
// usa el boton "Enviar notificacion de prueba" del panel.
async function notifyAdmins(tenantId, { title, body, url }, { urgent = false } = {}) {
  const summary = { push_sent: 0, push_failed: 0, push_devices: 0, telegram: 'skipped' };
  try {
    if (urgent) {
      const tg = await sendTelegram(`${title}\n${body}${url ? `\n${env.frontendUrl}${url}` : ''}`);
      summary.telegram = tg.ok ? 'sent' : tg.reason;
    }

    if (!isPushConfigured()) {
      console.warn('[Push] VAPID keys no configuradas, notificacion push omitida.');
      if (!urgent || summary.telegram !== 'sent') {
        console.error(`[Avisos] Ningun canal entrego: "${title}"`);
      }
      return summary;
    }

    const adminFilter = { role: 'admin' };
    if (tenantId) adminFilter.tenant_id = tenantId;
    const adminIds = await User.find(adminFilter).distinct('_id');
    if (adminIds.length === 0) return summary;

    const subscriptions = await PushSubscription.find({ user_id: { $in: adminIds } });
    summary.push_devices = subscriptions.length;

    const payload = JSON.stringify({ title, body, url: url || '/admin/dashboard' });

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        summary.push_sent += 1;
      } catch (error) {
        summary.push_failed += 1;
        // 404/410 = la suscripcion ya no es valida (permiso revocado, navegador
        // desinstalado...): se limpia y se avisa, para que no pase desapercibido.
        if (error.statusCode === 404 || error.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
          console.warn('[Push] Suscripcion caducada eliminada; el admin debe reactivar las notificaciones en ese dispositivo.');
        } else {
          console.error('[Push] Error enviando notificacion:', error.message);
        }
      }
    }));

    if (summary.push_sent === 0 && summary.telegram !== 'sent') {
      console.error(`[Avisos] Ningun canal entrego: "${title}" (dispositivos push: ${summary.push_devices})`);
    }
  } catch (error) {
    console.error('[Push] Error general en notifyAdmins:', error.message);
  }
  return summary;
}

// Estado de los canales, para el panel del admin.
async function getNotificationStatus(tenantId) {
  const adminFilter = { role: 'admin' };
  if (tenantId) adminFilter.tenant_id = tenantId;
  const adminIds = await User.find(adminFilter).distinct('_id');
  const pushDevices = await PushSubscription.countDocuments({ user_id: { $in: adminIds } });
  return {
    push_configured: isPushConfigured(),
    push_devices: pushDevices,
    telegram_configured: isTelegramConfigured(),
  };
}

module.exports = { notifyAdmins, getNotificationStatus };
