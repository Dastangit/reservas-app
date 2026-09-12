import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const HostDashboardPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isHost()) {
      return `<div class="container"><p>${t('host.accessDenied')}</p></div>`;
    }

    return `
      <div class="dashboard-page host-dashboard">
        <div class="container">
          <h1>${t('host.dashboard')}</h1>

          <div class="dashboard-stats">
            <div class="stat-card">
              <h3>${t('host.myProperties')}</h3>
              <p class="stat-number" id="properties-count">-</p>
            </div>
            <div class="stat-card">
              <h3>${t('host.pendingBookings')}</h3>
              <p class="stat-number" id="pending-count">-</p>
            </div>
            <div class="stat-card">
              <h3>${t('host.activeBookings')}</h3>
              <p class="stat-number" id="active-count">-</p>
            </div>
          </div>

          <div class="dashboard-actions">
            <a href="/host/properties/new" data-link class="btn btn-primary">${t('host.addProperty')}</a>
            <a href="/host/bookings" data-link class="btn btn-outline">${t('host.viewBookings')}</a>
          </div>

          <div class="recent-bookings">
            <h2>${t('host.recentBookings')}</h2>
            <div id="recent-bookings-list">
              <p class="loading">${t('common.loading')}</p>
            </div>
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

      const pending = bookings.filter(b => b.status === 'pending_approval').length;
      const active = bookings.filter(b => b.status === 'approved').length;

      document.getElementById('pending-count').textContent = pending;
      document.getElementById('active-count').textContent = active;

      const recentList = document.getElementById('recent-bookings-list');
      const recent = bookings.slice(0, 5);

      if (recent.length === 0) {
        recentList.innerHTML = `<p>${i18n.t('host.noRecentBookings')}</p>`;
      } else {
        recentList.innerHTML = recent.map(b => `
          <div class="booking-list-item">
            <span>${b.property_id?.name || i18n.t('booking.propertyFallback')}</span>
            <span>${b.tourist_id?.name || i18n.t('host.touristFallback')}</span>
            <span class="status-badge ${b.status}">${b.status}</span>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }
};

export default HostDashboardPage;
