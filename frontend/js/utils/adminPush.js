import api from '../api.js';
import auth from '../auth.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// Verdad real: le pregunta al navegador si ya existe una suscripción activa
// (no confia en localStorage, que puede quedar desincronizado si el backend
// borro la suscripcion por invalida -- ver notifyAdmins/pushNotifications.js).
// Si el navegador SI tiene una suscripcion viva, la reenvia al backend
// (upsert, sin efectos secundarios via findOneAndUpdate) para auto-sanar el
// caso en que el servidor la haya borrado pero el navegador siga suscrito.
// Se llama en cada carga del panel admin -- es barato y evita que el boton
// de "Activar notificaciones" se quede escondido para siempre por un flag
// de localStorage desactualizado.
export async function syncAdminPushSubscription() {
  if (!auth.isLoggedIn() || !auth.isAdmin()) return { ok: false, subscribed: false };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    localStorage.removeItem('admin_push_subscribed');
    return { ok: false, subscribed: false, reason: 'unsupported' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      localStorage.removeItem('admin_push_subscribed');
      return { ok: true, subscribed: false };
    }

    // Re-envia la suscripcion activa al backend por si se habia borrado ahi
    // (404/410 previo) -- el upsert la restaura sin duplicar ni pedir permiso de nuevo.
    await api.post('/push/subscribe', subscription.toJSON());
    localStorage.setItem('admin_push_subscribed', '1');
    return { ok: true, subscribed: true };
  } catch (error) {
    console.error('[Push] Error al sincronizar suscripcion:', error);
    // No borramos el flag local aqui -- un fallo de red (offline, Render
    // dormido) no significa que la suscripcion real dejo de existir.
    return { ok: false, subscribed: isAdminPushSubscribed(), reason: 'error' };
  }
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

// Lectura rapida y sincronica del ultimo estado conocido -- usala solo como
// hint de UI mientras se resuelve syncAdminPushSubscription(); la fuente de
// verdad real es siempre el navegador (ver funcion de arriba).
export function isAdminPushSubscribed() {
  return localStorage.getItem('admin_push_subscribed') === '1';
}
