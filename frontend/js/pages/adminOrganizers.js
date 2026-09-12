import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const AdminOrganizersPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-properties-page">
        <div class="container">
          <h1>${t('admin.organizersTitle')}</h1>

          <div class="dashboard-tabs">
            <button class="tab-btn active" onclick="filterOrganizers('')">${t('dashboard.all')}</button>
            <button class="tab-btn" onclick="filterOrganizers('pending')">${t('dashboard.pending')}</button>
            <button class="tab-btn" onclick="filterOrganizers('approved')">${t('dashboard.approved')}</button>
            <button class="tab-btn" onclick="filterOrganizers('rejected')">${t('booking.statusRejected')}</button>
          </div>

          <div id="organizers-list">
            <p class="loading">${t('common.loading')}</p>
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
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.rejectOrganizerAdmin = async (id) => {
      const reason = prompt(i18n.t('admin.enterRejectionReason'));
      if (reason === null) return;
      try {
        await api.post(`/admin/organizers/${id}/reject`, { reason });
        await this.load('');
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.suspendOrganizerAdmin = async (id) => {
      if (!confirm(i18n.t('admin.suspendOrganizerConfirm'))) return;
      try {
        await api.post(`/admin/organizers/${id}/suspend`);
        await this.load('');
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.deleteOrganizerAdmin = async (id) => {
      if (!confirm(i18n.t('admin.deleteOrganizerConfirm'))) return;
      try {
        await api.delete(`/admin/organizers/${id}`);
        await this.load('');
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    await this.load('');
  },

  async load(status) {
    const list = document.getElementById('organizers-list');
    list.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const url = status ? `/admin/organizers?organizer_status=${status}` : '/admin/organizers';
      const response = await api.get(url);
      const organizers = response.data?.organizers || [];

      if (organizers.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('admin.noOrganizersFound')}</p>`;
        return;
      }

      list.innerHTML = organizers.map((o) => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>${o.name}</h3>
            <p>${o.email} · ${o.phone || i18n.t('admin.noPhone')}</p>
            <span class="status-badge ${o.organizer_status}">${o.organizer_status}</span>
          </div>
          <div class="property-actions">
            ${o.organizer_status === 'pending' ? `
              <button onclick="approveOrganizerAdmin('${o._id}')" class="btn btn-success btn-sm">${i18n.t('admin.approveBtn')}</button>
              <button onclick="rejectOrganizerAdmin('${o._id}')" class="btn btn-danger btn-sm">${i18n.t('admin.rejectBtn')}</button>
            ` : ''}
            <button onclick="suspendOrganizerAdmin('${o._id}')" class="btn btn-outline btn-sm">${i18n.t('admin.suspendBtn')}</button>
            <button onclick="deleteOrganizerAdmin('${o._id}')" class="btn btn-danger btn-sm">${i18n.t('admin.deleteBtn')}</button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('admin.errorLoadingOrganizers')}</p>`;
    }
  },
};

export default AdminOrganizersPage;
