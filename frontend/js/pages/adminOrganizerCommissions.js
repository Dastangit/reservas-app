import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const AdminOrganizerCommissionsPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-host-commissions-page">
        <div class="container">
          <h1>${t('admin.organizerCommissionsTitle')}</h1>
          <p class="page-subtitle">${t('admin.organizerCommissionsSubtitle')}</p>

          <div class="dashboard-tabs">
            <button class="tab-btn" data-tab="pending">${t('dashboard.pending')}</button>
            <button class="tab-btn active" data-tab="overdue">${t('admin.overdueTab')}</button>
            <button class="tab-btn" data-tab="paid">${t('admin.paidTab')}</button>
            <button class="tab-btn" data-tab="">${t('dashboard.all')}</button>
          </div>

          <div id="organizer-commissions-list">
            <p class="loading">${t('common.loading')}</p>
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
        else alert(i18n.t('admin.organizerNoPhoneRegistered'));
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.markOrganizerCommissionPaid = async (id) => {
      const method = prompt(i18n.t('admin.paymentMethodPrompt'), 'manual');
      if (method === null) return;
      try {
        await api.post(`/admin/organizer-commissions/${id}/paid`, { method });
        alert(i18n.t('admin.markedPaid'));
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'overdue';
        this.loadCommissions(activeTab);
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.waiveOrganizerCommission = async (id) => {
      const reason = prompt(i18n.t('admin.waiveReasonPrompt'), 'Periodo de prueba');
      if (reason === null) return;
      try {
        await api.post(`/admin/organizer-commissions/${id}/waive`, { reason });
        alert(i18n.t('admin.markedWaived'));
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'overdue';
        this.loadCommissions(activeTab);
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };
  },

  async loadCommissions(status = '') {
    const list = document.getElementById('organizer-commissions-list');
    if (!list) return;

    const monthNames = i18n.t('admin.months');
    const statusLabels = i18n.t('admin.commissionStatusLabels');

    list.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const params = status ? `?status=${status}` : '';
      const response = await api.get(`/admin/organizer-commissions${params}`);
      const commissions = response.data?.commissions || [];

      if (commissions.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('admin.noCommissionsFound')}</p>`;
        return;
      }

      list.innerHTML = commissions.map((c) => `
        <div class="commission-item commission-status-${c.status}">
          <div class="commission-header">
            <span class="commission-host">${c.organizer_id?.name || i18n.t('admin.organizerUnknownFallback')}</span>
            <span class="commission-period">${monthNames[c.month]} ${c.year}</span>
            <span class="badge-status">${statusLabels[c.status] || c.status}</span>
          </div>
          <div class="commission-body">
            ${(c.totals || []).map((t) => `
              <p><strong>${t.currency}:</strong> ${i18n.t('admin.totalWord')} ${t.total_amount} -- ${i18n.t('admin.commissionPercentSuffix')} ${t.commission_amount}</p>
            `).join('')}
            <p><strong>${i18n.t('admin.bookingsIncludedLabel')}</strong> ${c.experience_bookings?.length || 0}</p>
            ${c.notes ? `<p><strong>${i18n.t('admin.notesLabel')}</strong> ${c.notes}</p>` : ''}
          </div>
          ${!['paid', 'waived'].includes(c.status) ? `
            <div class="commission-actions">
              <button onclick="notifyOrganizerCommissionWhatsApp('${c._id}')" class="btn btn-outline btn-sm">${i18n.t('admin.whatsappOrganizerBtn')}</button>
              <button onclick="markOrganizerCommissionPaid('${c._id}')" class="btn btn-success btn-sm">${i18n.t('admin.markPaidBtn')}</button>
              <button onclick="waiveOrganizerCommission('${c._id}')" class="btn btn-outline btn-sm">${i18n.t('admin.waiveBtn')}</button>
            </div>
          ` : ''}
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('admin.errorLoadingCommissions')}</p>`;
    }
  },
};

export default AdminOrganizerCommissionsPage;
