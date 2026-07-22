import api from '../api.js';
import BookingCard from '../components/BookingCard.js';
import auth from '../auth.js';

const DashboardTouristPage = {
  async render() {
    if (!auth.isLoggedIn()) {
      return '<div class="container"><p>Please <a href="/login" data-link>login</a> to view your bookings.</p></div>';
    }

    return `
      <div class="dashboard-page">
        <div class="container">
          <h1>My Bookings</h1>
          
          <div class="dashboard-tabs">
            <button class="tab-btn active" data-tab="all">All</button>
            <button class="tab-btn" data-tab="pending">Pending</button>
            <button class="tab-btn" data-tab="approved">Approved</button>
            <button class="tab-btn" data-tab="completed">Completed</button>
          </div>
          
          <div id="bookings-list" class="bookings-list">
            <p class="loading">Loading bookings...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn()) return;

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

    list.innerHTML = '<p class="loading">Loading...</p>';

    try {
      const response = await api.get('/bookings');
      let bookings = response.data?.bookings || [];

      if (filter !== 'all') {
        bookings = bookings.filter(b => b.status === filter);
      }

      if (bookings.length === 0) {
        list.innerHTML = '<p class="no-results">No bookings found</p>';
        return;
      }

      list.innerHTML = BookingCard.renderList(bookings);
    } catch (error) {
      list.innerHTML = '<p class="error">Error loading bookings</p>';
    }
  }
};

export default DashboardTouristPage;
