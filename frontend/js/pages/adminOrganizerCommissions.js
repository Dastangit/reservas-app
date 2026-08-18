import api from '../api.js';
import auth from '../auth.js';

const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const statusLabels = {
  pending: 'Pendiente',
  reminded_day3: 'Recordatorio enviado (día 3)',
  warned_day6: 'Advertencia enviada (día 6)',
  overdue: 'Vencido (10+ días)',
  paid: 'Pagado',
  waived: 'Exonerado',
};

const AdminOrganizerCommissionsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Acceso denegado. Inicia sesión como admin.</p></div>';
    }

    return `
      <div class="admin-host-commissions-page">
        <div class="container">
          <h1>Comisiones mensuales de organizadores</h1>
          <p class="page-subtitle">
            10% sobre lo que cada organizador cobró a sus clientes -- desglosado por moneda
            (CUP/USD/USDT), sin conversión entre sí. El día 10+ solo queda marcado "vencido";
            la decisión de qué hacer la tomás vos manualmente.
          </p>

          <div class="dashboard-tabs">
            <button class="tab-btn" data-tab="pending">Pendientes</button>
            <button class="tab-btn active" data-tab="overdue">Vencidas</button>
            <button class="tab-btn" data-tab="paid">Pagadas</button>
            <button class="tab-btn" data-tab="">Todas</button>
          </div>

          <div id="organizer-commissions-list">
            <p class="loading">Cargando...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        this.loadCommissions(e.target.dataset.tab);
      });
    });

    await this.loadCommissions('overdue');

    window.notifyOrganizerCommissionWhatsApp = async (id) => {
      try {
        const response = await api.get(`/admin/organizer-commissions/${id}/whatsapp-link`);
        const url = response.data?.url;
        if (url) window.open(url, '_blank');
        else alert('El organizador no tiene un teléfono registrado.');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.markOrganizerCommissionPaid = async (id) => {
      const method = prompt('¿Cómo se pagó? (ej. transferencia, efectivo)', 'manual');
      if (method === null) return;
      try {
        await api.post(`/admin/organizer-commissions/${id}/paid`, { method });
        alert('Marcado como pagado');
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'overdue';
        this.loadCommissions(activeTab);
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };

    window.waiveOrganizerCommission = async (id) => {
      const reason = prompt('¿Motivo de la exoneración?', 'Periodo de prueba');
      if (reason === null) return;
      try {
        await api.post(`/admin/organizer-commissions/${id}/waive`, { reason });
        alert('Marcado como exonerado');
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'overdue';
        this.loadCommissions(activeTab);
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };
  },

  async loadCommissions(status = '') {
    const list = document.getElementById('organizer-commissions-list');
    if (!list) return;

    list.innerHTML = '<p class="loading">Cargando...</p>';

    try {
      const params = status ? `?status=${status}` : '';
      const response = await api.get(`/admin/organizer-commissions${params}`);
      const commissions = response.data?.commissions || [];

      if (commissions.length === 0) {
        list.innerHTML = '<p class="no-results">No hay comisiones en esta categoría</p>';
        return;
      }

      list.innerHTML = commissions.map((c) => `
        <div class="commission-item commission-status-${c.status}">
          <div class="commission-header">
            <span class="commission-host">${c.organizer_id?.name || 'Organizador desconocido'}</span>
            <span class="commission-period">${monthNames[c.month]} ${c.year}</span>
            <span class="badge-status">${statusLabels[c.status] || c.status}</span>
          </div>
          <div class="commission-body">
            ${(c.totals || []).map((t) => `
              <p><strong>${t.currency}:</strong> total ${t.total_amount} -- comisión (10%): ${t.commission_amount}</p>
            `).join('')}
            <p><strong>Reservas incluidas:</strong> ${c.experience_bookings?.length || 0}</p>
            ${c.notes ? `<p><strong>Notas:</strong> ${c.notes}</p>` : ''}
          </div>
          ${!['paid', 'waived'].includes(c.status) ? `
            <div class="commission-actions">
              <button onclick="notifyOrganizerCommissionWhatsApp('${c._id}')" class="btn btn-outline btn-sm">WhatsApp al organizador</button>
              <button onclick="markOrganizerCommissionPaid('${c._id}')" class="btn btn-success btn-sm">Marcar pagado</button>
              <button onclick="waiveOrganizerCommission('${c._id}')" class="btn btn-outline btn-sm">Exonerar</button>
            </div>
          ` : ''}
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando comisiones</p>';
    }
  },
};

export default AdminOrganizerCommissionsPage;
