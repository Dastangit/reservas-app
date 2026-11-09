// Chrome (Android/desktop) dispara 'beforeinstallprompt' pero solo bajo
// criterios de "engagement" bastante estrictos en m\u00f3vil -- casi nunca
// muestra su banner autom\u00e1tico solo. Lo capturamos nosotros y mostramos nuestro
// propio bot\u00f3n, que s\u00ed podemos controlar cu\u00e1ndo aparece.
//
// iOS Safari NO tiene esta API en absoluto -- ah\u00ed la \u00fanica forma de instalar
// es manual (Compartir \u2192 Agregar a pantalla de inicio), as\u00ed que mostramos
// instrucciones en vez de un bot\u00f3n funcional.

import i18n from '../i18n.js';

let deferredPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// En escritorio no se muestra: el texto habla del telefono y el navegador ya
// ofrece instalar desde la barra de direcciones.
function isDesktop() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

// Mientras el banner esta visible, el body deja ese espacio abajo para que el
// banner no tape el final de la pagina (precio, boton de reservar...).
function reserveSpace(banner) {
  document.body.style.paddingBottom = `${banner.offsetHeight}px`;
}

function removeBanner(banner) {
  banner.remove();
  document.body.style.paddingBottom = '';
}

function createInstallBanner({ onInstallClick, iosMode }) {
  if (document.getElementById('pwa-install-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';

  if (iosMode) {
    banner.innerHTML = `
      <span>${i18n.t('pwa.installIos')}</span>
      <button type="button" id="pwa-install-dismiss" class="pwa-install-dismiss" aria-label="${i18n.t('common.close')}">\u2715</button>
    `;
  } else {
    banner.innerHTML = `
      <span>${i18n.t('pwa.install')}</span>
      <button type="button" id="pwa-install-btn" class="btn btn-primary btn-sm">${i18n.t('pwa.installBtn')}</button>
      <button type="button" id="pwa-install-dismiss" class="pwa-install-dismiss" aria-label="${i18n.t('common.close')}">\u2715</button>
    `;
  }

  document.body.appendChild(banner);
  reserveSpace(banner);

  document.getElementById('pwa-install-dismiss').addEventListener('click', () => {
    removeBanner(banner);
    sessionStorage.setItem('pwa_install_dismissed', '1');
  });

  if (!iosMode) {
    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!onInstallClick) return;
      const outcome = await onInstallClick();
      if (outcome === 'accepted') {
        removeBanner(banner);
      }
    });
  }
}

export function initPwaInstall(ready = Promise.resolve()) {
  if (isStandalone()) return; // ya está instalada, no molestar
  if (sessionStorage.getItem('pwa_install_dismissed')) return;
  if (isDesktop()) return;

  if (isIos()) {
    // En iOS no hay evento que esperar -- mostramos las instrucciones directo.
    ready.then(() => createInstallBanner({ iosMode: true }));
    return;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;

    ready.then(() => createInstallBanner({
      iosMode: false,
      onInstallClick: async () => {
        if (!deferredPrompt) return null;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        return outcome;
      },
    }));
  });
}
