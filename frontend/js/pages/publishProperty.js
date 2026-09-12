import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const PublishPropertyPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isHost()) {
      return `<div class="container"><p>${t('host.accessDenied')}</p></div>`;
    }

    return `
      <div class="publish-property-page">
        <div class="container">
          <h1>${t('propertyForm.publishTitle')}</h1>

          <form id="property-form">
            <div class="form-section">
              <h2>${t('propertyForm.basicInfo')}</h2>

              <div class="form-group">
                <label>${t('propertyForm.nameLabel')}</label>
                <input type="text" id="name" required placeholder="${t('propertyForm.namePlaceholder')}">
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
                <textarea id="description" rows="5" required placeholder="${t('propertyForm.descriptionPlaceholder')}"></textarea>
              </div>
            </div>

            <div class="form-section">
              <h2>${t('propertyForm.locationSection')}</h2>

              <div class="form-row">
                <div class="form-group">
                  <label>${t('propertyForm.cityLabel')}</label>
                  <input type="text" id="city" required placeholder="${t('propertyForm.cityPlaceholder')}">
                </div>
                <div class="form-group">
                  <label>${t('propertyForm.neighborhoodLabel')}</label>
                  <input type="text" id="neighborhood" placeholder="${t('propertyForm.neighborhoodPlaceholder')}">
                </div>
              </div>

              <div class="form-group">
                <label>${t('propertyForm.addressLabel')}</label>
                <input type="text" id="address" placeholder="${t('propertyForm.addressPlaceholder')}">
              </div>
            </div>

            <div class="form-section">
              <h2>${t('propertyForm.detailsSection')}</h2>

              <div class="form-row">
                <div class="form-group">
                  <label>${t('propertyForm.maxGuestsLabel')}</label>
                  <input type="number" id="max_guests" min="1" value="2" required>
                </div>
                <div class="form-group">
                  <label>${t('propertyForm.bedroomsLabel')}</label>
                  <input type="number" id="bedrooms" min="1" value="1">
                </div>
                <div class="form-group">
                  <label>${t('propertyForm.bathroomsLabel')}</label>
                  <input type="number" id="bathrooms" min="1" value="1">
                </div>
              </div>

              <div class="form-group">
                <label>${t('propertyForm.priceLabel')}</label>
                <input type="number" id="price_per_night" min="1" required placeholder="${t('propertyForm.pricePlaceholder')}">
              </div>

              <div class="form-group">
                <label>${t('propertyForm.amenitiesLabel')}</label>
                <input type="text" id="amenities" placeholder="${t('propertyForm.amenitiesPlaceholder')}">
              </div>

              <div class="form-group">
                <label>${t('propertyForm.paymentOptionsLabel')}</label>
                <div class="checkbox-group">
                  <label><input type="checkbox" name="payment_options" value="full_payment" checked> ${t('propertyForm.fullPaymentOption')}</label>
                  <label><input type="checkbox" name="payment_options" value="daily_payment"> ${t('propertyForm.dailyPaymentOption')}</label>
                </div>
              </div>
            </div>

            <div class="form-section">
              <h2>${t('propertyForm.imagesSection')}</h2>
              <p style="color:var(--text-light);margin-bottom:15px;font-size:0.9rem;">${t('propertyForm.imagesHintPublish')}</p>

              <div id="image-inputs">
                <div class="form-group image-entry">
                  <label>${t('propertyForm.mainImageLabel')}</label>
                  <input type="url" class="image-url" required placeholder="${t('propertyForm.imageUrlPlaceholder')}">
                  <div class="image-upload-row">
                    <input type="file" class="image-file-input" accept="image/*">
                    <span class="image-upload-status"></span>
                  </div>
                </div>
              </div>
              <button type="button" id="add-image-btn" class="btn btn-outline btn-sm" style="margin-top:10px;">${t('propertyForm.addAnotherImage')}</button>
            </div>

            <div id="error-message" class="error-message" style="display:none;"></div>

            <button type="submit" class="btn btn-primary">${t('propertyForm.submitBtn')}</button>
          </form>
        </div>
      </div>
    `;
  },

  init() {
    const t = (key) => i18n.t(key);
    const form = document.getElementById('property-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }

    this.attachImageUploadHandlers(document.getElementById('image-inputs'));

    const addImageBtn = document.getElementById('add-image-btn');
    if (addImageBtn) {
      addImageBtn.addEventListener('click', () => {
        const container = document.getElementById('image-inputs');
        const div = document.createElement('div');
        div.className = 'form-group image-entry';
        div.innerHTML = `
          <div style="display:flex;gap:10px;align-items:end;">
            <div style="flex:1">
              <label>${t('propertyForm.imageLabel')}</label>
              <input type="url" class="image-url" placeholder="${t('propertyForm.imageUrlPlaceholder')}">
            </div>
            <button type="button" class="btn btn-danger btn-sm remove-image-btn" style="margin-bottom:4px;">X</button>
          </div>
          <div class="image-upload-row">
            <input type="file" class="image-file-input" accept="image/*">
            <span class="image-upload-status"></span>
          </div>
        `;
        container.appendChild(div);

        div.querySelector('.remove-image-btn').addEventListener('click', () => div.remove());
        this.attachImageUploadHandlers(div);
      });
    }
  },

  // Sube el archivo elegido a /uploads/image y llena automáticamente el
  // input de URL correspondiente con el link que devuelve Cloudinary. Si
  // falla (bloqueo geográfico, límite, etc.), el host siempre puede seguir
  // usando el campo de URL manualmente -- no se bloquea el formulario.
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

  async handleSubmit() {
    const errorEl = document.getElementById('error-message');

    const paymentOptions = Array.from(document.querySelectorAll('input[name="payment_options"]:checked'))
      .map(el => el.value);

    const amenities = document.getElementById('amenities')?.value
      ? document.getElementById('amenities').value.split(',').map(a => a.trim())
      : [];

    const imageUrls = Array.from(document.querySelectorAll('.image-url'))
      .map((input, i) => ({
        url: input.value,
        title: `Photo ${i + 1}`,
        order: i + 1,
        is_primary: i === 0,
      }))
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
      const response = await api.post('/properties', propertyData);

      if (response.success) {
        alert(i18n.t('propertyForm.submitSuccess'));
        window.location.href = '/host/properties';
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('propertyForm.submitFailed');
      errorEl.style.display = 'block';
    }
  }
};

export default PublishPropertyPage;
