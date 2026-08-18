import api from '../api.js';
import auth from '../auth.js';

const actionLabels = {
  approve_property: 'Aprob\u00f3 propiedad',
  reject_property: 'Rechaz\u00f3 propiedad',
  approve_host: 'Aprob\u00f3 host',
  reject_host: 'Rechaz\u00f3 host',
  suspend_host: 'Suspendi\u00f3 host',
  delete_host: 'Elimin\u00f3 host',
  review_orphaned_payment: 'Revis\u00f3 pago hu\u00e9rfano',
  mark_host_commission_paid: 'Marc\u00f3 comisi\u00f3n pagada',
  waive_host_commission: 'Exoner\u00f3 comisi\u00f3n',
  '2fa_enabled': 'Activ\u00f3 2FA',
  '2fa_disabled': 'Desactiv\u00f3 2FA',
};

const AdminAuditLogPage = {
  currentPage: 1,

  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Access denied. Please login as admin.</p></div>';
    }

    return `
      <div class="admin-audit-log-page">
        <div class="container">
          <h1>Registro de acciones admin</h1>
          <p class="page-subtitle">
            Historial de acciones sensibles (aprobar/rechazar, comisiones, pagos hu\u00e9rfanos) --
            qui\u00e9n hizo qu\u00e9 y cu\u00e1ndo.
          </p>

          <div class="dashboard-tabs">
            <button class="tab-btn active" data-target-type="">Todos</button>
            <button class="tab-btn" data-target-type="Property">Propiedades</button>
            <button class="tab-btn" data-target-type="User">Usuarios/Hosts</button>
            <button class="tab-btn" data-target-type="OrphanedPayment">Pagos hu\u00e9rfanos</button>
            <button class="tab-btn" data-target-type="HostMonthlyCommission">Comisiones</button>
          </div>

          <div id="audit-log-list">
            <p class="loading">Cargando...</p>
          </div>

          <div id="audit-log-pagination" class="pagination-controls"></div>
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
        this.currentPage = 1;
        this.loadLog(e.target.dataset.targetType);
      });
    });

    await this.loadLog('');
  },

  async loadLog(targetType, page = 1) {
    const list = document.getElementById('audit-log-list');
    const pagination = document.getElementById('audit-log-pagination');
    if (!list) return;

    list.innerHTML = '<p class="loading">Cargando...</p>';

    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (targetType) params.append('target_type', targetType);

      const response = await api.get(`/admin/audit-log?${params.toString()}`);
      const { logs, total, pages } = response.data;

      if (!logs || logs.length === 0) {
        list.innerHTML = '<p class="no-results">No hay registros para este filtro.</p>';
        pagination.innerHTML = '';
        return;
      }

      list.innerHTML = logs.map((log) => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>${actionLabels[log.action] || log.action}</h3>
            <p>${log.admin_id?.name || 'Admin desconocido'} (${log.admin_id?.email || 'N/A'})</p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);">
              ${log.target_type ? `${log.target_type} \u00b7 ` : ''}${new Date(log.created_at).toLocaleString()}
            </p>
            ${log.metadata && Object.keys(log.metadata).length > 0 ? `
              <p style="font-size:var(--fs-xs);color:var(--text-light);">
                ${Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(' \u00b7 ')}
              </p>
            ` : ''}
          </div>
        </div>
      `).join('');

      this.currentPage = page;
      pagination.innerHTML = pages > 1 ? `
        <button class="btn btn-outline btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="window.auditLogPrevPage()">\u2190 Anterior</button>
        <span style="margin:0 10px;">P\u00e1gina ${page} de ${pages} (${total} registros)</span>
        <button class="btn btn-outline btn-sm" ${page >= pages ? 'disabled' : ''} onclick="window.auditLogNextPage()">Siguiente \u2192</button>
      ` : `<p style="text-align:center;color:var(--text-light);font-size:var(--fs-sm);">${total} registro${total === 1 ? '' : 's'}</p>`;

      const activeTab = document.querySelector('.tab-btn.active');
      window.auditLogPrevPage = () => this.loadLog(activeTab?.dataset.targetType || '', this.currentPage - 1);
      window.auditLogNextPage = () => this.loadLog(activeTab?.dataset.targetType || '', this.currentPage + 1);
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando el registro</p>';
    }
  }
};

export default AdminAuditLogPage;
