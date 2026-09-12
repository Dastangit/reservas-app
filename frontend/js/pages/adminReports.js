import api from '../api.js';
import { formatCurrency } from '../utils/formatters.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const AdminReportsPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-reports-page">
        <div class="container">
          <h1>${t('admin.reportsTitle')}</h1>
          
          <div class="reports-grid">
            <div class="report-card">
              <h3>${t('admin.bookingStatisticsHeading')}</h3>
              <div id="booking-stats">
                <p class="loading">${t('common.loading')}</p>
              </div>
            </div>
            
            <div class="report-card">
              <h3>${t('admin.revenueSummaryHeading')}</h3>
              <div id="revenue-stats">
                <p class="loading">${t('common.loading')}</p>
              </div>
            </div>
          </div>


        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;
    const t = (key) => i18n.t(key);

    try {
      const dashRes = await api.get('/admin/dashboard');
      const stats = dashRes.data?.stats;

      if (stats) {
        document.getElementById('booking-stats').innerHTML = `
          <div class="stat-row">
            <span>${t('admin.totalBookingsTodayLabel')}</span>
            <span>${stats.bookings_today}</span>
          </div>
          <div class="stat-row">
            <span>${t('admin.pendingApprovals')}:</span>
            <span>${stats.pending_approvals_bookings}</span>
          </div>
          <div class="stat-row">
            <span>${t('admin.totalProperties')}:</span>
            <span>${stats.total_properties}</span>
          </div>
          <div class="stat-row">
            <span>${t('admin.totalUsers')}:</span>
            <span>${stats.total_users}</span>
          </div>
        `;

        document.getElementById('revenue-stats').innerHTML = `
          <div class="stat-row">
            <span>${t('admin.totalRevenueFeesLabel')}</span>
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
