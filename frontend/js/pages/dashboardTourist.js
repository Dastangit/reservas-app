import api from '../api.js';
import BookingCard from '../components/BookingCard.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import { showWelcomeModalIfNeeded } from '../utils/onboarding.js';

const DashboardTouristPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn()) {
      return `<div class="container"><p>${t('dashboard.loginRequired')}</p></div>`;
    }

    return `
      <div class="dashboard-page">
        <div class="container">
          <h1>${t('dashboard.myBookings')}</h1>

          <div class="dashboard-tabs">
            <button class="tab-btn active" data-tab="all">${t('dashboard.all')}</button>
            <button class="tab-btn" data-tab="pending">${t('dashboard.pending')}</button>
            <button class="tab-btn" data-tab="approved">${t('dashboard.approved')}</button>
            <button class="tab-btn" data-tab="completed">${t('dashboard.completed')}</button>
          </div>

          <div id="bookings-list" class="bookings-list">
            <p class="loading">${t('common.loading')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn()) return;

    showWelcomeModalIfNeeded();

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.loadBookings(e.target.dataset.tab);
      });
    });

    await this.loadBookings('all');
  },

  async loadBookings(filter = 'all') {
    const list = document.getElementById('bookings-list');
    if (!list) return;

    list.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const response = await api.get('/bookings');
      let bookings = response.data?.bookings || [];

      if (filter !== 'all') {
        bookings = bookings.filter(b => b.status === filter);
      }

      if (bookings.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('dashboard.noBookings')}</p>`;
        return;
      }

      list.innerHTML = BookingCard.renderList(bookings);
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('dashboard.errorLoading')}</p>`;
    }
  }
};

export default DashboardTouristPage;
