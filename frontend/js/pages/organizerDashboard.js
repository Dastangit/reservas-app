import api from '../api.js';
import auth from '../auth.js';

const OrganizerDashboardPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) {
      return '<div class="container"><p>Acceso denegado. Inicia sesión como organizador.</p></div>';
    }

    return `
      <div class="dashboard-page host-dashboard">
        <div class="container">
          <h1>Panel de organizador</h1>

          <div class="dashboard-stats">
            <div class="stat-card">
              <h3>Mis excursiones</h3>
              <p class="stat-number" id="experiences-count">-</p>
            </div>
            <div class="stat-card">
              <h3>Reservas pendientes</h3>
              <p class="stat-number" id="pending-count">-</p>
            </div>
            <div class="stat-card">
              <h3>Reservas aprobadas</h3>
              <p class="stat-number" id="approved-count">-</p>
            </div>
          </div>

          <div class="dashboard-actions">
            <a href="/organizer/experiences/new" data-link class="btn btn-primary">Nueva excursión</a>
            <a href="/organizer/recurrences/new" data-link class="btn btn-outline">Nueva excursión recurrente</a>
            <a href="/organizer/experiences" data-link class="btn btn-outline">Mis excursiones</a>
            <a href="/organizer/bookings" data-link class="btn btn-outline">Ver reservas</a>
          </div>

          <div class="recent-bookings">
            <h2>Reservas recientes</h2>
            <div id="recent-bookings-list">
              <p class="loading">Cargando...</p>
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
        recentList.innerHTML = '<p>Todavía no hay reservas</p>';
      } else {
        recentList.innerHTML = recent.map((b) => `
          <div class="booking-list-item">
            <span>${b.experience_id?.title || 'Excursión'}</span>
            <span>${b.num_spots} cupo(s)</span>
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
