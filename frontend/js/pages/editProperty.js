import api from '../api.js';
import auth from '../auth.js';

const EditPropertyPage = {
  property: null,

  async render() {
    if (!auth.isLoggedIn() || !auth.isHost()) {
      return '<div class="container"><p>Access denied. Please login as a host.</p></div>';
    }

    return `
      <div class="publish-property-page">
        <div class="container">
          <h1>Edit Property</h1>
          
          <div id="loading" class="loading">Loading property...</div>
          
          <form id="property-form" style="display:none;">
            <div class="form-section">
              <h2>Basic Information</h2>
              
              <div class="form-group">
                <label>Property Name *</label>
                <input type="text" id="name" required>
              </div>
              
              <div class="form-group">
                <label>Type *</label>
                <select id="type" required>
                  <option value="casa_particular">Casa Particular</option>
                  <option value="hostel">Hostel</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>Description *</label>
                <textarea id="description" rows="5" required></textarea>
              </div>
            </div>
            
            <div class="form-section">
              <h2>Location</h2>
              
              <div class="form-row">
                <div class="form-group">
                  <label>City *</label>
                  <input type="text" id="city" required>
                </div>
                <div class="form-group">
                  <label>Neighborhood</label>
                  <input type="text" id="neighborhood">
                </div>
              </div>
              
              <div class="form-group">
                <label>Address</label>
                <input type="text" id="address">
              </div>
            </div>
            
            <div class="form-section">
              <h2>Details</h2>
              
              <div class="form-row">
                <div class="form-group">
                  <label>Max Guests *</label>
                  <input type="number" id="max_guests" min="1" required>
                </div>
                <div class="form-group">
                  <label>Bedrooms</label>
                  <input type="number" id="bedrooms" min="1">
                </div>
                <div class="form-group">
                  <label>Bathrooms</label>
                  <input type="number" id="bathrooms" min="1">
                </div>
              </div>
              
              <div class="form-group">
                <label>Price per Night (USD) *</label>
                <input type="number" id="price_per_night" min="1" required>
              </div>
              
              <div class="form-group">
                <label>Amenities</label>
                <input type="text" id="amenities" placeholder="wifi, air_conditioning, kitchen (comma separated)">
              </div>
            </div>

            <div class="form-section">
              <h2>Payment Options</h2>
              <div class="checkbox-group">
                <label><input type="checkbox" name="payment_options" value="full_payment" checked> Full Payment on Arrival</label>
                <label><input type="checkbox" name="payment_options" value="daily_payment"> Daily Payment</label>
              </div>
            </div>

            <div class="form-section">
              <h2>Images</h2>
              <p style="color:var(--text-light);margin-bottom:15px;font-size:0.9rem;">Manage your property images. First image is the main photo.</p>
              
              <div id="image-inputs"></div>
              <button type="button" id="add-image-btn" class="btn btn-outline btn-sm" style="margin-top:10px;">+ Add Another Image</button>
            </div>
            
            <div id="error-message" class="error-message" style="display:none;"></div>
            
            <button type="submit" class="btn btn-primary">Save Changes</button>
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
        document.getElementById('loading').innerHTML = '<p class="error">Property not found</p>';
        return;
      }

      this.populateForm();
      this.setupImageInputs();
      this.setupFormSubmit();
    } catch (error) {
      document.getElementById('loading').innerHTML = '<p class="error">Error loading property</p>';
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
    const container = document.getElementById('image-inputs');
    const images = this.property.images || [];

    if (images.length === 0) {
      container.innerHTML = `
        <div class="form-group image-entry">
          <label>Main Image URL *</label>
          <input type="url" class="image-url" required placeholder="https://example.com/photo1.jpg">
        </div>
      `;
    } else {
      container.innerHTML = images.map((img, i) => `
        <div class="form-group image-entry" style="display:flex;gap:10px;align-items:end;">
          <div style="flex:1">
            <label>${i === 0 ? 'Main Image URL *' : 'Image URL'}</label>
            <input type="url" class="image-url" value="${img.url || ''}" ${i === 0 ? 'required' : ''} placeholder="https://example.com/photo.jpg">
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
          <label>Image URL</label>
          <input type="url" class="image-url" placeholder="https://example.com/photo.jpg">
        </div>
        <button type="button" class="btn btn-danger btn-sm remove-image-btn" style="margin-bottom:4px;">X</button>
      `;
      container.appendChild(div);
      div.querySelector('.remove-image-btn').addEventListener('click', () => div.remove());
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
      const response = await api.put(`/properties/${this.property._id}`, propertyData);

      if (response.success) {
        alert('Property updated successfully!');
        window.location.href = '/host/properties';
      }
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to update property';
      errorEl.style.display = 'block';
    }
  }
};

export default EditPropertyPage;
