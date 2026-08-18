import api from '../api.js';
import auth from '../auth.js';

const AdminOrganizersPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Acceso denegado. Inicia sesión como admin.</p></div>';
    }

    return `
      <div class="admin-properties-page">
        <div class="container">
          <h1>Organizadores</h1>

          <div class="dashboard-tabs">
            <button class="tab-btn active" onclick="filterOrganizers('')">Todos</button>
            <button class="tab-btn" onclick="filterOrganizers('pending')">Pendientes</button>
            <button class="tab-btn" onclick="filterOrganizers('approved')">Aprobados</button>
            <button class="tab-btn" onclick="filterOrganizers('rejected')">Rechazados</button>
          </div>

          <div id="organizers-list">
            <p class="loading">Cargando...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    window.filterOrganizers = async (status) => {
      document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
      event.target.classList.add('active');
      await this.load(status);
    };

    window.approveOrganizerAdmin = async (id) => {
      try {
        await api.post(`/admin/organizers/${id}/approve`);
        await this.load('');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.rejectOrganizerAdmin = async (id) => {
      const reason = prompt('Motivo del rechazo:');
      if (reason === null) return;
      try {
        await api.post(`/admin/organizers/${id}/reject`, { reason });
        await this.load('');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.suspendOrganizerAdmin = async (id) => {
      if (!confirm('¿Suspender a este organizador?')) return;
      try {
        await api.post(`/admin/organizers/${id}/suspend`);
        await this.load('');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.deleteOrganizerAdmin = async (id) => {
      if (!confirm('¿Eliminar este organizador? Esto es permanente.')) return;
      try {
        await api.delete(`/admin/organizers/${id}`);
        await this.load('');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    await this.load('');
  },

  async load(status) {
    const list = document.getElementById('organizers-list');
    list.innerHTML = '<p class="loading">Cargando...</p>';

    try {
      const url = status ? `/admin/organizers?organizer_status=${status}` : '/admin/organizers';
      const response = await api.get(url);
      const organizers = response.data?.organizers || [];

      if (organizers.length === 0) {
        list.innerHTML = '<p class="no-results">No hay organizadores</p>';
        return;
      }

      list.innerHTML = organizers.map((o) => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>${o.name}</h3>
            <p>${o.email} · ${o.phone || 'sin teléfono'}</p>
            <span class="status-badge ${o.organizer_status}">${o.organizer_status}</span>
          </div>
          <div class="property-actions">
            ${o.organizer_status === 'pending' ? `
              <button onclick="approveOrganizerAdmin('${o._id}')" class="btn btn-success btn-sm">Aprobar</button>
              <button onclick="rejectOrganizerAdmin('${o._id}')" class="btn btn-danger btn-sm">Rechazar</button>
            ` : ''}
            <button onclick="suspendOrganizerAdmin('${o._id}')" class="btn btn-outline btn-sm">Suspender</button>
            <button onclick="deleteOrganizerAdmin('${o._id}')" class="btn btn-danger btn-sm">Eliminar</button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando organizadores</p>';
    }
  },
};

export default AdminOrganizersPage;
