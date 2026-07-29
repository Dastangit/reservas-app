import api from '../api.js';
import auth from '../auth.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// Pide permiso de notificaciones y suscribe al admin -- se llama una sola
// vez por sesi\u00f3n desde el bot\u00f3n de la campanita (necesita un gesto del
// usuario, los navegadores bloquean pedir permiso autom\u00e1ticamente sin uno).
export async function subscribeAdminToPush() {
  if (!auth.isLoggedIn() || !auth.isAdmin()) return { ok: false, reason: 'not_admin' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const keyResponse = await api.get('/push/vapid-public-key');
      const publicKey = keyResponse.data?.public_key;
      if (!publicKey) return { ok: false, reason: 'no_key' };

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await api.post('/push/subscribe', subscription.toJSON());
    localStorage.setItem('admin_push_subscribed', '1');
    return { ok: true };
  } catch (error) {
    console.error('[Push] Error al suscribir:', error);
    return { ok: false, reason: 'error' };
  }
}

export function isAdminPushSubscribed() {
  return localStorage.getItem('admin_push_subscribed') === '1';
}
