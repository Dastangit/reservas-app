import api from '../api.js';
import { formatCurrency } from '../utils/formatters.js';
import auth from '../auth.js';

const AdminDashboardPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Access denied. Please login as admin.</p></div>';
    }

    return `
      <div class="admin-dashboard">
        <div class="container">
          <h1>Admin Dashboard</h1>
          
          <div class="dashboard-stats">
            <div class="stat-card">
              <h3>Total Properties</h3>
              <p class="stat-number" id="total-properties">-</p>
            </div>
            <div class="stat-card">
              <h3>Pending Properties</h3>
              <p class="stat-number" id="pending-properties">-</p>
            </div>
            <div class="stat-card">
              <h3>Pending Hosts</h3>
              <p class="stat-number" id="pending-hosts">-</p>
            </div>
            <div class="stat-card">
              <h3>Total Users</h3>
              <p class="stat-number" id="total-users">-</p>
            </div>
          </div>
          
          <div class="dashboard-actions">
            <a href="/admin/properties" data-link class="btn btn-primary">Manage Properties</a>
            <a href="/admin/users" data-link class="btn btn-outline">Manage Hosts</a>
            <a href="/admin/bookings" data-link class="btn btn-outline">Manage Bookings</a>
            <a href="/admin/feedback" data-link class="btn btn-outline">View Feedback</a>
          </div>
          
          <div class="pending-section">
            <h2>Pending Host Approvals</h2>
            <div id="pending-hosts-list">
              <p class="loading">Loading...</p>
            </div>
          </div>

          <div class="pending-section">
            <h2>Pending Properties</h2>
            <div id="pending-properties-list">
              <p class="loading">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

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
        hostsListEl.innerHTML = '<p>No pending host approvals</p>';
      } else {
        hostsListEl.innerHTML = pendingHosts.map(h => `
          <div class="booking-list-item">
            <span>${h.name}</span>
            <span>${h.email}</span>
            <span>${new Date(h.created_at).toLocaleDateString()}</span>
            <button onclick="approveHost('${h._id}')" class="btn btn-success btn-sm">Approve</button>
            <button onclick="rejectHost('${h._id}')" class="btn btn-danger btn-sm">Reject</button>
          </div>
        `).join('');
      }

      const pendingProps = propsRes.data?.properties || [];
      const propsListEl = document.getElementById('pending-properties-list');
      if (pendingProps.length === 0) {
        propsListEl.innerHTML = '<p>No pending properties</p>';
      } else {
        propsListEl.innerHTML = pendingProps.map(p => `
          <div class="booking-list-item">
            <span>${p.name}</span>
            <span>${p.host_id?.name || 'Host'}</span>
            <span>${p.location?.city}</span>
            <button onclick="approveProperty('${p._id}')" class="btn btn-success btn-sm">Approve</button>
            <button onclick="rejectProperty('${p._id}')" class="btn btn-danger btn-sm">Reject</button>
          </div>
        `).join('');
      }

      window.approveHost = async (id) => {
        try {
          await api.post(`/admin/hosts/${id}/approve`);
          alert('Host approved');
          window.location.reload();
        } catch (error) {
          alert('Error: ' + error.message);
        }
      };

      window.rejectHost = async (id) => {
        const reason = prompt('Enter rejection reason:');
        if (reason !== null) {
          try {
            await api.post(`/admin/hosts/${id}/reject`, { reason });
            alert('Host rejected');
            window.location.reload();
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }
      };

      window.approveProperty = async (id) => {
        try {
          await api.post(`/admin/properties/${id}/approve`);
          alert('Property approved');
          window.location.reload();
        } catch (error) {
          alert('Error: ' + error.message);
        }
      };

      window.rejectProperty = async (id) => {
        const reason = prompt('Enter rejection reason:');
        if (reason !== null) {
          try {
            await api.post(`/admin/properties/${id}/reject`, { reason });
            alert('Property rejected');
            window.location.reload();
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }
      };
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }
};

export default AdminDashboardPage;
