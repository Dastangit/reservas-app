import i18n from '../i18n.js';

// Datos de contacto en un solo sitio (cambiarlos aqui cuando haya email y
// WhatsApp de empresa).
const CONTACT_EMAIL = window.APP_CONFIG?.admin_email || 'elysio.support@gmail.com';
const CONTACT_WHATSAPP = window.APP_CONFIG?.whatsapp || '+16055003653';

const Footer = {
  render() {
    const t = (key) => i18n.t(key);
    const waDigits = CONTACT_WHATSAPP.replace(/\D/g, '');
    return `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <div class="footer-logo-row">
                <img loading="lazy" src="/assets/logo-elysio.svg" alt="Elysio Experiences" class="footer-logo-img">
              </div>
              <p>${t('footer.tagline')}</p>
              <p class="footer-contact">
                <strong>${t('footer.contact')}:</strong><br>
                Email: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a><br>
                WhatsApp: <a href="https://wa.me/${waDigits}" target="_blank" rel="noopener">${CONTACT_WHATSAPP}</a>
              </p>
            </div>
            <div class="footer-links">
              <h4>${t('footer.quickLinks')}</h4>
              <a href="/search" data-link>${t('footer.searchProperties')}</a>
              <a href="/how-it-works" data-link>${t('footer.howItWorks')}</a>
              <a href="/faq" data-link>${t('footer.faq')}</a>
              <a href="/feedback" data-link>${t('footer.sendFeedback')}</a>
            </div>
            <div class="footer-legal">
              <h4>${t('footer.legal')}</h4>
              <a href="/terms" data-link>${t('footer.terms')}</a>
              <a href="/privacy" data-link>${t('footer.privacy')}</a>
            </div>
          </div>
          <div class="footer-bottom">
            <p>&copy; ${new Date().getFullYear()} Elysio Experiences. ${t('footer.rights')}</p>
          </div>
        </div>
      </footer>
    `;
  },

  init() {
    const footerEl = document.getElementById('footer');
    if (footerEl) {
      footerEl.innerHTML = this.render();
    }
  }
};

export default Footer;
