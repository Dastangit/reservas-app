import api from '../api.js';
import { formatCurrency } from '../utils/formatters.js';
import i18n from '../i18n.js';

const BookingConfirmationPage = {
  async render() {
    const t = (key) => i18n.t(key);
    const bookingId = this._params?.bookingId;

    try {
      const response = await api.get(`/bookings/${bookingId}`);
      const booking = response.data?.booking;

      if (!booking) {
        return `<div class="container"><p class="error">${t('booking.bookingNotFound')}</p></div>`;
      }

      return `
        <div class="confirmation-page">
          <div class="container">
            <div class="confirmation-card">
              <div class="confirmation-icon">&#10003;</div>
              <h1>${t('confirmation.title')}</h1>
              <p class="confirmation-subtitle">${t('confirmation.subtitle')}</p>
              
              <div class="confirmation-details">
                <div class="detail-row">
                  <span>${t('booking.bookingId')}</span>
                  <span>${booking._id}</span>
                </div>
                <div class="detail-row">
                  <span>${t('booking.propertyLabel')}</span>
                  <span>${booking.property_id?.name || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span>${t('booking.checkIn')}:</span>
                  <span>${new Date(booking.check_in).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                  <span>${t('booking.checkOut')}:</span>
                  <span>${new Date(booking.check_out).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                  <span>${t('booking.statusLabel')}</span>
                  <span class="status-badge pending">${t('booking.statusPendingApproval')}</span>
                </div>
              </div>
              
              <div class="confirmation-message">
                <p><strong>${t('confirmation.whatNext')}</strong></p>
                <p>${t('confirmation.pendingMessage')}</p>
                <p>${t('confirmation.adminContact')}</p>
              </div>
              
              <div class="confirmation-contact">
                <p><strong>${t('confirmation.contactAdmin')}:</strong></p>
                <p>Email: elysio.support@gmail.com</p>
              </div>
              
              <div class="confirmation-actions">
                <a href="/dashboard" data-link class="btn btn-primary">${t('booking.viewMyBookings')}</a>
                <a href="/" data-link class="btn btn-outline">${t('common.backToHome')}</a>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      return `<div class="container"><p class="error">${t('booking.errorLoadingDetails')}</p></div>`;
    }
  },

  init() {}
};

export default BookingConfirmationPage;
