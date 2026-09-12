import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const OrganizerDashboardPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isOrganizer()) {
      return `<div class="container"><p>${t('organizer.accessDenied')}</p></div>`;
    }

    return `
      <div class="dashboard-page host-dashboard">
        <div class="container">
          <h1>${t('organizer.dashboardTitle')}</h1>

          <div class="dashboard-stats">
            <div class="stat-card">
              <h3>${t('organizer.myExperiences')}</h3>
              <p class="stat-number" id="experiences-count">-</p>
            </div>
            <div class="stat-card">
              <h3>${t('host.pendingBookings')}</h3>
              <p class="stat-number" id="pending-count">-</p>
            </div>
            <div class="stat-card">
              <h3>${t('organizer.approvedBookings')}</h3>
              <p class="stat-number" id="approved-count">-</p>
            </div>
          </div>

          <div class="dashboard-actions">
            <a href="/organizer/experiences/new" data-link class="btn btn-primary">${t('organizer.newExperience')}</a>
            <a href="/organizer/recurrences/new" data-link class="btn btn-outline">${t('organizer.newRecurringExperience')}</a>
            <a href="/organizer/experiences" data-link class="btn btn-outline">${t('organizer.myExperiences')}</a>
            <a href="/organizer/bookings" data-link class="btn btn-outline">${t('host.viewBookings')}</a>
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
    if (!auth.isLoggedIn() || !auth.isOrganizer()) return;

    try {
      const [experiencesRes, bookingsRes] = await Promise.all([
        api.get('/organizer/experiences'),
        api.get('/organizer/experience-bookings'),
      ]);

      const experiences = experiencesRes.data?.experiences || [];
      const bookings = bookingsRes.data?.bookings || [];

      const pending = bookings.filter((b) => b.status === 'pending_approval').length;
      const approved = bookings.filter((b) => b.status === 'approved').length;

      document.getElementById('experiences-count').textContent = experiences.length;
      document.getElementById('pending-count').textContent = pending;
      document.getElementById('approved-count').textContent = approved;

      const recentList = document.getElementById('recent-bookings-list');
      const recent = bookings.slice(0, 5);

      if (recent.length === 0) {
        recentList.innerHTML = `<p>${i18n.t('organizer.noBookingsYet')}</p>`;
      } else {
        recentList.innerHTML = recent.map((b) => `
          <div class="booking-list-item">
            <span>${b.experience_id?.title || i18n.t('experience.fallbackTitle')}</span>
            <span>${b.num_spots} ${i18n.t('experience.spotsWord')}</span>
            <span class="status-badge ${b.status}">${b.status.replace(/_/g, ' ')}</span>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Error loading organizer dashboard:', error);
    }
  },
};

export default OrganizerDashboardPage;
