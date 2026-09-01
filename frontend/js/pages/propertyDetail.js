import api from '../api.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const PropertyDetailPage = {
  property: null,

  async render() {
    const t = (key) => i18n.t(key);
    const id = this._params?.id || window.location.pathname.split('/').pop();

    try {
      const response = await api.get(`/properties/${id}`);
      this.property = response.data?.property;
    } catch (error) {
      return `<div class="container"><p class="error">${t('property.notFound')}</p></div>`;
    }

    if (!this.property) {
      return `<div class="container"><p class="error">${t('property.notFound')}</p></div>`;
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
                <span>${t('property.max')} ${p.max_guests} ${t('property.guests')}</span>
                <span>${p.bedrooms || 1} ${t('property.bedrooms')}</span>
                <span>${p.bathrooms || 1} ${t('property.bathrooms')}</span>
              </div>
              
              <div class="property-description">
                <h2>${t('property.description')}</h2>
                <p>${p.description}</p>
              </div>
              
              <div class="property-amenities">
                <h2>${t('property.amenities')}</h2>
                <div class="amenities-grid">
                  ${p.amenities?.map(a => `<span class="amenity">${a}</span>`).join('') || `<p>${t('property.noAmenities')}</p>`}
                </div>
              </div>
              
              <div class="property-reviews">
                <h2>${t('property.reviews')}</h2>
                <p>${p.rating > 0 ? `&#9733; ${p.rating} (${p.reviews_count} ${t('property.reviews').toLowerCase()})` : t('property.noReviews')}</p>
              </div>
            </div>
            
            <div class="property-sidebar">
              <div class="booking-card">
                <div class="price">
                  <span class="amount">${formatCurrency(p.price_per_night)}</span>
                  <span class="period">${t('property.perNight')}</span>
                </div>
                
                <form id="booking-form">
                  <div class="form-row date-range-row">
                    <div class="form-group">
                      <label>${t('booking.checkIn')}</label>
                      <input type="date" id="check-in" required>
                    </div>
                    <div class="form-group">
                      <label>${t('booking.checkOut')}</label>
                      <input type="date" id="check-out" required>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>${t('booking.guests')}</label>
                    <input type="number" id="num-guests" min="1" max="${p.max_guests}" value="1" required>
                  </div>
                  
                  <div class="booking-summary" id="booking-summary" style="display:none;">
                    <div class="summary-row">
                      <span>${t('booking.nights')}</span>
                      <span id="nights-count">0</span>
                    </div>
                    <div class="summary-row">
                      <span>${t('booking.total')}</span>
                      <span id="total-amount">$0</span>
                    </div>
                    <div class="summary-row fee">
                      <span>${t('booking.fee')}</span>
                      <span>$7 USD</span>
                    </div>
                    <p class="fee-note">${t('booking.feeNote')}</p>
                  </div>
                  
                  <button type="submit" class="btn btn-primary btn-block" id="book-btn">
                    ${auth.isLoggedIn() ? t('property.reserveNow') : t('property.loginToBook')}
                  </button>
                </form>
                
                <div class="contact-info">
                  <p><strong>${t('confirmation.contactAdmin')}:</strong></p>
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
        // No dejar elegir fechas pasadas, y el check-out nunca puede ser
        // antes (ni el mismo día) que el check-in elegido.
        const todayISO = new Date().toISOString().slice(0, 10);
        checkIn.min = todayISO;
        checkOut.min = todayISO;

        checkIn.addEventListener('change', () => {
          if (checkIn.value) {
            const nextDay = new Date(checkIn.value);
            nextDay.setDate(nextDay.getDate() + 1);
            checkOut.min = nextDay.toISOString().slice(0, 10);

            if (checkOut.value && checkOut.value <= checkIn.value) {
              checkOut.value = checkOut.min;
            }
          }
          this.updateSummary();
        });
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
      alert(i18n.t('booking.selectDates'));
      return;
    }

    window.location.href = `/booking/${this.property._id}?check_in=${checkIn}&check_out=${checkOut}&num_guests=${numGuests}`;
  }
};

export default PropertyDetailPage;
