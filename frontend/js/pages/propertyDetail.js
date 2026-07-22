import api from '../api.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import auth from '../auth.js';

const PropertyDetailPage = {
  property: null,

  async render() {
    const id = this._params?.id || window.location.pathname.split('/').pop();

    try {
      const response = await api.get(`/properties/${id}`);
      this.property = response.data?.property;
    } catch (error) {
      return '<div class="container"><p class="error">Property not found</p></div>';
    }

    if (!this.property) {
      return '<div class="container"><p class="error">Property not found</p></div>';
    }

    const p = this.property;
    const primaryImage = p.images?.find(img => img.is_primary) || p.images?.[0];

    return `
      <div class="property-detail">
        <div class="container">
          <div class="property-gallery">
            ${p.images?.map((img, i) => `
              <img src="${img.url}" alt="${img.title || p.name}" class="${i === 0 ? 'main' : 'thumb'}">
            `).join('') || `<img src="https://via.placeholder.com/800x600?text=No+Image" alt="${p.name}">`}
          </div>
          
          <div class="property-info">
            <div class="property-main">
              <h1>${p.name}</h1>
              <p class="property-location">${p.location?.city}${p.location?.neighborhood ? `, ${p.location.neighborhood}` : ''}</p>
              
              <div class="property-meta">
                <span>${p.type === 'casa_particular' ? 'Casa Particular' : 'Hostel'}</span>
                <span>Max ${p.max_guests} guests</span>
                <span>${p.bedrooms || 1} bedroom(s)</span>
                <span>${p.bathrooms || 1} bathroom(s)</span>
              </div>
              
              <div class="property-description">
                <h2>Description</h2>
                <p>${p.description}</p>
              </div>
              
              <div class="property-amenities">
                <h2>Amenities</h2>
                <div class="amenities-grid">
                  ${p.amenities?.map(a => `<span class="amenity">${a}</span>`).join('') || '<p>No amenities listed</p>'}
                </div>
              </div>
              
              <div class="property-reviews">
                <h2>Reviews</h2>
                <p>${p.rating > 0 ? `&#9733; ${p.rating} (${p.reviews_count} reviews)` : 'No reviews yet'}</p>
              </div>
            </div>
            
            <div class="property-sidebar">
              <div class="booking-card">
                <div class="price">
                  <span class="amount">${formatCurrency(p.price_per_night)}</span>
                  <span class="period">/night</span>
                </div>
                
                <form id="booking-form">
                  <div class="form-group">
                    <label>Check-in</label>
                    <input type="date" id="check-in" required>
                  </div>
                  <div class="form-group">
                    <label>Check-out</label>
                    <input type="date" id="check-out" required>
                  </div>
                  <div class="form-group">
                    <label>Guests</label>
                    <input type="number" id="num-guests" min="1" max="${p.max_guests}" value="1" required>
                  </div>
                  
                  <div class="booking-summary" id="booking-summary" style="display:none;">
                    <div class="summary-row">
                      <span>Nights</span>
                      <span id="nights-count">0</span>
                    </div>
                    <div class="summary-row">
                      <span>Total</span>
                      <span id="total-amount">$0</span>
                    </div>
                    <div class="summary-row fee">
                      <span>Booking Fee</span>
                      <span>$7 USD</span>
                    </div>
                    <p class="fee-note">* Fee is non-refundable. Remainder paid at accommodation.</p>
                  </div>
                  
                  <button type="submit" class="btn btn-primary btn-block" id="book-btn">
                    ${auth.isLoggedIn() ? 'Reserve Now' : 'Login to Book'}
                  </button>
                </form>
                
                <div class="contact-info">
                  <p><strong>Contact Administrator:</strong></p>
                  <p>Email: supportdaelworld@gmail.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('booking-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleBooking();
      });

      const checkIn = document.getElementById('check-in');
      const checkOut = document.getElementById('check-out');

      if (checkIn && checkOut) {
        checkIn.addEventListener('change', () => this.updateSummary());
        checkOut.addEventListener('change', () => this.updateSummary());
      }
    }
  },

  updateSummary() {
    const checkIn = new Date(document.getElementById('check-in')?.value);
    const checkOut = new Date(document.getElementById('check-out')?.value);
    const summary = document.getElementById('booking-summary');

    if (checkIn && checkOut && checkIn < checkOut) {
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const total = nights * this.property.price_per_night;

      document.getElementById('nights-count').textContent = nights;
      document.getElementById('total-amount').textContent = formatCurrency(total);
      summary.style.display = 'block';
    } else {
      summary.style.display = 'none';
    }
  },

  handleBooking() {
    if (!auth.isLoggedIn()) {
      window.location.href = `/login?redirect=/property/${this.property._id}`;
      return;
    }

    const checkIn = document.getElementById('check-in')?.value;
    const checkOut = document.getElementById('check-out')?.value;
    const numGuests = document.getElementById('num-guests')?.value;

    if (!checkIn || !checkOut) {
      alert('Please select check-in and check-out dates');
      return;
    }

    window.location.href = `/booking/${this.property._id}?check_in=${checkIn}&check_out=${checkOut}&num_guests=${numGuests}`;
  }
};

export default PropertyDetailPage;
