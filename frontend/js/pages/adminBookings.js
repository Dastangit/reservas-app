import api from '../api.js';
import BookingCard from '../components/BookingCard.js';
import auth from '../auth.js';

const AdminBookingsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Access denied. Please login as admin.</p></div>';
    }

    return `
      <div class="admin-bookings-page">
        <div class="container">
          <h1>Manage Bookings</h1>
          
          <div class="dashboard-tabs">
            <button class="tab-btn active" data-tab="all">All</button>
            <button class="tab-btn" data-tab="pending_approval">Pending</button>
            <button class="tab-btn" data-tab="approved">Approved</button>
            <button class="tab-btn" data-tab="completed">Completed</button>
            <button class="tab-btn" data-tab="rejected">Rejected</button>
          </div>
          
          <div id="bookings-list">
            <p class="loading">Loading bookings...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.loadBookings(e.target.dataset.tab);
      });
    });

    await this.loadBookings('all');

    window.approveBooking = async (id) => {
      try {
        await api.post(`/bookings/${id}/approve`);
        alert('Booking approved');
        this.loadBookings('all');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.rejectBooking = async (id) => {
      const reason = prompt('Enter rejection reason:');
      if (reason) {
        try {
          await api.post(`/bookings/${id}/reject`, { reason });
          alert('Booking rejected');
          this.loadBookings('all');
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    };

    window.completeBooking = async (id) => {
      try {
        await api.post(`/bookings/${id}/complete`);
        alert('Booking completed');
        this.loadBookings('all');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.notifyHostWhatsApp = async (id) => {
      try {
        const response = await api.get(`/admin/bookings/${id}/whatsapp-link`);
        const url = response.data?.url;
        if (url) {
          window.open(url, '_blank');
        } else {
          alert('El anfitrión no tiene un teléfono registrado.');
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.notifyTouristWhatsApp = async (id) => {
      const type = document.getElementById(`tourist-msg-type-${id}`)?.value || 'payment_received';
      try {
        const response = await api.get(`/admin/bookings/${id}/tourist-contact-links?type=${type}`);
        const url = response.data?.whatsapp_url;
        if (url) {
          window.open(url, '_blank');
        } else {
          alert('El turista no tiene un teléfono registrado.');
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.notifyTouristEmail = async (id) => {
      const type = document.getElementById(`tourist-msg-type-${id}`)?.value || 'payment_received';
      try {
        const response = await api.get(`/admin/bookings/${id}/tourist-contact-links?type=${type}`);
        const url = response.data?.mailto_url;
        if (url) {
          window.location.href = url;
        } else {
          alert('El turista no tiene un correo registrado.');
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };
  },

  async loadBookings(filter = 'all') {
    const list = document.getElementById('bookings-list');
    if (!list) return;

    list.innerHTML = '<p class="loading">Loading...</p>';

    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await api.get(`/admin/bookings${params}`);
      const bookings = response.data?.bookings || [];

      if (bookings.length === 0) {
        list.innerHTML = '<p class="no-results">No bookings found</p>';
        return;
      }

      list.innerHTML = BookingCard.renderList(bookings, 'admin');
    } catch (error) {
      list.innerHTML = '<p class="error">Error loading bookings</p>';
    }
  }
};

export default AdminBookingsPage;
