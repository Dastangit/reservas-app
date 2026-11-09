import i18n from '../i18n.js';
import { escapeHtml } from './escape.js';
import { formatCurrency } from './formatters.js';

// Desglose de lo que paga el turista: la tarifa ahora (a Elysio) y la estancia
// al llegar (al anfitrion). Mismos rotulos en la ficha, el formulario y el pago,
// para que nunca parezca que el total incluye la tarifa o se paga online.
// Los ids stay-detail / total-amount permiten actualizarlo al cambiar fechas.
export function paymentSplitHtml({ fee = formatCurrency(7), stayAmount = '', stayDetail = '' } = {}) {
  const t = (key) => i18n.t(key);
  return `
    <div class="payment-split">
      <div class="payment-split-row now">
        <span><strong>${t('booking.payNowLabel')}</strong><small>${t('booking.payNowHint')}</small></span>
        <b>${escapeHtml(fee)}</b>
      </div>
      <div class="payment-split-row">
        <span><strong>${t('booking.payAtStayLabel')}</strong><small id="stay-detail">${escapeHtml(stayDetail)}</small></span>
        <b id="total-amount">${escapeHtml(stayAmount)}</b>
      </div>
    </div>`;
}
