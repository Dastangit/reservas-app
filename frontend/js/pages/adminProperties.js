import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const AdminPropertiesPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-properties-page">
        <div class="container">
          <h1>${t('admin.propertyManagementTitle')}</h1>
          
          <div class="dashboard-tabs">
            <button class="tab-btn active" onclick="filterProps('')">${t('dashboard.all')}</button>
            <button class="tab-btn" onclick="filterProps('pending_approval')">${t('dashboard.pending')}</button>
            <button class="tab-btn" onclick="filterProps('active')">${t('host.tabActive')}</button>
            <button class="tab-btn" onclick="filterProps('rejected')">${t('booking.statusRejected')}</button>
          </div>
          
          <div id="properties-list">
            <p class="loading">${t('search.loadingProperties')}</p>
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
        alert(i18n.t('admin.propertyApproved'));
        await this.loadProperties('');
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
          await this.loadProperties('');
        } catch (error) {
          alert(i18n.t('common.errorPrefix') + error.message);
        }
      }
    };

    window.adminDeleteProperty = async (id) => {
      if (confirm(i18n.t('admin.deletePropertyConfirm'))) {
        try {
          await api.delete(`/admin/properties/${id}`);
          alert(i18n.t('admin.propertyDeleted'));
          await this.loadProperties('');
        } catch (error) {
          alert(i18n.t('common.errorPrefix') + error.message);
        }
      }
    };

    await this.loadProperties('');
  },

  async loadProperties(status) {
    const list = document.getElementById('properties-list');
    list.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const url = status ? `/admin/properties?status=${status}` : '/admin/properties';
      const response = await api.get(url);
      const properties = response.data?.properties || [];

      if (properties.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('admin.noPropertiesFound')}</p>`;
        return;
      }

      list.innerHTML = properties.map(p => `
        <div class="property-list-item">
          <div class="property-list-item-summary" onclick="togglePropertyDetail('${p._id}')">
            <img src="${p.images?.[0]?.url || 'https://via.placeholder.com/100'}" alt="${p.name}">
            <div class="property-info">
              <h3>${p.name}</h3>
              <p>${p.location?.city} | $${p.price_per_night}${i18n.t('property.perNight')}</p>
              <p>${i18n.t('admin.hostLabel')} ${p.host_id?.name || i18n.t('admin.unknownFallback')}</p>
              <span class="status-badge ${p.status}">${p.status.replace(/_/g, ' ')}</span>
            </div>
            <button type="button" class="btn btn-outline btn-sm property-detail-toggle">${i18n.t('admin.viewDetail')}</button>
          </div>

          <div class="property-detail-panel" id="detail-${p._id}" style="display:none;">
            <div class="property-detail-grid">
              <div>
                <h4>${i18n.t('property.description')}</h4>
                <p>${p.description || `<em>${i18n.t('admin.noDescription')}</em>`}</p>

                <h4>${i18n.t('propertyForm.locationSection')}</h4>
                <p>${[p.location?.address, p.location?.neighborhood, p.location?.city].filter(Boolean).join(', ') || i18n.t('admin.notSpecified')}</p>

                <h4>${i18n.t('propertyForm.detailsSection')}</h4>
                <p>${i18n.t('admin.typeLabel')} ${p.type || i18n.t('admin.na')} · ${i18n.t('admin.maxGuestsShort')} ${p.max_guests || i18n.t('admin.na')} · ${i18n.t('admin.bedroomsShort')} ${p.bedrooms ?? i18n.t('admin.na')} · ${i18n.t('admin.bathroomsShort')} ${p.bathrooms ?? i18n.t('admin.na')}</p>
                ${p.bed_types?.length ? `<p>${i18n.t('admin.bedsLabel')} ${p.bed_types.join(', ')}</p>` : ''}

                <h4>${i18n.t('property.amenities')}</h4>
                <p>${p.amenities?.length ? p.amenities.join(', ') : `<em>${i18n.t('admin.noneSpecified')}</em>`}</p>

                <h4>${i18n.t('admin.paymentOptionsAcceptedHeading')}</h4>
                <p>${p.payment_options?.length ? p.payment_options.join(', ') : `<em>${i18n.t('admin.none')}</em>`}</p>

                ${p.status === 'rejected' && p.rejection_reason ? `<h4>${i18n.t('admin.rejectionReasonHeading')}</h4><p>${p.rejection_reason}</p>` : ''}
              </div>

              <div>
                <h4>${i18n.t('admin.hostContactHeading')}</h4>
                <p>${p.host_id?.name || i18n.t('admin.unknownFallback')}</p>
                <p>${p.host_id?.email || i18n.t('admin.noEmail')}</p>
                <p>${p.host_id?.phone || p.host_id?.whatsapp_phone || i18n.t('admin.noPhone')}</p>

                <h4>${i18n.t('admin.photosHeading')} (${p.images?.length || 0})</h4>
                <div class="property-detail-gallery">
                  ${p.images?.length ? p.images.map(img => `<img src="${img.url}" alt="${img.title || p.name}">`).join('') : `<em>${i18n.t('admin.noPhotos')}</em>`}
                </div>
              </div>
            </div>
          </div>

          <div class="property-actions">
            ${p.status === 'pending_approval' ? `
              <button onclick="approveProperty('${p._id}')" class="btn btn-success btn-sm">${i18n.t('admin.approveBtn')}</button>
              <button onclick="rejectProperty('${p._id}')" class="btn btn-danger btn-sm">${i18n.t('admin.rejectBtn')}</button>
            ` : ''}
            <button onclick="adminDeleteProperty('${p._id}')" class="btn btn-danger btn-sm">${i18n.t('admin.deleteBtn')}</button>
          </div>
        </div>
      `).join('');

      window.togglePropertyDetail = (id) => {
        const panel = document.getElementById(`detail-${id}`);
        if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      };
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('search.errorLoading')}</p>`;
    }
  }
};

export default AdminPropertiesPage;
