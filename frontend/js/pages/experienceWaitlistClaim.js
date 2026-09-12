import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import { validateInternationalPhone } from '../utils/validators.js';

const ExperienceWaitlistClaimPage = {
  experience: null,
  waitlistId: null,

  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn()) {
      return `<div class="container"><p>${t('experience.loginRequiredSimple')}</p></div>`;
    }

    const id = this._params?.id || window.location.pathname.split('/')[2];
    this.waitlistId = this._params?.waitlistId || window.location.pathname.split('/')[4];

    try {
      const response = await api.get(`/experiences/${id}`);
      this.experience = response.data?.experience;
    } catch (error) {
      return `<div class="container"><p class="error">${t('experience.notFound')}</p></div>`;
    }

    if (!this.experience) {
      return `<div class="container"><p class="error">${t('experience.notFound')}</p></div>`;
    }

    return `
      <div class="booking-form-page">
        <div class="container">
          <h1>${t('experience.spotFreedTitle')}</h1>
          <p style="color:var(--text-light);margin-bottom:20px;">
            ${t('experience.limitedTimeNoticePrefix')}${this.experience.title}${t('experience.limitedTimeNoticeSuffix')}
          </p>

          <form id="claim-form" style="max-width:450px;">
            <div class="form-group">
              <label>${t('profile.name')}</label>
              <input type="text" id="tourist-name" value="${auth.getUser()?.name || ''}" required>
            </div>
            <div class="form-group">
              <label>${t('auth.email')}</label>
              <input type="email" id="tourist-email" required>
            </div>
            <div class="form-group">
              <label>${t('booking.phoneLabel')}</label>
              <input type="tel" id="tourist-phone" placeholder="+53 5xxxxxxx" required>
            </div>
            <div class="form-group">
              <label>${t('experience.claimNumSpotsLabel')}</label>
              <input type="number" id="claim-num-spots" min="1" value="1" required>
              <small class="field-hint">${t('experience.claimNumSpotsHint')}</small>
            </div>

            <div id="error-message" class="error-message" style="display:none;"></div>

            <button type="submit" class="btn btn-primary btn-block">${t('experience.confirmSpotBtn')}</button>
          </form>
        </div>
      </div>
    `;
  },

  init() {
    document.getElementById('claim-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleClaim();
    });
  },

  async handleClaim() {
    const errorEl = document.getElementById('error-message');
    const phone = document.getElementById('tourist-phone')?.value?.trim();

    if (!validateInternationalPhone(phone)) {
      errorEl.textContent = i18n.t('booking.invalidPhone');
      errorEl.style.display = 'block';
      return;
    }

    // La cantidad de cupos y su combinación de precio se decide con el
    // organizador al momento del contacto; acá solo se registra la
    // audiencia/moneda por defecto (turista/USD) -- el admin puede ajustar
    // el registro contable si hace falta al aprobar.
    const defaultPricing = this.experience.pricing?.[0] || { audience: 'tourist', currency: 'USD', amount: 0 };
    const num_spots = parseInt(document.getElementById('claim-num-spots')?.value, 10) || 1;

    const payload = {
      payment_info: [{
        audience: defaultPricing.audience,
        currency: defaultPricing.currency,
        num_spots,
      }],
      tourist_data: {
        name: document.getElementById('tourist-name')?.value,
        email: document.getElementById('tourist-email')?.value,
        phone,
        contact_method: 'whatsapp',
        language: i18n.currentLang || 'es',
      },
    };

    try {
      const response = await api.post(`/experiences/${this.experience._id}/waitlist/${this.waitlistId}/claim`, payload);
      if (response.success) {
        window.location.href = `/experience-bookings/${response.data.booking_id}/confirmation`;
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('experience.claimFailed');
      errorEl.style.display = 'block';
    }
  },
};

export default ExperienceWaitlistClaimPage;
