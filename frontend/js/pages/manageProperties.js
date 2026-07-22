import api from '../api.js';
import auth from '../auth.js';

const ManagePropertiesPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isHost()) {
      return '<div class="container"><p>Access denied. Please login as a host.</p></div>';
    }

    return `
      <div class="manage-properties-page">
        <div class="container">
          <h1>My Properties</h1>
          
          <div class="page-actions">
            <a href="/host/properties/new" data-link class="btn btn-primary">Add New Property</a>
          </div>
          
          <div id="properties-list">
            <p class="loading">Loading properties...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isHost()) return;

    const list = document.getElementById('properties-list');

    try {
      const response = await api.get('/properties/my');
      const properties = response.data?.properties || [];

      if (properties.length === 0) {
        list.innerHTML = '<p class="no-results">No properties yet. <a href="/host/properties/new" data-link>Add your first property</a></p>';
        return;
      }

      list.innerHTML = properties.map(p => `
        <div class="property-list-item">
          <img src="${p.images?.[0]?.url || 'https://via.placeholder.com/100'}" alt="${p.name}">
          <div class="property-info">
            <h3>${p.name}</h3>
            <p>${p.location?.city}</p>
            <span class="status-badge ${p.status}">${p.status.replace(/_/g, ' ')}</span>
          </div>
          <div class="property-actions">
            <a href="/host/properties/${p._id}/edit" data-link class="btn btn-outline btn-sm">Edit</a>
            <a href="/host/properties/${p._id}/calendar" data-link class="btn btn-outline btn-sm">Disponibilidad</a>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error loading properties</p>';
    }
  }
};

export default ManagePropertiesPage;
