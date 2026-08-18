import api from '../api.js';
import auth from '../auth.js';
import { formatExperiencePrice } from '../utils/formatters.js';

const AdminExperiencesPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Acceso denegado. Inicia sesión como admin.</p></div>';
    }

    return `
      <div class="admin-properties-page">
        <div class="container">
          <h1>Excursiones pendientes de aprobación</h1>
          <p style="color:var(--text-light);">Incluye excursiones únicas y ocurrencias generadas por series recurrentes -- cada una se aprueba individualmente.</p>
          <div id="experiences-list">
            <p class="loading">Cargando...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    window.approveExperienceAdmin = async (id) => {
      try {
        await api.post(`/admin/experiences/${id}/approve`);
        await this.load();
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.rejectExperienceAdmin = async (id) => {
      const reason = prompt('Motivo del rechazo:');
      if (reason === null) return;
      try {
        await api.post(`/admin/experiences/${id}/reject`, { reason });
        await this.load();
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    await this.load();
  },

  async load() {
    const list = document.getElementById('experiences-list');
    list.innerHTML = '<p class="loading">Cargando...</p>';

    try {
      const response = await api.get('/admin/experiences/pending');
      const experiences = response.data?.experiences || [];

      if (experiences.length === 0) {
        list.innerHTML = '<p class="no-results">No hay excursiones pendientes.</p>';
        return;
      }

      list.innerHTML = experiences.map((exp) => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>
              ${exp.title}${exp.recurrence_id ? ' <span class="audit-log-badge">ocurrencia recurrente</span>' : ''}
              ${exp.allows_mixed_audience ? ' <span class="audit-log-badge" style="border-color:#c0392b;color:#c0392b;">⚠ mezcla local+turista</span>' : ''}
            </h3>
            <p>${exp.location?.city || ''} · ${new Date(exp.date).toLocaleString()}</p>
            <p>Organizador: ${exp.organizer_id?.name || 'Desconocido'} (${exp.organizer_id?.email || 'sin email'})</p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);">
              ${(exp.pricing || []).map((p) => `${p.audience === 'local' ? 'local' : 'turista'}: ${formatExperiencePrice(p.amount, p.currency)}`).join(' · ')}
            </p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);">Cupos máx: ${exp.max_participants}</p>
          </div>
          <div class="property-actions">
            <button onclick="approveExperienceAdmin('${exp._id}')" class="btn btn-success btn-sm">Aprobar</button>
            <button onclick="rejectExperienceAdmin('${exp._id}')" class="btn btn-danger btn-sm">Rechazar</button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando excursiones</p>';
    }
  },
};

export default AdminExperiencesPage;
