import api from '../api.js';
import auth from '../auth.js';

const PublishPropertyPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isHost()) {
      return '<div class="container"><p>Access denied. Please login as a host.</p></div>';
    }

    return `
      <div class="publish-property-page">
        <div class="container">
          <h1>Publish New Property</h1>
          
          <form id="property-form">
            <div class="form-section">
              <h2>Basic Information</h2>
              
              <div class="form-group">
                <label>Property Name *</label>
                <input type="text" id="name" required placeholder="e.g., Casa Azul Habana">
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
                <textarea id="description" rows="5" required placeholder="Describe your property..."></textarea>
              </div>
            </div>
            
            <div class="form-section">
              <h2>Location</h2>
              
              <div class="form-row">
                <div class="form-group">
                  <label>City *</label>
                  <input type="text" id="city" required placeholder="e.g., Habana">
                </div>
                <div class="form-group">
                  <label>Neighborhood</label>
                  <input type="text" id="neighborhood" placeholder="e.g., Vedado">
                </div>
              </div>
              
              <div class="form-group">
                <label>Address</label>
                <input type="text" id="address" placeholder="Street address">
              </div>
            </div>
            
            <div class="form-section">
              <h2>Details</h2>
              
              <div class="form-row">
                <div class="form-group">
                  <label>Max Guests *</label>
                  <input type="number" id="max_guests" min="1" value="2" required>
                </div>
                <div class="form-group">
                  <label>Bedrooms</label>
                  <input type="number" id="bedrooms" min="1" value="1">
                </div>
                <div class="form-group">
                  <label>Bathrooms</label>
                  <input type="number" id="bathrooms" min="1" value="1">
                </div>
              </div>
              
              <div class="form-group">
                <label>Price per Night (USD) *</label>
                <input type="number" id="price_per_night" min="1" required placeholder="50">
              </div>
              
              <div class="form-group">
                <label>Amenities</label>
                <input type="text" id="amenities" placeholder="wifi, air_conditioning, kitchen (comma separated)">
              </div>
              
              <div class="form-group">
                <label>Payment Options</label>
                <div class="checkbox-group">
                  <label><input type="checkbox" name="payment_options" value="full_payment" checked> Full Payment on Arrival</label>
                  <label><input type="checkbox" name="payment_options" value="daily_payment"> Daily Payment</label>
                </div>
              </div>
            </div>

            <div class="form-section">
              <h2>Images</h2>
              <p style="color:var(--text-light);margin-bottom:15px;font-size:0.9rem;">Add image URLs (use links from Instagram, Google Photos, or any hosting). First image will be the main photo.</p>
              
              <div id="image-inputs">
                <div class="form-group image-entry">
                  <label>Main Image URL *</label>
                  <input type="url" class="image-url" required placeholder="https://example.com/photo1.jpg">
                </div>
              </div>
              <button type="button" id="add-image-btn" class="btn btn-outline btn-sm" style="margin-top:10px;">+ Add Another Image</button>
            </div>
            
            <div id="error-message" class="error-message" style="display:none;"></div>
            
            <button type="submit" class="btn btn-primary">Submit for Approval</button>
          </form>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('property-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }

    const addImageBtn = document.getElementById('add-image-btn');
    if (addImageBtn) {
      addImageBtn.addEventListener('click', () => {
        const container = document.getElementById('image-inputs');
        const div = document.createElement('div');
        div.className = 'form-group image-entry';
        div.style.display = 'flex';
        div.style.gap = '10px';
        div.style.alignItems = 'end';
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
    }
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
        alert('Property submitted for approval!');
        window.location.href = '/host/properties';
      }
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to create property';
      errorEl.style.display = 'block';
    }
  }
};

export default PublishPropertyPage;
