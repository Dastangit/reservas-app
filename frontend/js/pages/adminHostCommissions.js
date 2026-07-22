import api from '../api.js';
import auth from '../auth.js';

const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const statusLabels = {
  pending: 'Pendiente',
  reminded_day3: 'Recordatorio enviado (d\u00eda 3)',
  warned_day6: 'Advertencia enviada (d\u00eda 6)',
  overdue: 'Vencido (10+ d\u00edas)',
  paid: 'Pagado',
  waived: 'Exonerado',
};

const AdminHostCommissionsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Access denied. Please login as admin.</p></div>';
    }

    return `
      <div class="admin-host-commissions-page">
        <div class="container">
          <h1>Comisiones mensuales de hosts</h1>
          <p class="page-subtitle">
            10% sobre reservas Opci\u00f3n B (efectivo directo al host). El d\u00eda 10+ solo
            queda marcado "vencido" -- la suspensi\u00f3n del host, si aplica, la decides t\u00fa manualmente
            desde la secci\u00f3n de Hosts.
          </p>

          <div class="dashboard-tabs">
            <button class="tab-btn" data-tab="pending">Pendientes</button>
            <button class="tab-btn active" data-tab="overdue">Vencidas</button>
            <button class="tab-btn" data-tab="paid">Pagadas</button>
            <button class="tab-btn" data-tab="">Todas</button>
          </div>

          <div id="commissions-list">
            <p class="loading">Cargando...</p>
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
        this.loadCommissions(e.target.dataset.tab);
      });
    });

    await this.loadCommissions('overdue');

    window.notifyHostCommissionWhatsApp = async (id) => {
      try {
        const response = await api.get(`/admin/host-commissions/${id}/whatsapp-link`);
        const url = response.data?.url;
        if (url) {
          window.open(url, '_blank');
        } else {
          alert('El host no tiene un tel\u00e9fono registrado.');
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.markCommissionPaid = async (id) => {
      const method = prompt('\u00bfC\u00f3mo se pag\u00f3? (ej. transferencia, efectivo)', 'manual');
      if (method === null) return;
      try {
        await api.post(`/admin/host-commissions/${id}/paid`, { method });
        alert('Marcado como pagado');
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'overdue';
        this.loadCommissions(activeTab);
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.waiveCommission = async (id) => {
      const reason = prompt('\u00bfMotivo de la exoneraci\u00f3n?', 'Periodo de prueba');
      if (reason === null) return;
      try {
        await api.post(`/admin/host-commissions/${id}/waive`, { reason });
        alert('Marcado como exonerado');
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'overdue';
        this.loadCommissions(activeTab);
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };
  },

  async loadCommissions(status = '') {
    const list = document.getElementById('commissions-list');
    if (!list) return;

    list.innerHTML = '<p class="loading">Cargando...</p>';

    try {
      const params = status ? `?status=${status}` : '';
      const response = await api.get(`/admin/host-commissions${params}`);
      const commissions = response.data?.commissions || [];

      if (commissions.length === 0) {
        list.innerHTML = '<p class="no-results">No hay comisiones en esta categor\u00eda</p>';
        return;
      }

      list.innerHTML = commissions.map(c => `
        <div class="commission-item commission-status-${c.status}">
          <div class="commission-header">
            <span class="commission-host">${c.host_id?.name || 'Host desconocido'}</span>
            <span class="commission-period">${monthNames[c.month]} ${c.year}</span>
            <span class="badge-status">${statusLabels[c.status] || c.status}</span>
          </div>
          <div class="commission-body">
            <p><strong>Total reservas (efectivo):</strong> $${c.total_amount} USD</p>
            <p><strong>Comisi\u00f3n (10%):</strong> $${c.commission_amount} USD</p>
            <p><strong>Reservas incluidas:</strong> ${c.bookings?.length || 0}</p>
            ${c.notes ? `<p><strong>Notas:</strong> ${c.notes}</p>` : ''}
          </div>
          ${!['paid', 'waived'].includes(c.status) ? `
            <div class="commission-actions">
              <button onclick="notifyHostCommissionWhatsApp('${c._id}')" class="btn btn-outline btn-sm">WhatsApp al host</button>
              <button onclick="markCommissionPaid('${c._id}')" class="btn btn-success btn-sm">Marcar pagado</button>
              <button onclick="waiveCommission('${c._id}')" class="btn btn-outline btn-sm">Exonerar</button>
            </div>
          ` : ''}
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando comisiones</p>';
    }
  }
};

export default AdminHostCommissionsPage;
