import api from '../api.js';
import BookingCard from '../components/BookingCard.js';
import auth from '../auth.js';
import i18n from '../i18n.js';

const AdminBookingsPage = {
  async render() {
    const t = (key) => i18n.t(key);

    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-bookings-page">
        <div class="container">
          <h1>${t('admin.manageBookings')}</h1>
          
          <div class="dashboard-tabs">
            <button class="tab-btn active" data-tab="all">${t('dashboard.all')}</button>
            <button class="tab-btn" data-tab="pending_payment">${t('booking.statusPendingPayment')}</button>
            <button class="tab-btn" data-tab="pending_approval">${t('dashboard.pending')}</button>
            <button class="tab-btn" data-tab="approved">${t('dashboard.approved')}</button>
            <button class="tab-btn" data-tab="completed">${t('dashboard.completed')}</button>
            <button class="tab-btn" data-tab="rejected">${t('booking.statusRejected')}</button>
          </div>
          
          <div id="bookings-list">
            <p class="loading">${t('admin.loadingBookings')}</p>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) return;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.loadBookings(e.target.dataset.tab);
      });
    });

    await this.loadBookings('all');

    window.approveBooking = async (id) => {
      try {
        await api.post(`/bookings/${id}/approve`);
        alert(i18n.t('admin.bookingApproved'));
        this.loadBookings('all');
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.rejectBooking = async (id) => {
      const reason = prompt(i18n.t('admin.enterRejectionReason'));
      if (reason) {
        try {
          await api.post(`/bookings/${id}/reject`, { reason });
          alert(i18n.t('admin.bookingRejected'));
          this.loadBookings('all');
        } catch (error) {
          alert(i18n.t('common.errorPrefix') + error.message);
        }
      }
    };

    window.completeBooking = async (id) => {
      try {
        await api.post(`/bookings/${id}/complete`);
        alert(i18n.t('host.bookingCompleted'));
        this.loadBookings('all');
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.notifyHostWhatsApp = async (id) => {
      try {
        const response = await api.get(`/admin/bookings/${id}/whatsapp-link`);
        const url = response.data?.url;
        if (url) {
          window.open(url, '_blank');
        } else {
          alert(i18n.t('admin.hostNoPhoneRegistered'));
        }
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.notifyTouristWhatsApp = async (id) => {
      const type = document.getElementById(`tourist-msg-type-${id}`)?.value || 'payment_received';
      try {
        const response = await api.get(`/admin/bookings/${id}/tourist-contact-links?type=${type}`);
        const url = response.data?.whatsapp_url;
        if (url) {
          window.open(url, '_blank');
        } else {
          alert(i18n.t('admin.touristNoPhoneRegistered'));
        }
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.notifyTouristEmail = async (id) => {
      const type = document.getElementById(`tourist-msg-type-${id}`)?.value || 'payment_received';
      try {
        const response = await api.get(`/admin/bookings/${id}/tourist-contact-links?type=${type}`);
        const url = response.data?.mailto_url;
        if (url) {
          window.location.href = url;
        } else {
          alert(i18n.t('admin.touristNoEmailRegistered'));
        }
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };

    window.confirmManualPayment = async (id) => {
      const reference = prompt(i18n.t('admin.paymentReferencePrompt')) || undefined;
      try {
        await api.post(`/admin/bookings/${id}/confirm-manual-payment`, { reference });
        alert(i18n.t('admin.paymentConfirmedMoved'));
        this.loadBookings(document.querySelector('.tab-btn.active')?.dataset.tab || 'all');
      } catch (error) {
        alert(i18n.t('common.errorPrefix') + error.message);
      }
    };
  },

  async loadBookings(filter = 'all') {
    const list = document.getElementById('bookings-list');
    if (!list) return;

    list.innerHTML = `<p class="loading">${i18n.t('common.loading')}</p>`;

    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await api.get(`/admin/bookings${params}`);
      const bookings = response.data?.bookings || [];

      if (bookings.length === 0) {
        list.innerHTML = `<p class="no-results">${i18n.t('admin.noBookingsFound')}</p>`;
        return;
      }

      list.innerHTML = BookingCard.renderList(bookings, 'admin');
    } catch (error) {
      list.innerHTML = `<p class="error">${i18n.t('dashboard.errorLoading')}</p>`;
    }
  }
};

export default AdminBookingsPage;
