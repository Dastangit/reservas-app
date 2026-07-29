// Chrome (Android/desktop) dispara 'beforeinstallprompt' pero solo bajo
// criterios de "engagement" bastante estrictos en m\u00f3vil -- casi nunca
// muestra su banner autom\u00e1tico solo. Lo capturamos nosotros y mostramos nuestro
// propio bot\u00f3n, que s\u00ed podemos controlar cu\u00e1ndo aparece.
//
// iOS Safari NO tiene esta API en absoluto -- ah\u00ed la \u00fanica forma de instalar
// es manual (Compartir \u2192 Agregar a pantalla de inicio), as\u00ed que mostramos
// instrucciones en vez de un bot\u00f3n funcional.

let deferredPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function createInstallBanner({ onInstallClick, iosMode }) {
  if (document.getElementById('pwa-install-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';

  if (iosMode) {
    banner.innerHTML = `
      <span>Instala esta app: toca <strong>Compartir</strong> \u2b06\ufe0f y luego <strong>"Agregar a pantalla de inicio"</strong>.</span>
      <button type="button" id="pwa-install-dismiss" class="pwa-install-dismiss" aria-label="Cerrar">\u2715</button>
    `;
  } else {
    banner.innerHTML = `
      <span>Instala la app en tu tel\u00e9fono para un acceso m\u00e1s r\u00e1pido.</span>
      <button type="button" id="pwa-install-btn" class="btn btn-primary btn-sm">Instalar</button>
      <button type="button" id="pwa-install-dismiss" class="pwa-install-dismiss" aria-label="Cerrar">\u2715</button>
    `;
  }

  document.body.appendChild(banner);

  document.getElementById('pwa-install-dismiss').addEventListener('click', () => {
    banner.remove();
    sessionStorage.setItem('pwa_install_dismissed', '1');
  });

  if (!iosMode) {
    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!onInstallClick) return;
      const outcome = await onInstallClick();
      if (outcome === 'accepted') {
        banner.remove();
      }
    });
  }
}

export function initPwaInstall() {
  if (isStandalone()) return; // ya está instalada, no molestar
  if (sessionStorage.getItem('pwa_install_dismissed')) return;

  if (isIos()) {
    // En iOS no hay evento que esperar -- mostramos las instrucciones directo.
    createInstallBanner({ iosMode: true });
    return;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;

    createInstallBanner({
      iosMode: false,
      onInstallClick: async () => {
        if (!deferredPrompt) return null;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        return outcome;
      },
    });
  });
}
