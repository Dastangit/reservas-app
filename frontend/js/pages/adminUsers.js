import api from '../api.js';
import auth from '../auth.js';

const AdminUsersPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Access denied. Please login as admin.</p></div>';
    }

    return `
      <div class="admin-users-page">
        <div class="container">
          <h1>Host Management</h1>
          
          <div class="dashboard-tabs">
            <button class="tab-btn active" onclick="filterHosts('')">All</button>
            <button class="tab-btn" onclick="filterHosts('pending')">Pending</button>
            <button class="tab-btn" onclick="filterHosts('approved')">Approved</button>
            <button class="tab-btn" onclick="filterHosts('rejected')">Rejected</button>
          </div>
          
          <div id="hosts-list">
            <p class="loading">Loading hosts...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    window.filterHosts = async (status) => {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      await this.loadHosts(status);
    };

    window.approveHost = async (id) => {
      try {
        await api.post(`/admin/hosts/${id}/approve`);
        alert('Host approved');
        await this.loadHosts('');
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
          await this.loadHosts('');
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    };

    window.suspendHost = async (id) => {
      if (confirm('Are you sure you want to suspend this host?')) {
        try {
          await api.post(`/admin/hosts/${id}/suspend`);
          alert('Host suspended');
          await this.loadHosts('');
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    };

    window.deleteHost = async (id) => {
      if (confirm('Are you sure? This will delete the host and ALL their properties permanently.')) {
        try {
          await api.delete(`/admin/hosts/${id}`);
          alert('Host deleted');
          await this.loadHosts('');
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    };

    await this.loadHosts('');
  },

  async loadHosts(status) {
    const list = document.getElementById('hosts-list');
    list.innerHTML = '<p class="loading">Loading...</p>';

    try {
      const url = status ? `/admin/hosts?host_status=${status}` : '/admin/hosts';
      const response = await api.get(url);
      const hosts = response.data?.hosts || [];

      if (hosts.length === 0) {
        list.innerHTML = '<p class="no-results">No hosts found</p>';
        return;
      }

      list.innerHTML = hosts.map(h => `
        <div class="property-list-item">
          <div class="property-info">
            <h3>${h.name}</h3>
            <p>${h.email} | ${h.phone || 'No phone'}</p>
            <span class="status-badge ${h.host_status}">${h.host_status}</span>
            <span class="status-badge ${h.status}" style="margin-left:5px;">${h.status}</span>
          </div>
          <div class="property-actions">
            ${h.host_status === 'pending' ? `
              <button onclick="approveHost('${h._id}')" class="btn btn-success btn-sm">Approve</button>
              <button onclick="rejectHost('${h._id}')" class="btn btn-danger btn-sm">Reject</button>
            ` : ''}
            ${h.host_status === 'approved' ? `
              <button onclick="suspendHost('${h._id}')" class="btn btn-danger btn-sm">Suspend</button>
            ` : ''}
            <button onclick="deleteHost('${h._id}')" class="btn btn-danger btn-sm">Delete</button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error loading hosts</p>';
    }
  }
};

export default AdminUsersPage;
