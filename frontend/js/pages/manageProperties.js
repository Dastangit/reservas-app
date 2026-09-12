import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const ManagePropertiesPage = {
  async render() {
    const t = (key) => i18n.t(key);
    if (!auth.isLoggedIn() || !auth.isHost()) {
      return `<div class="container"><p>${t('host.accessDenied')}</p></div>`;
    }

    return `
      <div class="manage-properties-page">
        <div class="container">
          <h1>${t('host.myProperties')}</h1>
          
          <div class="page-actions">
            <a href="/host/properties/new" data-link class="btn btn-primary">${t('host.addProperty')}</a>
          </div>
          
          <div id="properties-list">
            <p class="loading">${t('host.loadingProperties')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isHost()) return;

    const list = document.getElementById('properties-list');
    const t = (key) => i18n.t(key);

    try {
      const response = await api.get('/properties/my');
      const properties = response.data?.properties || [];

      if (properties.length === 0) {
        list.innerHTML = `<p class="no-results">${t('host.noPropertiesYet')} <a href="/host/properties/new" data-link>${t('host.addFirstProperty')}</a></p>`;
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
            <a href="/host/properties/${p._id}/edit" data-link class="btn btn-outline btn-sm">${t('common.edit')}</a>
            <a href="/host/properties/${p._id}/calendar" data-link class="btn btn-outline btn-sm">${t('host.availability')}</a>
          </div>
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = `<p class="error">${t('host.errorLoadingProperties')}</p>`;
    }
  }
};

export default ManagePropertiesPage;
