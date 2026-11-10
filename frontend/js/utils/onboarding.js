import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

// Los textos vienen de locales/*.json (onboarding.*). Son nuestros y llevan
// <strong>/<a> a proposito, asi que no se escapan.
const t = (key) => i18n.t(key);

async function markOnboarding(field) {
  auth.setOnboardingFlag(field, true);
  try {
    await api.post('/auth/onboarding', { field });
  } catch (error) {
    // No es cr\u00edtico si falla -- ya qued\u00f3 marcado localmente, se reintenta
    // solo si el usuario vuelve a ver el modal en otro dispositivo/sesi\u00f3n.
  }
}

// Muestra el modal de bienvenida una sola vez, la primera vez que un turista
// entra a su dashboard despu\u00e9s de registrarse.
export function showWelcomeModalIfNeeded() {
  if (!auth.isLoggedIn() || !auth.isTourist()) return;
  if (auth.getOnboarding().welcome_seen) return;

  const overlay = document.createElement('div');
  overlay.className = 'onboarding-modal-overlay';
  overlay.innerHTML = `
    <div class="onboarding-modal">
      <h2>${t('onboarding.welcomeTitle')}</h2>
      <p>${t('onboarding.welcomeBody')}</p>
      <div class="onboarding-modal-actions">
        <a href="/how-it-works" data-link class="btn btn-primary" id="onboarding-cta">${t('onboarding.welcomeCta')}</a>
        <button type="button" class="btn btn-outline" id="onboarding-dismiss">${t('onboarding.welcomeDismiss')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    markOnboarding('welcome_seen');
    overlay.remove();
  };

  document.getElementById('onboarding-dismiss').addEventListener('click', close);
  document.getElementById('onboarding-cta').addEventListener('click', close);
}

// Recordatorio no bloqueante en el formulario de reserva -- solo se muestra
// si el turista todav\u00eda no ha visitado C\u00f3mo Funciona.
export function renderBookingReminderIfNeeded() {
  if (!auth.isLoggedIn() || !auth.isTourist()) return '';
  if (auth.getOnboarding().terms_viewed) return '';

  return `<div class="onboarding-reminder-banner">${t('onboarding.reminder')}</div>`;
}

// Se llama al entrar a la p\u00e1gina C\u00f3mo Funciona -- marca que ya lo vio, para
// que el recordatorio deje de aparecer.
export function markTermsViewed() {
  if (!auth.isLoggedIn() || !auth.isTourist()) return;
  if (auth.getOnboarding().terms_viewed) return;
  markOnboarding('terms_viewed');
}
