const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const { findTransactionByRemoteId } = require('../utils/qvapay');
const { classifyQvaPayStatus, recordOrphanedPayment, settleQvaPayTransaction } = require('../utils/qvapaySettlement');

// No hay documentacion confiable de que QvaPay firme el payload del webhook
// (a diferencia de NOWPayments, que usa HMAC-SHA512 con un secreto compartido).
// Por seguridad, el webhook NUNCA se usa como fuente de verdad por si solo --
// solo dispara una re-consulta autenticada a la API de QvaPay
// (findTransactionByRemoteId) usando nuestras propias credenciales, y es esa
// respuesta la que decide que pasa con la reserva. Asi, alguien que mande un
// POST falso al webhook no puede aprobar una reserva sin haber pagado de verdad.
exports.handleQvaPayWebhook = async (req, res, next) => {
  try {
    const remoteId = req.body.remote_id || req.body.order_id;

    if (!remoteId) {
      return res.status(400).json({ success: false, error: 'Missing remote_id' });
    }

    let transaction;
    try {
      transaction = await findTransactionByRemoteId(remoteId);
    } catch (err) {
      console.error('[QvaPay webhook] No se pudo re-consultar la transaccion:', err.message);
      return res.status(202).json({ success: true, note: 'Could not verify transaction yet, will retry' });
    }

    if (!transaction) {
      // Puede pasar si el webhook llega antes de que la transaccion aparezca
      // en la lista de QvaPay -- no es un error fatal, solo no se puede
      // confirmar todavia. No se toca la reserva.
      return res.status(202).json({ success: true, note: 'Transaction not found yet in QvaPay list' });
    }

    const { isPaid, isFailed } = classifyQvaPayStatus(transaction.status);

    const payment = await Payment.findOne({ order_id: String(remoteId), method: 'qvapay' }).sort({ created_at: -1 });
    if (payment) {
      // El enum de Payment no conoce 'cancelled'/'canceled': todo fallo se guarda como 'failed'.
      payment.payment_status = isPaid ? 'finished' : isFailed ? 'failed' : 'waiting';
      payment.raw_response = transaction;
      await payment.save();
    }

    const booking = mongoose.Types.ObjectId.isValid(remoteId) ? await Booking.findById(remoteId) : null;

    if (booking) {
      await settleQvaPayTransaction(booking, transaction);
    } else {
      await recordOrphanedPayment(
        transaction, remoteId, 'booking_not_found', null,
        'Un pago de QvaPay no se pudo asociar a ninguna reserva.',
      ).catch((err) => console.error('[QvaPay webhook] No se pudo registrar pago huerfano:', err));
    }
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
