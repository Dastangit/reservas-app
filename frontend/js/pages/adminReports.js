import api from '../api.js';
import { formatCurrency } from '../utils/formatters.js';
import auth from '../auth.js';

const AdminReportsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Access denied. Please login as admin.</p></div>';
    }

    return `
      <div class="admin-reports-page">
        <div class="container">
          <h1>Reports</h1>
          
          <div class="reports-grid">
            <div class="report-card">
              <h3>Booking Statistics</h3>
              <div id="booking-stats">
                <p class="loading">Loading...</p>
              </div>
            </div>
            
            <div class="report-card">
              <h3>Revenue Summary</h3>
              <div id="revenue-stats">
                <p class="loading">Loading...</p>
              </div>
            </div>
          </div>


        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    try {
      const dashRes = await api.get('/admin/dashboard');
      const stats = dashRes.data?.stats;

      if (stats) {
        document.getElementById('booking-stats').innerHTML = `
          <div class="stat-row">
            <span>Total Bookings Today:</span>
            <span>${stats.bookings_today}</span>
          </div>
          <div class="stat-row">
            <span>Pending Approvals:</span>
            <span>${stats.pending_approvals_bookings}</span>
          </div>
          <div class="stat-row">
            <span>Total Properties:</span>
            <span>${stats.total_properties}</span>
          </div>
          <div class="stat-row">
            <span>Total Users:</span>
            <span>${stats.total_users}</span>
          </div>
        `;

        document.getElementById('revenue-stats').innerHTML = `
          <div class="stat-row">
            <span>Total Revenue (Fees):</span>
            <span>${formatCurrency(stats.total_revenue)}</span>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  }
};

export default AdminReportsPage;
