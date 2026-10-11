import api from '../api.js';
import auth from '../auth.js';
import i18n from '../i18n.js';
import { escapeHtml } from '../utils/escape.js';

const t = (key) => i18n.t(key);

const reasonLabel = (reason) => {
  const key = `orphaned.reason.${reason}`;
  const label = i18n.t(key);
  return label === key ? reason : label;
};

const AdminOrphanedPaymentsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return `<div class="container"><p>${t('admin.accessDenied')}</p></div>`;
    }

    return `
      <div class="admin-orphaned-payments-page">
        <div class="container">
          <h1>${t('orphaned.title')}</h1>
          <p class="page-subtitle">${t('orphaned.subtitle')}</p>

          <div class="dashboard-tabs">
            <button class="tab-btn active" data-tab="false">${t('orphaned.tabPending')}</button>
            <button class="tab-btn" data-tab="true">${t('orphaned.tabReviewed')}</button>
            <button class="tab-btn" data-tab="all">${t('orphaned.tabAll')}</button>
          </div>

          <div id="orphaned-list">
            <p class="loading">${t('common.loading')}</p>
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
        this.loadOrphanedPayments(e.target.dataset.tab);
      });
    });

    window.reviewOrphanedPayment = async (id) => {
      const notes = prompt(t('orphaned.resolutionPrompt'));
      if (notes === null) return;
      try {
        await api.post(`/admin/orphaned-payments/${id}/review`, { notes });
        alert(t('orphaned.markedReviewed'));
        this.loadOrphanedPayments(document.querySelector('.tab-btn.active')?.dataset.tab || 'false');
      } catch (error) {
        alert(t('common.errorPrefix') + error.message);
      }
    };

    await this.loadOrphanedPayments('false');
  },

  async loadOrphanedPayments(filter = 'false') {
    const list = document.getElementById('orphaned-list');
    if (!list) return;

    list.innerHTML = `<p class="loading">${t('common.loading')}</p>`;

    try {
      const params = filter !== 'all' ? `?reviewed=${filter}` : '';
      const response = await api.get(`/admin/orphaned-payments${params}`);
      const payments = response.data?.payments || [];

      if (payments.length === 0) {
        list.innerHTML = `<p class="no-results">${t('orphaned.empty')}</p>`;
        return;
      }

      list.innerHTML = payments.map(p => `
        <div class="orphaned-payment-item">
          <div class="orphaned-payment-header">
            <span class="orphaned-payment-reason">${escapeHtml(reasonLabel(p.reason))}</span>
            <span class="orphaned-payment-status">${escapeHtml(p.payment_status || 'unknown')}</span>
            ${p.reviewed ? `<span class="badge-reviewed">${t('orphaned.reviewedBadge')}</span>` : ''}
          </div>
          <div class="orphaned-payment-body">
            <p><strong>${t('orphaned.date')}:</strong> ${new Date(p.created_at).toLocaleString(i18n.currentLang)}</p>
            <p><strong>invoice_id:</strong> ${escapeHtml(p.invoice_id || 'N/A')}</p>
            <p><strong>payment_id:</strong> ${escapeHtml(p.payment_id || 'N/A')}</p>
            ${p.order_id ? `<p><strong>order_id:</strong> ${escapeHtml(p.order_id)}</p>` : ''}
            <p><strong>${t('orphaned.amount')}:</strong> ${escapeHtml(p.price_amount ?? '?')} ${escapeHtml(p.price_currency || '')} ${p.actually_paid ? `(${t('orphaned.received')}: ${escapeHtml(p.actually_paid)} ${escapeHtml(p.pay_currency || '')})` : ''}</p>
            ${p.resolution_notes ? `<p><strong>${t('orphaned.notes')}:</strong> ${escapeHtml(p.resolution_notes)}</p>` : ''}
          </div>
          ${!p.reviewed ? `
            <div class="orphaned-payment-actions">
              <button data-action="reviewOrphanedPayment" data-arg="${p._id}" class="btn btn-primary btn-sm">${t('orphaned.markReviewed')}</button>
            </div>
          ` : ''}
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = `<p class="error">${t('orphaned.loadError')}</p>`;
    }
  }
};

export default AdminOrphanedPaymentsPage;
