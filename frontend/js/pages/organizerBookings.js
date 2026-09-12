import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import { formatExperiencePrice } from '../utils/formatters.js';

const OrganizerBookingsPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isOrganizer()) {
      return `<div class="container"><p>${t('organizer.accessDenied')}</p></div>`;
    }

    return `
      <div class="host-reservations-page">
        <div class="container">
          <h1>${t('organizer.bookingsTitle')}</h1>
          <div id="organizer-bookings-list">
            <p class="loading">${t('common.loading')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) return;

    window.completeOrganizerBooking = async (id) => {
      if (!confirm(i18n.t('organizer.markCompletedConfirm'))) return;
      try {
        await api.post(`/organizer/experience-bookings/${id}/complete`);
        await this.load();
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    await this.load();
  },

  async load() {
    const list = document.getElementById('organizer-bookings-list');
    try {
      const response = await api.get('/organizer/experience-bookings');
      const bookings = response.data?.bookings || [];

      if (bookings.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('organizer.noBookingsYouHave')}</p>`;
        return;
      }

      list.innerHTML = bookings.map((b) => {
        const paymentSummary = (b.payment_info || [])
          .map((p) => `${p.num_spots}x ${p.audience === 'local' ? i18n.t('organizer.audienceLocal') : i18n.t('organizer.audienceTourist')} ${formatExperiencePrice(p.amount, p.currency)}`)
          .join(', ');

        return `
          <div class="booking-list-item">
            <span>${b.experience_id?.title || i18n.t('experience.fallbackTitle')}</span>
            <span>${b.experience_id?.date ? new Date(b.experience_id.date).toLocaleDateString(i18n.currentLang) : ''}</span>
            <span>${paymentSummary}</span>
            <span class="status-badge ${b.status}">${b.status.replace(/_/g, ' ')}</span>
            ${b.status === 'approved' ? `<button class="btn btn-primary btn-sm" onclick="completeOrganizerBooking('${b._id}')">${i18n.t('organizer.markCompletedBtn')}</button>` : ''}
          </div>
        `;
      }).join('');
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('dashboard.errorLoading')}</p>`;
    }
  },
};

export default OrganizerBookingsPage;
