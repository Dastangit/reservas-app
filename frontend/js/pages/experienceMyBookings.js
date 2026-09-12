import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const ExperienceMyBookingsPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn()) {
      return `<div class="container"><p>${t('experience.loginRequiredSimple')}</p></div>`;
    }

    return `
      <div class="dashboard-page">
        <div class="container">
          <h1>${t('experience.myBookingsTitle')}</h1>
          <div id="experience-bookings-list" class="bookings-list">
            <p class="loading">${t('common.loading')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn()) return;

    window.cancelExperienceBooking = async (id) => {
      if (!confirm(i18n.t('experience.cancelConfirm'))) return;
      try {
        await api.post(`/experience-bookings/${id}/cancel`);
        await this.loadBookings();
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    await this.loadBookings();
  },

  async loadBookings() {
    const list = document.getElementById('experience-bookings-list');
    if (!list) return;

    list.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const response = await api.get('/experience-bookings');
      const bookings = response.data?.bookings || [];

      if (bookings.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('experience.noBookingsYet')} <a href="/experiences" data-link>${i18n.t('experience.exploreExcursions')}</a></p>`;
        return;
      }

      list.innerHTML = bookings.map((b) => `
        <div class="booking-list-item">
          <span>${b.experience_id?.title || i18n.t('experience.fallbackTitle')}</span>
          <span>${b.experience_id?.date ? new Date(b.experience_id.date).toLocaleDateString(i18n.currentLang) : ''}</span>
          <span>${b.num_spots} ${i18n.t('experience.spotsWord')}</span>
          <span class="status-badge ${b.status}">${b.status.replace(/_/g, ' ')}</span>
          ${['pending_approval', 'approved'].includes(b.status) ? `<button class="btn btn-danger btn-sm" onclick="cancelExperienceBooking('${b._id}')">${i18n.t('common.cancel')}</button>` : ''}
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('experience.errorLoadingList')}</p>`;
    }
  },
};

export default ExperienceMyBookingsPage;
