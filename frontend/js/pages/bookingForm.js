import api from '../api.js';
import { formatCurrency } from '../utils/formatters.js';
import auth from '../auth.js';
import { validateInternationalPhone, sanitizePhone } from '../utils/validators.js';
import { renderBookingReminderIfNeeded } from '../utils/onboarding.js';
import i18n from '../i18n.js';

const BookingFormPage = {
  property: null,

  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn()) {
      return `<div class="container"><p>${t('booking.loginRequired')}</p></div>`;
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
      return `<div class="container"><p class="error">${t('property.notFound')}</p></div>`;
    }

    if (!this.property) {
      return `<div class="container"><p class="error">${t('property.notFound')}</p></div>`;
    }

    const p = this.property;
    const nights = checkIn && checkOut
      ? Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
      : 0;
    const total = nights * p.price_per_night;

    return `
      <div class="booking-form-page">
        <div class="container">
          <h1>${t('booking.completeYourBooking')}</h1>
          ${renderBookingReminderIfNeeded()}
          
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
                  <span>${t('booking.checkIn')}:</span>
                  <span>${checkIn}</span>
                </div>
                <div class="info-row">
                  <span>${t('booking.checkOut')}:</span>
                  <span>${checkOut}</span>
                </div>
                <div class="info-row">
                  <span>${t('booking.nights')}:</span>
                  <span>${nights}</span>
                </div>
                <div class="info-row">
                  <span>${t('booking.guests')}:</span>
                  <span>${numGuests}</span>
                </div>
                <div class="info-row">
                  <span>${t('booking.pricePerNight')}:</span>
                  <span>${formatCurrency(p.price_per_night)}</span>
                </div>
                <div class="info-row total">
                  <span>${t('booking.total')}:</span>
                  <span>${formatCurrency(total)}</span>
                </div>
                <div class="info-row fee">
                  <span>${t('booking.fee')}:</span>
                  <span>${formatCurrency(7)}</span>
                </div>
              </div>
              
              <div id="payment-options-section" class="payment-options">
                <h3>${t('booking.paymentOptions')}</h3>
                <label class="radio-option">
                  <input type="radio" name="payment_option" value="full_payment" checked>
                  <span>${t('booking.fullPayment')}</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="payment_option" value="daily_payment">
                  <span>${t('booking.dailyPayment')}</span>
                </label>
              </div>
            </div>
            
            <div class="booking-form-sidebar">
              <form id="booking-confirm-form">
                <h3>${t('booking.yourInformation')}</h3>
                
                <div class="form-group">
                  <label>${t('auth.name')}</label>
                  <input type="text" id="tourist-name" value="${auth.getUser()?.name || ''}" required>
                </div>
                
                <div class="form-group">
                  <label>${t('auth.email')}</label>
                  <input type="email" id="tourist-email" required>
                </div>
                
                <div class="form-group">
                  <label>${t('booking.phoneLabel')}</label>
                  <input type="tel" id="tourist-phone" placeholder="+53 5xxxxxxx" required>
                  <small class="field-hint">${t('booking.phoneHint')}</small>
                </div>
                
                <div class="form-group">
                  <label>${t('booking.preferredContact')}</label>
                  <select id="contact-method">
                    <option value="email">${t('auth.email')}</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                
                <div id="error-message" class="error-message" style="display:none;"></div>
                
                <button type="submit" class="btn btn-primary btn-block">
                  ${t('booking.confirm')}
                </button>
                
                <p class="fee-notice" id="fee-notice">
                   ${t('booking.feeNotice')}
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

    const phone = sanitizePhone(document.getElementById('tourist-phone')?.value?.trim());
    if (!validateInternationalPhone(phone)) {
      errorEl.textContent = i18n.t('booking.invalidPhone');
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
        window.location.href = `/payment/checkout?booking_id=${bookingId}`;
      }
    } catch (error) {
      errorEl.textContent = error.message || i18n.t('booking.failed');
      errorEl.style.display = 'block';
    }
  }
};

export default BookingFormPage;
