import api from '../api.js';
import auth from '../auth.js';
import { formatExperiencePrice } from '../utils/formatters.js';

const AdminExperienceBookingsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Acceso denegado. Inicia sesión como admin.</p></div>';
    }

    return `
      <div class="admin-properties-page">
        <div class="container">
          <h1>Reservas de excursiones</h1>

          <div class="dashboard-tabs">
            <button class="tab-btn active" onclick="filterExpBookings('')">Todas</button>
            <button class="tab-btn" onclick="filterExpBookings('pending_approval')">Pendientes</button>
            <button class="tab-btn" onclick="filterExpBookings('approved')">Aprobadas</button>
          </div>

          <div id="exp-bookings-list">
            <p class="loading">Cargando...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    window.filterExpBookings = async (status) => {
      document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
      event.target.classList.add('active');
      await this.load(status);
    };

    window.approveExpBooking = async (id) => {
      try {
        await api.post(`/admin/experience-bookings/${id}/approve`);
        await this.load('');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.rejectExpBooking = async (id) => {
      const reason = prompt('Motivo del rechazo:');
      if (reason === null) return;
      try {
        await api.post(`/admin/experience-bookings/${id}/reject`, { reason });
        await this.load('');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.contactOrganizerAboutBooking = async (id) => {
      try {
        const response = await api.get(`/admin/experience-bookings/${id}/organizer-whatsapp-link`);
        window.open(response.data.url, '_blank');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.contactTouristAboutBooking = async (id) => {
      try {
        const response = await api.get(`/admin/experience-bookings/${id}/tourist-contact-links`);
        if (response.data.whatsapp_url) window.open(response.data.whatsapp_url, '_blank');
        else if (response.data.mailto_url) window.open(response.data.mailto_url, '_blank');
        else alert('El turista no tiene teléfono ni email registrado.');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    await this.load('');
  },

  async load(status) {
    const list = document.getElementById('exp-bookings-list');
    list.innerHTML = '<p class="loading">Cargando...</p>';

    try {
      const url = status ? `/admin/experience-bookings?status=${status}` : '/admin/experience-bookings';
      const response = await api.get(url);
      const bookings = response.data?.bookings || [];

      if (bookings.length === 0) {
        list.innerHTML = '<p class="no-results">No hay reservas</p>';
        return;
      }

      list.innerHTML = bookings.map((b) => {
        const paymentSummary = (b.payment_info || [])
          .map((p) => `${p.num_spots}x ${p.audience === 'local' ? 'local' : 'turista'} ${formatExperiencePrice(p.amount, p.currency)}`)
          .join(', ');

        const hoursLeft = b.status === 'pending_approval'
          ? Math.max(0, Math.round((new Date(b.hold_expires_at) - new Date()) / (1000 * 60 * 60)))
          : null;

        return `
          <div class="property-list-item">
            <div class="property-info">
              <h3>${b.experience_id?.title || 'Excursión'}</h3>
              <p>${b.tourist_id?.name || 'Turista'} (${b.tourist_id?.email || ''}) · ${b.num_spots} cupo(s)</p>
              <p style="font-size:var(--fs-xs);color:var(--text-light);">${paymentSummary}</p>
              <span class="status-badge ${b.status}">${b.status.replace(/_/g, ' ')}</span>
              ${hoursLeft !== null ? `<span style="font-size:var(--fs-xs);color:var(--text-light);"> · vence en ~${hoursLeft}h</span>` : ''}
            </div>
            <div class="property-actions">
              ${b.status === 'pending_approval' ? `
                <button onclick="approveExpBooking('${b._id}')" class="btn btn-success btn-sm">Aprobar</button>
                <button onclick="rejectExpBooking('${b._id}')" class="btn btn-danger btn-sm">Rechazar</button>
              ` : ''}
              ${b.status === 'approved' ? `
                <button onclick="contactOrganizerAboutBooking('${b._id}')" class="btn btn-outline btn-sm">WhatsApp organizador</button>
                <button onclick="contactTouristAboutBooking('${b._id}')" class="btn btn-outline btn-sm">Avisar turista</button>
              ` : ''}
              ${b.status === 'rejected' ? `
                <button onclick="contactTouristAboutBooking('${b._id}')" class="btn btn-outline btn-sm">Avisar turista</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando reservas</p>';
    }
  },
};

export default AdminExperienceBookingsPage;
