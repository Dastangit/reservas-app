import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const ExperienceBookingConfirmationPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn()) {
      return `<div class="container"><p>${t('experience.loginRequiredSimple')}</p></div>`;
    }

    const id = this._params?.bookingId || window.location.pathname.split('/')[2];

    try {
      const response = await api.get(`/experience-bookings/${id}`);
      const booking = response.data?.booking;

      if (!booking) {
        return `<div class="container"><p class="error">${t('booking.bookingNotFound')}</p></div>`;
      }

      const hoursLeft = Math.max(0, Math.round((new Date(booking.hold_expires_at) - new Date()) / (1000 * 60 * 60)));

      return `
        <div class="confirmation-page">
          <div class="container">
            <div class="confirmation-card">
              <h1>${t('experience.requestSentTitle')}</h1>
              <p class="confirmation-subtitle">${t('experience.bookedSpotsPrefix')} ${booking.num_spots} ${t('experience.spotsWord')} ${t('experience.inQuotes')} "${booking.experience_id?.title || t('experience.fallbackTitle')}"</p>

              <div class="confirmation-details">
                <h2>${t('confirmation.whatNext')}</h2>
                <p>${t('experience.noFeePaidPrefix')}${hoursLeft}${t('experience.noFeePaidSuffix')}</p>
                <p>${t('experience.approvedContactNote')}</p>
              </div>

              <a href="/experience-bookings" data-link class="btn btn-primary">${t('experience.viewMyBookingsBtn')}</a>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      return `<div class="container"><p class="error">${t('experience.couldNotLoadBooking')}</p></div>`;
    }
  },

  init() {},
};

export default ExperienceBookingConfirmationPage;
