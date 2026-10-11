import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import { escapeHtml } from '../utils/escape.js';

const t = (key) => i18n.t(key);

// Etiqueta legible de la accion; si no hay traduccion se muestra el codigo.
const actionLabel = (action) => {
  const key = `auditLog.actions.${action}`;
  const label = i18n.t(key);
  return label === key ? action : label;
};

// metadata puede traer datos controlados por usuarios (nombre/email del host
// borrado, motivos...) y objetos: se serializa y se escapa SIEMPRE.
const formatMetadata = (metadata) => Object.entries(metadata)
  .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : v)}`)
  .join(' · ');

const AdminAuditLogPage = {
  currentPage: 1,

  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-audit-log-page">
        <div class="container">
          <h1>${t('auditLog.title')}</h1>
          <p class="page-subtitle">${t('auditLog.subtitle')}</p>

          <div class="dashboard-tabs">
            <button class="tab-btn active" data-target-type="">${t('auditLog.tabAll')}</button>
            <button class="tab-btn" data-target-type="Property">${t('auditLog.tabProperties')}</button>
            <button class="tab-btn" data-target-type="Booking">${t('auditLog.tabBookings')}</button>
            <button class="tab-btn" data-target-type="User">${t('auditLog.tabUsers')}</button>
            <button class="tab-btn" data-target-type="Experience">${t('auditLog.tabExperiences')}</button>
            <button class="tab-btn" data-target-type="OrphanedPayment">${t('auditLog.tabOrphaned')}</button>
            <button class="tab-btn" data-target-type="HostMonthlyCommission">${t('auditLog.tabCommissions')}</button>
          </div>

          <div id="audit-log-list">
            <p class="loading">${t('common.loading')}</p>
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

    window.auditLogPrevPage = () => this.loadLog(this.activeType(), this.currentPage - 1);
    window.auditLogNextPage = () => this.loadLog(this.activeType(), this.currentPage + 1);

    await this.loadLog('');
  },

  activeType() {
    return document.querySelector('.tab-btn.active')?.dataset.targetType || '';
  },

  async loadLog(targetType, page = 1) {
    const list = document.getElementById('audit-log-list');
    const pagination = document.getElementById('audit-log-pagination');
    if (!list) return;

    list.innerHTML = `<p class="loading">${t('common.loading')}</p>`;

    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (targetType) params.append('target_type', targetType);

      const response = await api.get(`/admin/audit-log?${params.toString()}`);
      const { logs, total, pages } = response.data;

      if (!logs || logs.length === 0) {
        list.innerHTML = `<p class="no-results">${t('auditLog.empty')}</p>`;
        pagination.innerHTML = '';
        return;
      }

      list.innerHTML = logs.map((log) => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>${escapeHtml(actionLabel(log.action))}</h3>
            <p>${escapeHtml(log.admin_id?.name || t('auditLog.unknownAdmin'))} (${escapeHtml(log.admin_id?.email || 'N/A')})</p>
            <p style="font-size:var(--fs-xs);color:var(--text-light);">
              ${log.target_type ? `${escapeHtml(log.target_type)} · ` : ''}${new Date(log.created_at).toLocaleString(i18n.currentLang)}
            </p>
            ${log.metadata && Object.keys(log.metadata).length > 0 ? `
              <p style="font-size:var(--fs-xs);color:var(--text-light);">${formatMetadata(log.metadata)}</p>
            ` : ''}
          </div>
        </div>
      `).join('');

      this.currentPage = page;
      pagination.innerHTML = pages > 1 ? `
        <button class="btn btn-outline btn-sm" ${page <= 1 ? 'disabled' : ''} data-action="auditLogPrevPage">← ${t('auditLog.prev')}</button>
        <span style="margin:0 10px;">${t('auditLog.pageOf').replace('{page}', page).replace('{pages}', pages).replace('{total}', total)}</span>
        <button class="btn btn-outline btn-sm" ${page >= pages ? 'disabled' : ''} data-action="auditLogNextPage">${t('auditLog.next')} →</button>
      ` : `<p style="text-align:center;color:var(--text-light);font-size:var(--fs-sm);">${t('auditLog.totalRecords').replace('{total}', total)}</p>`;
    } catch (error) {
      list.innerHTML = `<p class="error">${t('auditLog.loadError')}</p>`;
    }
  }
};

export default AdminAuditLogPage;
