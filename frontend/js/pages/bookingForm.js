import api from '../api.js';
import { formatCurrency } from '../utils/formatters.js';
import auth from '../auth.js';
import { validateInternationalPhone } from '../utils/validators.js';

const BookingFormPage = {
  property: null,

  async render() {
    if (!auth.isLoggedIn()) {
      return '<div class="container"><p>Please <a href="/login" data-link>login</a> to make a booking.</p></div>';
    }

    const propertyId = this._params?.propertyId;
    const params = new URLSearchParams(window.location.search);

    const checkIn = params.get('check_in') || '';
    const checkOut = params.get('check_out') || '';
    const numGuests = params.get('num_guests') || '1';

    try {
      const response = await api.get(`/properties/${propertyId}`);
      this.property = response.data?.property;
    } catch (error) {
      return '<div class="container"><p class="error">Property not found</p></div>';
    }

    if (!this.property) {
      return '<div class="container"><p class="error">Property not found</p></div>';
    }

    const p = this.property;
    const nights = checkIn && checkOut
      ? Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
      : 0;
    const total = nights * p.price_per_night;

    return `
      <div class="booking-form-page">
        <div class="container">
          <h1>Complete Your Booking</h1>
          
          <div class="booking-layout">
            <div class="booking-details">
              <div class="property-summary">
                <img src="${p.images?.[0]?.url || 'https://via.placeholder.com/100'}" alt="${p.name}">
                <div>
                  <h3>${p.name}</h3>
                  <p>${p.location?.city}</p>
                </div>
              </div>
              
              <div class="booking-info">
                <div class="info-row">
                  <span>Check-in:</span>
                  <span>${checkIn}</span>
                </div>
                <div class="info-row">
                  <span>Check-out:</span>
                  <span>${checkOut}</span>
                </div>
                <div class="info-row">
                  <span>Nights:</span>
                  <span>${nights}</span>
                </div>
                <div class="info-row">
                  <span>Guests:</span>
                  <span>${numGuests}</span>
                </div>
                <div class="info-row">
                  <span>Price per night:</span>
                  <span>${formatCurrency(p.price_per_night)}</span>
                </div>
                <div class="info-row total">
                  <span>Total:</span>
                  <span>${formatCurrency(total)}</span>
                </div>
                <div class="info-row fee">
                  <span>Booking Fee:</span>
                  <span>${formatCurrency(7)}</span>
                </div>
              </div>
              
              <div id="payment-options-section" class="payment-options">
                <h3>Payment at Accommodation</h3>
                <label class="radio-option">
                  <input type="radio" name="payment_option" value="full_payment" checked>
                  <span>Full payment on arrival</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="payment_option" value="daily_payment">
                  <span>Daily payment (flexible)</span>
                </label>
              </div>
            </div>
            
            <div class="booking-form-sidebar">
              <form id="booking-confirm-form">
                <h3>Your Information</h3>
                
                <div class="form-group">
                  <label>Name</label>
                  <input type="text" id="tourist-name" value="${auth.getUser()?.name || ''}" required>
                </div>
                
                <div class="form-group">
                  <label>Email</label>
                  <input type="email" id="tourist-email" required>
                </div>
                
                <div class="form-group">
                  <label>Phone (WhatsApp) *</label>
                  <input type="tel" id="tourist-phone" placeholder="+53 5xxxxxxx" required>
                  <small class="field-hint">Include country code, e.g. +53, +1, +34</small>
                </div>
                
                <div class="form-group">
                  <label>Preferred Contact</label>
                  <select id="contact-method">
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                
                <div id="error-message" class="error-message" style="display:none;"></div>
                
                <button type="submit" class="btn btn-primary btn-block">
                  Pay $7 Fee & Book
                </button>
                
                <p class="fee-notice" id="fee-notice">
                   * The $7 USD fee is non-refundable and secures your reservation.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init() {
    const form = document.getElementById('booking-confirm-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleBooking();
      });
    }
  },

  async handleBooking() {
    const propertyId = this._params?.propertyId;
    const params = new URLSearchParams(window.location.search);
    const errorEl = document.getElementById('error-message');

    const phone = document.getElementById('tourist-phone')?.value?.trim();
    if (!validateInternationalPhone(phone)) {
      errorEl.textContent = 'Please enter a valid phone number with country code (e.g. +5355512345)';
      errorEl.style.display = 'block';
      return;
    }

    const bookingData = {
      property_id: propertyId,
      check_in: params.get('check_in'),
      check_out: params.get('check_out'),
      num_guests: parseInt(params.get('num_guests') || '1'),
      booking_type: 'pre_booking',
      payment_option: document.querySelector('input[name="payment_option"]:checked')?.value,
      tourist_data: {
        name: document.getElementById('tourist-name')?.value,
        email: document.getElementById('tourist-email')?.value,
        phone,
        contact_method: document.getElementById('contact-method')?.value,
        language: window.i18n?.currentLang || 'es',
      },
    };

    try {
      const response = await api.post('/bookings', bookingData);

      if (response.success) {
        const bookingId = response.data.booking_id;
        const invoiceRes = await api.post('/payments/create-invoice', { booking_id: bookingId });
        if (invoiceRes.success && invoiceRes.data.invoice_url) {
          window.location.href = invoiceRes.data.invoice_url;
        } else {
          window.location.href = `/booking/confirmation/${bookingId}`;
        }
      }
    } catch (error) {
      errorEl.textContent = error.message || 'Booking failed';
      errorEl.style.display = 'block';
    }
  }
};

export default BookingFormPage;
