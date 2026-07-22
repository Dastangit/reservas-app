import api from '../api.js';
import auth from '../auth.js';

const AdminPropertiesPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Access denied. Please login as admin.</p></div>';
    }

    return `
      <div class="admin-properties-page">
        <div class="container">
          <h1>Property Management</h1>
          
          <div class="dashboard-tabs">
            <button class="tab-btn active" onclick="filterProps('')">All</button>
            <button class="tab-btn" onclick="filterProps('pending_approval')">Pending</button>
            <button class="tab-btn" onclick="filterProps('active')">Active</button>
            <button class="tab-btn" onclick="filterProps('rejected')">Rejected</button>
          </div>
          
          <div id="properties-list">
            <p class="loading">Loading properties...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    window.filterProps = async (status) => {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      await this.loadProperties(status);
    };

    window.approveProperty = async (id) => {
      try {
        await api.post(`/admin/properties/${id}/approve`);
        alert('Property approved');
        await this.loadProperties('');
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
          await this.loadProperties('');
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    };

    window.adminDeleteProperty = async (id) => {
      if (confirm('Are you sure? This will permanently delete this property.')) {
        try {
          await api.delete(`/admin/properties/${id}`);
          alert('Property deleted');
          await this.loadProperties('');
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    };

    await this.loadProperties('');
  },

  async loadProperties(status) {
    const list = document.getElementById('properties-list');
    list.innerHTML = '<p class="loading">Loading...</p>';

    try {
      const url = status ? `/admin/properties?status=${status}` : '/admin/properties';
      const response = await api.get(url);
      const properties = response.data?.properties || [];

      if (properties.length === 0) {
        list.innerHTML = '<p class="no-results">No properties found</p>';
        return;
      }

      list.innerHTML = properties.map(p => `
        <div class="property-list-item">
          <img src="${p.images?.[0]?.url || 'https://via.placeholder.com/100'}" alt="${p.name}">
          <div class="property-info">
            <h3>${p.name}</h3>
            <p>${p.location?.city} | $${p.price_per_night}/night</p>
            <p>Host: ${p.host_id?.name || 'Unknown'}</p>
            <span class="status-badge ${p.status}">${p.status.replace(/_/g, ' ')}</span>
          </div>
          <div class="property-actions">
            ${p.status === 'pending_approval' ? `
              <button onclick="approveProperty('${p._id}')" class="btn btn-success btn-sm">Approve</button>
              <button onclick="rejectProperty('${p._id}')" class="btn btn-danger btn-sm">Reject</button>
            ` : ''}
            <button onclick="adminDeleteProperty('${p._id}')" class="btn btn-danger btn-sm">Delete</button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error loading properties</p>';
    }
  }
};

export default AdminPropertiesPage;
