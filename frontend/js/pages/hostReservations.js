import api from '../api.js';
import BookingCard from '../components/BookingCard.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const HostReservationsPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isHost()) {
      return `<div class="container"><p>${t('host.accessDenied')}</p></div>`;
    }

    return `
      <div class="host-reservations-page">
        <div class="container">
          <h1>${t('host.myReservations')}</h1>

          <div class="dashboard-tabs">
            <button class="tab-btn active" data-tab="all">${t('dashboard.all')}</button>
            <button class="tab-btn" data-tab="pending_approval">${t('dashboard.pending')}</button>
            <button class="tab-btn" data-tab="approved">${t('host.tabActive')}</button>
            <button class="tab-btn" data-tab="completed">${t('dashboard.completed')}</button>
          </div>

          <div id="bookings-list">
            <p class="loading">${t('host.loadingReservations')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isHost()) return;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.loadBookings(e.target.dataset.tab);
      });
    });

    await this.loadBookings('all');

    window.completeBooking = async (id) => {
      if (confirm(i18n.t('host.completeConfirm'))) {
        try {
          await api.post(`/bookings/${id}/complete`);
          alert(i18n.t('host.bookingCompleted'));
          this.loadBookings('all');
        } catch (error) {
          alert(i18n.t('common.errorPrefix') + error.message);
        }
      }
    };
  },

  async loadBookings(filter = 'all') {
    const list = document.getElementById('bookings-list');
    if (!list) return;

    list.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const response = await api.get('/bookings/host');
      let bookings = response.data?.bookings || [];

      if (filter !== 'all') {
        bookings = bookings.filter(b => b.status === filter);
      }

      if (bookings.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('host.noReservations')}</p>`;
        return;
      }

      list.innerHTML = BookingCard.renderList(bookings, 'host');
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('host.errorLoadingReservations')}</p>`;
    }
  }
};

export default HostReservationsPage;
