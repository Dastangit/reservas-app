import api from '../api.js';
import { formatCurrency } from '../utils/formatters.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const HostEarningsPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isHost()) {
      return `<div class="container"><p>${t('host.accessDenied')}</p></div>`;
    }

    return `
      <div class="earnings-page">
        <div class="container">
          <h1>${t('host.totalEarnings')}</h1>

          <div class="earnings-stats">
            <div class="stat-card">
              <h3>${t('host.totalEarnings')}</h3>
              <p class="stat-number" id="total-earnings">$0</p>
            </div>
            <div class="stat-card">
              <h3>${t('host.completedBookings')}</h3>
              <p class="stat-number" id="completed-count">0</p>
            </div>
          </div>

          <div class="earnings-note">
            <p><strong>${t('host.earningsNoteLabel')}</strong> ${t('host.earningsNoteText')}</p>
          </div>

          <div id="earnings-list">
            <h2>${t('host.bookingHistory')}</h2>
            <p class="loading">${t('common.loading')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isHost()) return;

    try {
      const response = await api.get('/bookings/host');
      const bookings = response.data?.bookings || [];

      const completed = bookings.filter(b => b.status === 'completed' || b.status === 'approved');
      const totalEarnings = completed.reduce((sum, b) => sum + (b.total_amount || 0), 0);

      document.getElementById('total-earnings').textContent = formatCurrency(totalEarnings);
      document.getElementById('completed-count').textContent = completed.length;

      const list = document.getElementById('earnings-list');
      if (completed.length === 0) {
        list.innerHTML += `<p>${i18n.t('host.noCompletedBookings')}</p>`;
      } else {
        list.innerHTML += completed.map(b => `
          <div class="earnings-item">
            <span>${b.property_id?.name || i18n.t('booking.propertyFallback')}</span>
            <span>${new Date(b.check_out).toLocaleDateString(i18n.currentLang)}</span>
            <span>${formatCurrency(b.total_amount)}</span>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
    }
  }
};

export default HostEarningsPage;
