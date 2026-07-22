import api from '../api.js';
import { formatCurrency } from '../utils/formatters.js';

const BookingConfirmationPage = {
  async render() {
    const bookingId = this._params?.bookingId;

    try {
      const response = await api.get(`/bookings/${bookingId}`);
      const booking = response.data?.booking;

      if (!booking) {
        return '<div class="container"><p class="error">Booking not found</p></div>';
      }

      return `
        <div class="confirmation-page">
          <div class="container">
            <div class="confirmation-card">
              <div class="confirmation-icon">&#10003;</div>
              <h1>Booking Confirmed!</h1>
              <p class="confirmation-subtitle">Your payment has been received</p>
              
              <div class="confirmation-details">
                <div class="detail-row">
                  <span>Booking ID:</span>
                  <span>${booking._id}</span>
                </div>
                <div class="detail-row">
                  <span>Property:</span>
                  <span>${booking.property_id?.name || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span>Check-in:</span>
                  <span>${new Date(booking.check_in).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                  <span>Check-out:</span>
                  <span>${new Date(booking.check_out).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                  <span>Status:</span>
                  <span class="status-badge pending">Pending Approval</span>
                </div>
              </div>
              
              <div class="confirmation-message">
                <p><strong>What happens next?</strong></p>
                <p>Your booking is pending admin approval. You will receive an email once it's approved.</p>
                <p>The admin will contact you with check-in details.</p>
              </div>
              
              <div class="confirmation-contact">
                <p><strong>Contact Administrator:</strong></p>
                <p>Email: supportdaelworld@gmail.com</p>
              </div>
              
              <div class="confirmation-actions">
                <a href="/dashboard" data-link class="btn btn-primary">View My Bookings</a>
                <a href="/" data-link class="btn btn-outline">Back to Home</a>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      return '<div class="container"><p class="error">Error loading booking details</p></div>';
    }
  },

  init() {}
};

export default BookingConfirmationPage;
