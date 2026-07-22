import api from '../api.js';
import BookingCard from '../components/BookingCard.js';
import auth from '../auth.js';

const HostReservationsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isHost()) {
      return '<div class="container"><p>Access denied. Please login as a host.</p></div>';
    }

    return `
      <div class="host-reservations-page">
        <div class="container">
          <h1>My Reservations</h1>
          
          <div class="dashboard-tabs">
            <button class="tab-btn active" data-tab="all">All</button>
            <button class="tab-btn" data-tab="pending_approval">Pending</button>
            <button class="tab-btn" data-tab="approved">Active</button>
            <button class="tab-btn" data-tab="completed">Completed</button>
          </div>
          
          <div id="bookings-list">
            <p class="loading">Loading reservations...</p>
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
      if (confirm('Mark this booking as completed?')) {
        try {
          await api.post(`/bookings/${id}/complete`);
          alert('Booking completed');
          this.loadBookings('all');
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    };
  },

  async loadBookings(filter = 'all') {
    const list = document.getElementById('bookings-list');
    if (!list) return;

    list.innerHTML = '<p class="loading">Loading...</p>';

    try {
      const response = await api.get('/bookings/host');
      let bookings = response.data?.bookings || [];

      if (filter !== 'all') {
        bookings = bookings.filter(b => b.status === filter);
      }

      if (bookings.length === 0) {
        list.innerHTML = '<p class="no-results">No reservations found</p>';
        return;
      }

      list.innerHTML = BookingCard.renderList(bookings, 'host');
    } catch (error) {
      list.innerHTML = '<p class="error">Error loading reservations</p>';
    }
  }
};

export default HostReservationsPage;
