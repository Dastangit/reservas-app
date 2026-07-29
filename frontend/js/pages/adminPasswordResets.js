import api from '../api.js';
import auth from '../auth.js';

const AdminPasswordResetsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Access denied. Please login as admin.</p></div>';
    }

    return `
      <div class="admin-password-resets-page">
        <div class="container">
          <h1>Solicitudes de restablecimiento de contrase\u00f1a</h1>
          <p class="page-subtitle">
            No hay env\u00edo autom\u00e1tico de email -- genera el link real y entr\u00e9galo manualmente
            por WhatsApp o correo. El link expira en 1 hora desde que lo generas aqu\u00ed.
          </p>

          <div id="password-resets-list">
            <p class="loading">Cargando...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    await this.loadRequests();

    window.deliverPasswordReset = async (userId, method) => {
      try {
        const response = await api.get(`/admin/password-resets/${userId}/delivery-links`);
        const url = method === 'whatsapp' ? response.data?.whatsapp_url : response.data?.mailto_url;
        if (url) {
          if (method === 'whatsapp') window.open(url, '_blank');
          else window.location.href = url;
        } else {
          alert(`El usuario no tiene ${method === 'whatsapp' ? 'tel\u00e9fono' : 'email'} registrado.`);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };
  },

  async loadRequests() {
    const list = document.getElementById('password-resets-list');
    if (!list) return;

    try {
      const response = await api.get('/admin/password-resets');
      const requests = response.data?.requests || [];

      if (requests.length === 0) {
        list.innerHTML = '<p class="no-results">No hay solicitudes pendientes.</p>';
        return;
      }

      list.innerHTML = requests.map((r) => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>${r.name} <span class="status-badge pending">${r.role}</span></h3>
            <p>${r.email} ${r.phone ? '\u00b7 ' + r.phone : ''}</p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);">Expira: ${new Date(r.expires_at).toLocaleString()}</p>
          </div>
          <div class="property-actions">
            <button onclick="deliverPasswordReset('${r.user_id}', 'whatsapp')" class="btn btn-outline btn-sm">WhatsApp</button>
            <button onclick="deliverPasswordReset('${r.user_id}', 'mailto')" class="btn btn-outline btn-sm">Correo</button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando solicitudes</p>';
    }
  }
};

export default AdminPasswordResetsPage;
