import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const EditPropertyPage = {
  property: null,

  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isHost()) {
      return `<div class="container"><p>${t('host.accessDenied')}</p></div>`;
    }

    return `
      <div class="publish-property-page">
        <div class="container">
          <h1>${t('propertyForm.editTitle')}</h1>

          <div id="loading" class="loading">${t('propertyForm.loadingProperty')}</div>

          <form id="property-form" style="display:none;">
            <div class="form-section">
              <h2>${t('propertyForm.basicInfo')}</h2>

              <div class="form-group">
                <label>${t('propertyForm.nameLabel')}</label>
                <input type="text" id="name" required>
              </div>

              <div class="form-group">
                <label>${t('propertyForm.typeLabel')}</label>
                <select id="type" required>
                  <option value="casa_particular">${t('propertyForm.typeCasaParticular')}</option>
                  <option value="hostel">${t('propertyForm.typeHostel')}</option>
                </select>
              </div>

              <div class="form-group">
                <label>${t('propertyForm.descriptionLabel')}</label>
                <textarea id="description" rows="5" required></textarea>
              </div>
            </div>

            <div class="form-section">
              <h2>${t('propertyForm.locationSection')}</h2>

              <div class="form-row">
                <div class="form-group">
                  <label>${t('propertyForm.cityLabel')}</label>
                  <input type="text" id="city" required>
                </div>
                <div class="form-group">
                  <label>${t('propertyForm.neighborhoodLabel')}</label>
                  <input type="text" id="neighborhood">
                </div>
              </div>

              <div class="form-group">
                <label>${t('propertyForm.addressLabel')}</label>
                <input type="text" id="address">
              </div>
            </div>

            <div class="form-section">
              <h2>${t('propertyForm.detailsSection')}</h2>

              <div class="form-row">
                <div class="form-group">
                  <label>${t('propertyForm.maxGuestsLabel')}</label>
                  <input type="number" id="max_guests" min="1" required>
                </div>
                <div class="form-group">
                  <label>${t('propertyForm.bedroomsLabel')}</label>
                  <input type="number" id="bedrooms" min="1">
                </div>
                <div class="form-group">
                  <label>${t('propertyForm.bathroomsLabel')}</label>
                  <input type="number" id="bathrooms" min="1">
                </div>
              </div>

              <div class="form-group">
                <label>${t('propertyForm.priceLabel')}</label>
                <input type="number" id="price_per_night" min="1" required>
              </div>

              <div class="form-group">
                <label>${t('propertyForm.amenitiesLabel')}</label>
                <input type="text" id="amenities" placeholder="${t('propertyForm.amenitiesPlaceholder')}">
              </div>
            </div>

            <div class="form-section">
              <h2>${t('propertyForm.paymentOptionsLabel')}</h2>
              <div class="checkbox-group">
                <label><input type="checkbox" name="payment_options" value="full_payment" checked> ${t('propertyForm.fullPaymentOption')}</label>
                <label><input type="checkbox" name="payment_options" value="daily_payment"> ${t('propertyForm.dailyPaymentOption')}</label>
              </div>
            </div>

            <div class="form-section">
              <h2>${t('propertyForm.imagesSection')}</h2>
              <p style="color:var(--text-light);margin-bottom:15px;font-size:0.9rem;">${t('propertyForm.imagesHintEdit')}</p>

              <div id="image-inputs"></div>
              <button type="button" id="add-image-btn" class="btn btn-outline btn-sm" style="margin-top:10px;">${t('propertyForm.addAnotherImage')}</button>
            </div>

            <div id="error-message" class="error-message" style="display:none;"></div>

            <button type="submit" class="btn btn-primary">${t('profile.saveChanges')}</button>
          </form>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isHost()) return;

    const id = this._params?.id;
    if (!id) {
      window.location.href = '/host/properties';
      return;
    }

    try {
      const response = await api.get(`/properties/${id}`);
      this.property = response.data?.property;

      if (!this.property) {
        document.getElementById('loading').innerHTML = `<p class="error">${i18n.t('property.notFound')}</p>`;
        return;
      }

      this.populateForm();
      this.setupImageInputs();
      this.setupFormSubmit();
    } catch (error) {
      document.getElementById('loading').innerHTML = `<p class="error">${i18n.t('propertyForm.errorLoadingProperty')}</p>`;
    }
  },

  populateForm() {
    const p = this.property;
    document.getElementById('name').value = p.name || '';
    document.getElementById('type').value = p.type || 'casa_particular';
    document.getElementById('description').value = p.description || '';
    document.getElementById('city').value = p.location?.city || '';
    document.getElementById('neighborhood').value = p.location?.neighborhood || '';
    document.getElementById('address').value = p.location?.address || '';
    document.getElementById('max_guests').value = p.max_guests || 2;
    document.getElementById('bedrooms').value = p.bedrooms || 1;
    document.getElementById('bathrooms').value = p.bathrooms || 1;
    document.getElementById('price_per_night').value = p.price_per_night || 0;
    document.getElementById('amenities').value = (p.amenities || []).join(', ');

    const paymentOptions = p.payment_options || ['full_payment', 'daily_payment'];
    document.querySelectorAll('input[name="payment_options"]').forEach(cb => {
      cb.checked = paymentOptions.includes(cb.value);
    });

    document.getElementById('loading').style.display = 'none';
    document.getElementById('property-form').style.display = 'block';
  },

  setupImageInputs() {
    const t = (key) => i18n.t(key);
    const container = document.getElementById('image-inputs');
    const images = this.property.images || [];

    if (images.length === 0) {
      container.innerHTML = `
        <div class="form-group image-entry">
          <label>${t('propertyForm.mainImageUrlLabel')}</label>
          <input type="url" class="image-url" required placeholder="${t('propertyForm.imageUrlPlaceholder')}">
          <div class="image-upload-row">
            <input type="file" class="image-file-input" accept="image/*">
            <span class="image-upload-status"></span>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = images.map((img, i) => `
        <div class="form-group image-entry" style="display:flex;gap:10px;align-items:end;" data-public-id="${img.public_id || ''}">
          <div style="flex:1">
            <label>${i === 0 ? t('propertyForm.mainImageUrlLabel') : t('propertyForm.imageUrlLabel')}</label>
            <input type="url" class="image-url" value="${img.url || ''}" ${i === 0 ? 'required' : ''} placeholder="${t('propertyForm.imageUrlPlaceholder')}">
            <div class="image-upload-row">
              <input type="file" class="image-file-input" accept="image/*">
              <span class="image-upload-status"></span>
            </div>
          </div>
          <button type="button" class="btn btn-danger btn-sm remove-image-btn" style="margin-bottom:4px;">X</button>
        </div>
      `).join('');
    }

    document.querySelectorAll('.remove-image-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.image-entry').remove());
    });

    document.getElementById('add-image-btn').addEventListener('click', () => {
      const div = document.createElement('div');
      div.className = 'form-group image-entry';
      div.style.cssText = 'display:flex;gap:10px;align-items:end;';
      div.innerHTML = `
        <div style="flex:1">
          <label>${t('propertyForm.imageLabel')}</label>
          <input type="url" class="image-url" placeholder="${t('propertyForm.imageUrlPlaceholder')}">
          <div class="image-upload-row">
            <input type="file" class="image-file-input" accept="image/*">
            <span class="image-upload-status"></span>
          </div>
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-image-btn" style="margin-bottom:4px;">X</button>
      `;
      container.appendChild(div);
      div.querySelector('.remove-image-btn').addEventListener('click', () => div.remove());
      this.attachImageUploadHandlers(div);
    });

    this.attachImageUploadHandlers(container);
  },

  attachImageUploadHandlers(scope) {
    if (!scope) return;
    scope.querySelectorAll('.image-file-input').forEach((fileInput) => {
      if (fileInput.dataset.bound) return;
      fileInput.dataset.bound = '1';

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        const entry = fileInput.closest('.image-entry');
        const urlInput = entry?.querySelector('.image-url');
        const statusEl = entry?.querySelector('.image-upload-status');

        if (statusEl) {
          statusEl.textContent = i18n.t('propertyForm.uploading');
          statusEl.className = 'image-upload-status uploading';
        }

        try {
          const response = await api.uploadFile('/uploads/image', file);
          if (urlInput) urlInput.value = response.data.url;
          if (entry) entry.dataset.publicId = response.data.public_id || '';
          if (statusEl) {
            statusEl.textContent = i18n.t('propertyForm.imageUploaded');
            statusEl.className = 'image-upload-status success';
          }
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = error.message || i18n.t('propertyForm.imageUploadFailed');
            statusEl.className = 'image-upload-status error';
          }
        }
      });
    });
  },

  setupFormSubmit() {
    const form = document.getElementById('property-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  },

  async handleSubmit() {
    const errorEl = document.getElementById('error-message');

    const paymentOptions = Array.from(document.querySelectorAll('input[name="payment_options"]:checked'))
      .map(el => el.value);

    const amenities = document.getElementById('amenities')?.value
      ? document.getElementById('amenities').value.split(',').map(a => a.trim())
      : [];

    const imageUrls = Array.from(document.querySelectorAll('.image-entry'))
      .map((entry, i) => {
        const urlInput = entry.querySelector('.image-url');
        return {
          url: urlInput?.value || '',
          public_id: entry.dataset.publicId || '',
          title: `Photo ${i + 1}`,
          order: i + 1,
          is_primary: i === 0,
        };
      })
      .filter(img => img.url);

    const propertyData = {
      name: document.getElementById('name')?.value,
      type: document.getElementById('type')?.value,
      description: document.getElementById('description')?.value,
      location: {
        city: document.getElementById('city')?.value,
        neighborhood: document.getElementById('neighborhood')?.value,
        address: document.getElementById('address')?.value,
      },
      max_guests: parseInt(document.getElementById('max_guests')?.value),
      bedrooms: parseInt(document.getElementById('bedrooms')?.value),
      bathrooms: parseInt(document.getElementById('bathrooms')?.value),
      price_per_night: parseFloat(document.getElementById('price_per_night')?.value),
      amenities,
      payment_options: paymentOptions,
      images: imageUrls,
    };

    try {
      const response = await api.put(`/properties/${this.property._id}`, propertyData);

      if (response.success) {
        alert(i18n.t('propertyForm.updateSuccess'));
        window.location.href = '/host/properties';
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('propertyForm.updateFailed');
      errorEl.style.display = 'block';
    }
  }
};

export default EditPropertyPage;
