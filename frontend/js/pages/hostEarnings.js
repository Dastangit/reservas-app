import api from '../api.js';
import { formatCurrency } from '../utils/formatters.js';
import auth from '../auth.js';

const HostEarningsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isHost()) {
      return '<div class="container"><p>Access denied. Please login as a host.</p></div>';
    }

    return `
      <div class="earnings-page">
        <div class="container">
          <h1>My Earnings</h1>
          
          <div class="earnings-stats">
            <div class="stat-card">
              <h3>Total Earnings</h3>
              <p class="stat-number" id="total-earnings">$0</p>
            </div>
            <div class="stat-card">
              <h3>Completed Bookings</h3>
              <p class="stat-number" id="completed-count">0</p>
            </div>
          </div>
          
          <div class="earnings-note">
            <p><strong>Note:</strong> Payments are collected directly by guests at the accommodation. 
            The platform fee ($7 USD) is collected during booking and does not affect your earnings.</p>
          </div>
          
          <div id="earnings-list">
            <h2>Booking History</h2>
            <p class="loading">Loading...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isHost()) return;

    try {
      const response = await api.get('/bookings/host');
      const bookings = response.data?.bookings || [];

      const completed = bookings.filter(b => b.status === 'completed' || b.status === 'approved');
      const totalEarnings = completed.reduce((sum, b) => sum + (b.total_amount || 0), 0);

      document.getElementById('total-earnings').textContent = formatCurrency(totalEarnings);
      document.getElementById('completed-count').textContent = completed.length;

      const list = document.getElementById('earnings-list');
      if (completed.length === 0) {
        list.innerHTML += '<p>No completed bookings yet</p>';
      } else {
        list.innerHTML += completed.map(b => `
          <div class="earnings-item">
            <span>${b.property_id?.name || 'Property'}</span>
            <span>${new Date(b.check_out).toLocaleDateString()}</span>
            <span>${formatCurrency(b.total_amount)}</span>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
    }
  }
};

export default HostEarningsPage;
