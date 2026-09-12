import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const AdminUsersPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-users-page">
        <div class="container">
          <h1>${t('admin.hostManagementTitle')}</h1>
          
          <div class="dashboard-tabs">
            <button class="tab-btn active" onclick="filterHosts('')">${t('dashboard.all')}</button>
            <button class="tab-btn" onclick="filterHosts('pending')">${t('dashboard.pending')}</button>
            <button class="tab-btn" onclick="filterHosts('approved')">${t('dashboard.approved')}</button>
            <button class="tab-btn" onclick="filterHosts('rejected')">${t('booking.statusRejected')}</button>
          </div>
          
          <div id="hosts-list">
            <p class="loading">${t('admin.loadingHosts')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;
    const t = (key) => i18n.t(key);

    window.filterHosts = async (status) => {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      await this.loadHosts(status);
    };

    window.approveHost = async (id) => {
      try {
        await api.post(`/admin/hosts/${id}/approve`);
        alert(i18n.t('admin.hostApproved'));
        await this.loadHosts('');
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.rejectHost = async (id) => {
      const reason = prompt(i18n.t('admin.enterRejectionReason'));
      if (reason !== null) {
        try {
          await api.post(`/admin/hosts/${id}/reject`, { reason });
          alert(i18n.t('admin.hostRejected'));
          await this.loadHosts('');
        } catch (error) {
          alert(i18n.t('common.errorPrefix') + error.message);
        }
      }
    };

    window.suspendHost = async (id) => {
      if (confirm(i18n.t('admin.suspendConfirm'))) {
        try {
          await api.post(`/admin/hosts/${id}/suspend`);
          alert(i18n.t('admin.hostSuspended'));
          await this.loadHosts('');
        } catch (error) {
          alert(i18n.t('common.errorPrefix') + error.message);
        }
      }
    };

    window.deleteHost = async (id) => {
      if (confirm(i18n.t('admin.deleteHostConfirm'))) {
        try {
          await api.delete(`/admin/hosts/${id}`);
          alert(i18n.t('admin.hostDeleted'));
          await this.loadHosts('');
        } catch (error) {
          alert(i18n.t('common.errorPrefix') + error.message);
        }
      }
    };

    await this.loadHosts('');
  },

  async loadHosts(status) {
    const list = document.getElementById('hosts-list');
    list.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const url = status ? `/admin/hosts?host_status=${status}` : '/admin/hosts';
      const response = await api.get(url);
      const hosts = response.data?.hosts || [];

      if (hosts.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('admin.noHostsFound')}</p>`;
        return;
      }

      list.innerHTML = hosts.map(h => `
        <div class="property-list-item">
          <div class="property-list-item-summary" onclick="toggleHostDetail('${h._id}')">
            <div class="property-info">
              <h3>${h.name}</h3>
              <p>${h.email} | ${h.phone || i18n.t('admin.noPhone')}</p>
              <span class="status-badge ${h.host_status}">${h.host_status}</span>
              <span class="status-badge ${h.status}" style="margin-left:5px;">${h.status}</span>
            </div>
            <button type="button" class="btn btn-outline btn-sm property-detail-toggle">${i18n.t('admin.viewDetail')}</button>
          </div>

          <div class="property-detail-panel" id="host-detail-${h._id}" style="display:none;">
            <div class="property-detail-grid">
              <div>
                <h4>${i18n.t('admin.contactHeading')}</h4>
                <p>Email: ${h.email}</p>
                <p>${i18n.t('auth.phone')}: ${h.phone || i18n.t('admin.notRegistered')}</p>
                <p>WhatsApp: ${h.whatsapp_phone || (h.phone_whatsapp ? h.phone : i18n.t('admin.notRegistered'))}</p>

                <h4>${i18n.t('admin.bioProfileHeading')}</h4>
                <p>${h.profile?.bio || `<em>${i18n.t('admin.noBio')}</em>`}</p>
                <p>${i18n.t('admin.verifiedLabel')} ${h.profile?.verified ? i18n.t('admin.yes') : i18n.t('admin.no')}</p>
              </div>

              <div>
                <h4>${i18n.t('admin.accountHeading')}</h4>
                <p>${i18n.t('admin.regionLabel')} ${h.host_region || i18n.t('admin.na')}</p>
                <p>${i18n.t('admin.memberSince')} ${h.created_at ? new Date(h.created_at).toLocaleDateString(i18n.currentLang) : i18n.t('admin.na')}</p>
                <p>${i18n.t('admin.lastLogin')} ${h.auth?.last_login ? new Date(h.auth.last_login).toLocaleDateString(i18n.currentLang) : i18n.t('admin.never')}</p>
                ${h.host_status === 'rejected' && h.host_status_reason ? `<h4>${i18n.t('admin.rejectionReasonHeading')}</h4><p>${h.host_status_reason}</p>` : ''}
              </div>
            </div>
          </div>

          <div class="property-actions">
            ${h.host_status === 'pending' ? `
              <button onclick="approveHost('${h._id}')" class="btn btn-success btn-sm">${i18n.t('admin.approveBtn')}</button>
              <button onclick="rejectHost('${h._id}')" class="btn btn-danger btn-sm">${i18n.t('admin.rejectBtn')}</button>
            ` : ''}
            ${h.host_status === 'approved' ? `
              <button onclick="suspendHost('${h._id}')" class="btn btn-danger btn-sm">${i18n.t('admin.suspendBtn')}</button>
            ` : ''}
            <button onclick="deleteHost('${h._id}')" class="btn btn-danger btn-sm">${i18n.t('admin.deleteBtn')}</button>
          </div>
        </div>
      `).join('');

      window.toggleHostDetail = (id) => {
        const panel = document.getElementById(`host-detail-${id}`);
        if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      };
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('admin.errorLoadingHosts')}</p>`;
    }
  }
};

export default AdminUsersPage;
