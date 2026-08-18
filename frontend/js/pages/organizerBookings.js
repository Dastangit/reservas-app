import api from '../api.js';
import auth from '../auth.js';
import { formatExperiencePrice } from '../utils/formatters.js';

const OrganizerBookingsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) {
      return '<div class="container"><p>Acceso denegado. Inicia sesión como organizador.</p></div>';
    }

    return `
      <div class="host-reservations-page">
        <div class="container">
          <h1>Reservas de mis excursiones</h1>
          <div id="organizer-bookings-list">
            <p class="loading">Cargando...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) return;

    window.completeOrganizerBooking = async (id) => {
      if (!confirm('¿Marcar esta reserva como completada? Esto la incluye en tu comisión mensual.')) return;
      try {
        await api.post(`/organizer/experience-bookings/${id}/complete`);
        await this.load();
      } catch (error) {
        alert('Error: ' + error.message);
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
        list.innerHTML = '<p class="no-results">Todavía no tienes reservas.</p>';
        return;
      }

      list.innerHTML = bookings.map((b) => {
        const paymentSummary = (b.payment_info || [])
          .map((p) => `${p.num_spots}x ${p.audience === 'local' ? 'local' : 'turista'} ${formatExperiencePrice(p.amount, p.currency)}`)
          .join(', ');

        return `
          <div class="booking-list-item">
            <span>${b.experience_id?.title || 'Excursión'}</span>
            <span>${b.experience_id?.date ? new Date(b.experience_id.date).toLocaleDateString() : ''}</span>
            <span>${paymentSummary}</span>
            <span class="status-badge ${b.status}">${b.status.replace(/_/g, ' ')}</span>
            ${b.status === 'approved' ? `<button class="btn btn-primary btn-sm" onclick="completeOrganizerBooking('${b._id}')">Marcar completada</button>` : ''}
          </div>
        `;
      }).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando reservas</p>';
    }
  },
};

export default OrganizerBookingsPage;
