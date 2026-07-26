import api from '../api.js';
import auth from '../auth.js';

const WELCOME_TEXT = {
  es: {
    title: '\u00a1Bienvenido a Da-El World Travelers!',
    body: 'Nos gustar\u00eda que leyeras nuestra secci\u00f3n <strong>C\u00f3mo Funciona</strong> para que entiendas bien el proceso de reserva, el pago del fee y c\u00f3mo funciona el resto del pago en el alojamiento. Gracias por elegirnos.',
    cta: 'Leer C\u00f3mo Funciona',
    dismiss: 'Entendido',
  },
  en: {
    title: 'Welcome to Da-El World Travelers!',
    body: 'We\u2019d like you to read our <strong>How It Works</strong> section so you understand the booking process, the booking fee, and how the remaining payment at the accommodation works. Thank you for choosing us.',
    cta: 'Read How It Works',
    dismiss: 'Got it',
  },
  fr: {
    title: 'Bienvenue chez Da-El World Travelers !',
    body: 'Nous vous invitons \u00e0 lire notre section <strong>Comment \u00e7a marche</strong> pour bien comprendre le processus de r\u00e9servation, les frais, et comment fonctionne le paiement restant \u00e0 l\u2019h\u00e9bergement. Merci de nous avoir choisis.',
    cta: 'Lire Comment \u00e7a marche',
    dismiss: 'Compris',
  },
};

const REMINDER_TEXT = {
  es: {
    text: 'Antes de reservar, te recomendamos leer nuestra secci\u00f3n <a href="/how-it-works" data-link>C\u00f3mo Funciona</a> -- ah\u00ed explicamos el fee de reserva y c\u00f3mo se paga el resto.',
  },
  en: {
    text: 'Before booking, we recommend reading our <a href="/how-it-works" data-link>How It Works</a> section -- it explains the booking fee and how the remainder is paid.',
  },
  fr: {
    text: 'Avant de r\u00e9server, nous vous recommandons de lire notre section <a href="/how-it-works" data-link>Comment \u00e7a marche</a> -- elle explique les frais de r\u00e9servation et comment le reste est pay\u00e9.',
  },
};

const lang = () => (window.i18n?.currentLang && WELCOME_TEXT[window.i18n.currentLang] ? window.i18n.currentLang : 'es');

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

  const t = WELCOME_TEXT[lang()];
  const overlay = document.createElement('div');
  overlay.className = 'onboarding-modal-overlay';
  overlay.innerHTML = `
    <div class="onboarding-modal">
      <h2>${t.title}</h2>
      <p>${t.body}</p>
      <div class="onboarding-modal-actions">
        <a href="/how-it-works" data-link class="btn btn-primary" id="onboarding-cta">${t.cta}</a>
        <button type="button" class="btn btn-outline" id="onboarding-dismiss">${t.dismiss}</button>
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

  const t = REMINDER_TEXT[lang()];
  return `<div class="onboarding-reminder-banner">${t.text}</div>`;
}

// Se llama al entrar a la p\u00e1gina C\u00f3mo Funciona -- marca que ya lo vio, para
// que el recordatorio deje de aparecer.
export function markTermsViewed() {
  if (!auth.isLoggedIn() || !auth.isTourist()) return;
  if (auth.getOnboarding().terms_viewed) return;
  markOnboarding('terms_viewed');
}
