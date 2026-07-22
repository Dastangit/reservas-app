import api from '../api.js';
import auth from '../auth.js';

const AdminOrphanedPaymentsPage = {
  async render() {
    if (!auth.isLoggedIn() || !auth.isAdmin()) {
      return '<div class="container"><p>Access denied. Please login as admin.</p></div>';
    }

    return `
      <div class="admin-orphaned-payments-page">
        <div class="container">
          <h1>Pagos sin reserva asociada</h1>
          <p class="page-subtitle">
            IPNs de NOWPayments que llegaron sin order_id v\u00e1lido o apuntando a una reserva
            que ya no existe. Revisa manualmente cada uno.
          </p>

          <div class="dashboard-tabs">
            <button class="tab-btn active" data-tab="false">Sin revisar</button>
            <button class="tab-btn" data-tab="true">Revisados</button>
            <button class="tab-btn" data-tab="all">Todos</button>
          </div>

          <div id="orphaned-list">
            <p class="loading">Cargando...</p>
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

    await this.loadOrphanedPayments('false');

    window.reviewOrphanedPayment = async (id) => {
      const notes = prompt('\u00bfC\u00f3mo se resolvi\u00f3 este pago? (ej. "aprobado manualmente en reserva X", "duplicado, ignorar")');
      if (notes === null) return;
      try {
        await api.post(`/admin/orphaned-payments/${id}/review`, { notes });
        alert('Marcado como revisado');
        this.loadOrphanedPayments('false');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    };
  },

  async loadOrphanedPayments(filter = 'false') {
    const list = document.getElementById('orphaned-list');
    if (!list) return;

    list.innerHTML = '<p class="loading">Cargando...</p>';

    try {
      const params = filter !== 'all' ? `?reviewed=${filter}` : '';
      const response = await api.get(`/admin/orphaned-payments${params}`);
      const payments = response.data?.payments || [];

      if (payments.length === 0) {
        list.innerHTML = '<p class="no-results">No hay pagos hu\u00e9rfanos en esta categor\u00eda</p>';
        return;
      }

      list.innerHTML = payments.map(p => `
        <div class="orphaned-payment-item">
          <div class="orphaned-payment-header">
            <span class="orphaned-payment-reason">${p.reason === 'missing_order_id' ? 'Sin order_id' : 'Reserva no encontrada'}</span>
            <span class="orphaned-payment-status">${p.payment_status || 'unknown'}</span>
            ${p.reviewed ? '<span class="badge-reviewed">Revisado</span>' : ''}
          </div>
          <div class="orphaned-payment-body">
            <p><strong>Fecha:</strong> ${new Date(p.created_at).toLocaleString()}</p>
            <p><strong>invoice_id:</strong> ${p.invoice_id || 'N/A'}</p>
            <p><strong>payment_id:</strong> ${p.payment_id || 'N/A'}</p>
            ${p.order_id ? `<p><strong>order_id (no encontrado):</strong> ${p.order_id}</p>` : ''}
            <p><strong>Monto:</strong> ${p.price_amount || '?'} ${p.price_currency || ''} ${p.actually_paid ? `(recibido: ${p.actually_paid} ${p.pay_currency || ''})` : ''}</p>
            ${p.resolution_notes ? `<p><strong>Notas:</strong> ${p.resolution_notes}</p>` : ''}
          </div>
          ${!p.reviewed ? `
            <div class="orphaned-payment-actions">
              <button onclick="reviewOrphanedPayment('${p._id}')" class="btn btn-primary btn-sm">Marcar como revisado</button>
            </div>
          ` : ''}
        </div>
      `).join('');
    } catch (error) {
      list.innerHTML = '<p class="error">Error cargando pagos hu\u00e9rfanos</p>';
    }
  }
};

export default AdminOrphanedPaymentsPage;
