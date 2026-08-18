import api from '../api.js';
import auth from '../auth.js';

const OrganizerRecurrencesPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) {
      return '<div class="container"><p>Acceso denegado. Inicia sesión como organizador.</p></div>';
    }

    return `
      <div class="manage-properties-page">
        <div class="container">
          <div class="page-header">
            <h1>Mis excursiones recurrentes</h1>
            <a href="/organizer/recurrences/new" data-link class="btn btn-primary">+ Nueva serie</a>
          </div>
          <div id="recurrences-list">
            <p class="loading">Cargando...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isOrganizer()) return;

    window.pauseRecurrence = async (id) => {
      await api.post(`/organizer/recurrences/${id}/pause`);
      await this.load();
    };
    window.endRecurrence = async (id) => {
      if (!confirm('¿Terminar esta serie? No se generarán más ocurrencias.')) return;
      await api.post(`/organizer/recurrences/${id}/end`);
      await this.load();
    };
    window.viewOccurrences = async (id) => {
      const response = await api.get(`/organizer/recurrences/${id}/occurrences`);
      const occurrences = response.data?.occurrences || [];
      const summary = occurrences.map((o) => `${new Date(o.date).toLocaleString()} -- ${o.status}`).join('\n');
      alert(summary || 'Todavía no hay ocurrencias generadas.');
    };

    await this.load();
  },

  async load() {
    const list = document.getElementById('recurrences-list');
    try {
      // No hay endpoint dedicado "mis recurrencias" en el plan -- se
      // infieren desde /organizer/experiences filtrando por recurrence_id.
      const response = await api.get('/organizer/experiences');
      const experiences = response.data?.experiences || [];
      const recurrenceIds = [...new Set(experiences.filter((e) => e.recurrence_id).map((e) => e.recurrence_id))];

      if (recurrenceIds.length === 0) {
        list.innerHTML = '<p class="no-results">Todavía no creaste ninguna excursión recurrente.</p>';
        return;
      }

      list.innerHTML = recurrenceIds.map((id) => {
        const occurrences = experiences.filter((e) => e.recurrence_id === id);
        const sample = occurrences[0];
        return `
          <div class="property-list-item">
            <div class="property-info">
              <h3>${sample.title}</h3>
              <p>${sample.location?.city || ''} · ${occurrences.length} ocurrencias generadas</p>
            </div>
            <div class="property-actions">
              <button class="btn btn-outline btn-sm" onclick="viewOccurrences('${id}')">Ver ocurrencias</button>
              <button class="btn btn-outline btn-sm" onclick="pauseRecurrence('${id}')">Pausar</button>
              <button class="btn btn-danger btn-sm" onclick="endRecurrence('${id}')">Terminar</button>
            </div>
          </div>
        `;
      }).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando series recurrentes</p>';
    }
  },
};

export default OrganizerRecurrencesPage;
