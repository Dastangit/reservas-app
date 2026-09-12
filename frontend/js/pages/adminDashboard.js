import api from '../api.js';
import { formatCurrency } from '../utils/formatters.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const AdminDashboardPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-dashboard">
        <div class="container">
          <h1>${t('admin.dashboard')}</h1>
          
          <div class="dashboard-stats">
            <div class="stat-card">
              <h3>${t('admin.totalProperties')}</h3>
              <p class="stat-number" id="total-properties">-</p>
            </div>
            <div class="stat-card">
              <h3>${t('admin.pendingProperties')}</h3>
              <p class="stat-number" id="pending-properties">-</p>
            </div>
            <div class="stat-card">
              <h3>${t('admin.pendingHosts')}</h3>
              <p class="stat-number" id="pending-hosts">-</p>
            </div>
            <div class="stat-card">
              <h3>${t('admin.totalUsers')}</h3>
              <p class="stat-number" id="total-users">-</p>
            </div>
          </div>
          
          <div class="dashboard-actions">
            <a href="/admin/properties" data-link class="btn btn-primary">${t('admin.manageProperties')}</a>
            <a href="/admin/users" data-link class="btn btn-outline">${t('admin.manageHosts')}</a>
            <a href="/admin/bookings" data-link class="btn btn-outline">${t('admin.manageBookings')}</a>
            <a href="/admin/feedback" data-link class="btn btn-outline">${t('admin.viewFeedback')}</a>
          </div>
          
          <div class="pending-section">
            <h2>${t('admin.pendingHostApprovals')}</h2>
            <div id="pending-hosts-list">
              <p class="loading">${t('common.loading')}</p>
            </div>
          </div>

          <div class="pending-section">
            <h2>${t('admin.pendingProperties')}</h2>
            <div id="pending-properties-list">
              <p class="loading">${t('common.loading')}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;
    const t = (key) => i18n.t(key);

    try {
      const [dashRes, hostsRes, propsRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/hosts?host_status=pending'),
        api.get('/admin/properties?status=pending_approval'),
      ]);

      const stats = dashRes.data?.stats;
      if (stats) {
        document.getElementById('total-properties').textContent = stats.total_properties;
        document.getElementById('pending-properties').textContent = stats.pending_approvals_properties;
        document.getElementById('total-users').textContent = stats.total_users;
      }

      const pendingHosts = hostsRes.data?.hosts || [];
      document.getElementById('pending-hosts').textContent = pendingHosts.length;

      const hostsListEl = document.getElementById('pending-hosts-list');
      if (pendingHosts.length === 0) {
        hostsListEl.innerHTML = `<p>${t('admin.noPendingHostApprovals')}</p>`;
      } else {
        hostsListEl.innerHTML = pendingHosts.map(h => `
          <div class="booking-list-item">
            <span>${h.name}</span>
            <span>${h.email}</span>
            <span>${new Date(h.created_at).toLocaleDateString(i18n.currentLang)}</span>
            <button onclick="approveHost('${h._id}')" class="btn btn-success btn-sm">${t('admin.approveBtn')}</button>
            <button onclick="rejectHost('${h._id}')" class="btn btn-danger btn-sm">${t('admin.rejectBtn')}</button>
          </div>
        `).join('');
      }

      const pendingProps = propsRes.data?.properties || [];
      const propsListEl = document.getElementById('pending-properties-list');
      if (pendingProps.length === 0) {
        propsListEl.innerHTML = `<p>${t('admin.noPendingProperties')}</p>`;
      } else {
        propsListEl.innerHTML = pendingProps.map(p => `
          <div class="booking-list-item">
            <span>${p.name}</span>
            <span>${p.host_id?.name || t('admin.hostFallback')}</span>
            <span>${p.location?.city}</span>
            <button onclick="approveProperty('${p._id}')" class="btn btn-success btn-sm">${t('admin.approveBtn')}</button>
            <button onclick="rejectProperty('${p._id}')" class="btn btn-danger btn-sm">${t('admin.rejectBtn')}</button>
          </div>
        `).join('');
      }

      window.approveHost = async (id) => {
        try {
          await api.post(`/admin/hosts/${id}/approve`);
          alert(i18n.t('admin.hostApproved'));
          window.location.reload();
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
            window.location.reload();
          } catch (error) {
            alert(i18n.t('common.errorPrefix') + error.message);
          }
        }
      };

      window.approveProperty = async (id) => {
        try {
          await api.post(`/admin/properties/${id}/approve`);
          alert(i18n.t('admin.propertyApproved'));
          window.location.reload();
        } catch (error) {
          alert(i18n.t('common.errorPrefix') + error.message);
        }
      };

      window.rejectProperty = async (id) => {
        const reason = prompt(i18n.t('admin.enterRejectionReason'));
        if (reason !== null) {
          try {
            await api.post(`/admin/properties/${id}/reject`, { reason });
            alert(i18n.t('admin.propertyRejected'));
            window.location.reload();
          } catch (error) {
            alert(i18n.t('common.errorPrefix') + error.message);
          }
        }
      };
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }
};

export default AdminDashboardPage;
