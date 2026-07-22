import api from '../api.js';
import { formatCurrency, formatDate, getStatusColor } from '../utils/formatters.js';
import auth from '../auth.js';

const BookingSummaryPage = {
  async render() {
    if (!auth.isLoggedIn()) {
      return '<div class="container"><p>Please <a href="/login" data-link>login</a> to view booking details.</p></div>';
    }

    const bookingId = this._params?.id;

    try {
      const response = await api.get(`/bookings/${bookingId}`);
      const booking = response.data?.booking;

      if (!booking) {
        return '<div class="container"><p class="error">Booking not found</p></div>';
      }

      const statusColor = getStatusColor(booking.status);

      return `
        <div class="booking-summary-page">
          <div class="container">
            <h1>Booking Details</h1>
            
            <div class="booking-detail-card">
              <div class="booking-header">
                <h2>${booking.property_id?.name || 'Property'}</h2>
                <span class="status-badge" style="background-color: ${statusColor}">
                  ${booking.status.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              
              <div class="booking-body">
                <div class="detail-section">
                  <h3>Dates</h3>
                  <p><strong>Check-in:</strong> ${formatDate(booking.check_in)}</p>
                  <p><strong>Check-out:</strong> ${formatDate(booking.check_out)}</p>
                  <p><strong>Nights:</strong> ${booking.num_nights}</p>
                </div>
                
                <div class="detail-section">
                  <h3>Guests</h3>
                  <p>${booking.num_guests} guest(s)</p>
                </div>
                
                <div class="detail-section">
                  <h3>Payment</h3>
                  <p><strong>Total Amount:</strong> ${formatCurrency(booking.total_amount)}</p>
                  <p><strong>Fee Paid:</strong> ${formatCurrency(booking.fee_amount)}</p>
                  <p><strong>Payment Option:</strong> ${booking.payment_option === 'full_payment' ? 'Full payment on arrival' : 'Daily payment'}</p>
                  ${booking.status === 'pending_payment' ? `<p><strong>Payment Status:</strong> ${this.paymentStageLabel(booking.payment_stage)}</p>` : ''}
                </div>
                
                <div class="detail-section">
                  <h3>Contact Information</h3>
                  <p><strong>Name:</strong> ${booking.tourist_data?.name || 'N/A'}</p>
                  <p><strong>Email:</strong> ${booking.tourist_data?.email || 'N/A'}</p>
                  <p><strong>Phone:</strong> ${booking.tourist_data?.phone || 'N/A'}</p>
                </div>
                
                ${booking.status === 'pending_approval' || booking.status === 'pending_payment' ? `
                  <div class="booking-actions">
                    <button onclick="cancelBooking('${booking._id}')" class="btn btn-danger">Cancel Booking</button>
                  </div>
                ` : ''}
                
                ${booking.status === 'completed' ? `
                  <div class="booking-actions">
                    <a href="/review?booking_id=${booking._id}" data-link class="btn btn-primary">Write Review</a>
                  </div>
                ` : ''}
              </div>
              
              <div class="booking-contact">
                <h3>Contact Administrator</h3>
                <p>Email: supportdaelworld@gmail.com</p>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      return '<div class="container"><p class="error">Error loading booking details</p></div>';
    }
  },

  init() {
    window.cancelBooking = async (bookingId) => {
      if (confirm('Are you sure you want to cancel this booking?')) {
        try {
          await api.post(`/bookings/${bookingId}/cancel`);
          alert('Booking cancelled successfully');
          window.location.href = '/dashboard';
        } catch (error) {
          alert('Failed to cancel booking: ' + error.message);
        }
      }
    };
  },

  paymentStageLabel(stage) {
    const labels = {
      awaiting_payment: 'Awaiting payment',
      waiting: 'Waiting for your crypto payment',
      confirming: 'Payment received, confirming on the blockchain…',
      sending: 'Confirmed, finalizing…',
      partially_paid: 'Partial payment received — our team will contact you',
      finished: 'Payment complete',
      failed: 'Payment failed',
      expired: 'Payment window expired',
    };
    return labels[stage] || 'Awaiting payment';
  }
};

export default BookingSummaryPage;
