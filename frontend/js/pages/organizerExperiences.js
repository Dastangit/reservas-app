import api from '../api.js';
import auth from '../auth.js';

const OrganizerExperiencesPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) {
      return '<div class="container"><p>Acceso denegado. Inicia sesión como organizador.</p></div>';
    }

    return `
      <div class="manage-properties-page">
        <div class="container">
          <div class="page-header">
            <h1>Mis excursiones</h1>
            <a href="/organizer/experiences/new" data-link class="btn btn-primary">+ Nueva excursión</a>
          </div>
          <div id="experiences-list">
            <p class="loading">Cargando...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) return;

    const list = document.getElementById('experiences-list');
    try {
      const response = await api.get('/organizer/experiences');
      const experiences = response.data?.experiences || [];

      if (experiences.length === 0) {
        list.innerHTML = '<p class="no-results">Todavía no creaste ninguna excursión.</p>';
        return;
      }

      list.innerHTML = experiences.map((exp) => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>${exp.title}${exp.recurrence_id ? ' <span class="audit-log-badge">recurrente</span>' : ''}</h3>
            <p>${exp.location?.city || ''} · ${new Date(exp.date).toLocaleDateString()}</p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);">
              ${exp.current_participants}/${exp.max_participants} cupos · status: ${exp.status}
            </p>
          </div>
          <div class="property-actions">
            <a href="/organizer/experiences/${exp._id}/edit" data-link class="btn btn-outline btn-sm">Editar</a>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando excursiones</p>';
    }
  },
};

export default OrganizerExperiencesPage;
