import api from '../api.js';
import auth from '../auth.js';

const ExperienceMyBookingsPage = {
  async render() {
    if (!auth.isLoggedIn()) {
      return '<div class="container"><p>Por favor <a href="/login" data-link>inicia sesión</a>.</p></div>';
    }

    return `
      <div class="dashboard-page">
        <div class="container">
          <h1>Mis reservas de excursiones</h1>
          <div id="experience-bookings-list" class="bookings-list">
            <p class="loading">Cargando...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn()) return;

    window.cancelExperienceBooking = async (id) => {
      if (!confirm('¿Cancelar esta reserva?')) return;
      try {
        await api.post(`/experience-bookings/${id}/cancel`);
        await this.loadBookings();
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    await this.loadBookings();
  },

  async loadBookings() {
    const list = document.getElementById('experience-bookings-list');
    if (!list) return;

    list.innerHTML = '<p class="loading">Cargando...</p>';

    try {
      const response = await api.get('/experience-bookings');
      const bookings = response.data?.bookings || [];

      if (bookings.length === 0) {
        list.innerHTML = '<p class="no-results">No tienes reservas de excursiones todavía. <a href="/experiences" data-link>Explorar excursiones</a></p>';
        return;
      }

      list.innerHTML = bookings.map((b) => `
        <div class="booking-list-item">
          <span>${b.experience_id?.title || 'Excursión'}</span>
          <span>${b.experience_id?.date ? new Date(b.experience_id.date).toLocaleDateString() : ''}</span>
          <span>${b.num_spots} cupo(s)</span>
          <span class="status-badge ${b.status}">${b.status.replace(/_/g, ' ')}</span>
          ${['pending_approval', 'approved'].includes(b.status) ? `<button class="btn btn-danger btn-sm" onclick="cancelExperienceBooking('${b._id}')">Cancelar</button>` : ''}
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando reservas</p>';
    }
  },
};

export default ExperienceMyBookingsPage;
