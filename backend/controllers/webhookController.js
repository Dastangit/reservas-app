const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const OrphanedPayment = require('../models/OrphanedPayment');
const { findTransactionByRemoteId } = require('../utils/qvapay');
const { notifyAdmins } = require('../utils/pushNotifications');

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

    // TODO: confirmar el string exacto de "pagado" contra una transaccion
    // real de prueba pagada -- se asume 'paid'/'completed' segun la
    // documentacion publica disponible, pero QvaPay podria usar otro valor
    // (por ejemplo 'success', 'complete', etc.). Revisar el campo real que
    // devuelve /v2/transactions para un item pagado antes de ir a produccion.
    const status = transaction.status;
    const isPaid = ['paid', 'completed', 'success', 'complete'].includes(status);
    const isFailed = ['cancelled', 'canceled', 'expired', 'failed'].includes(status);

    const payment = await Payment.findOne({ order_id: String(remoteId) });
    if (payment) {
      payment.payment_status = isPaid ? 'finished' : isFailed ? status : 'waiting';
      payment.raw_response = transaction;
      await payment.save();
    }

    const booking = await Booking.findById(remoteId);

    if (booking) {
      if (isPaid && booking.status === 'pending_payment') {
        booking.status = 'pending_approval';
        booking.payment_stage = 'paid';
        booking.fee_paid = true;
        booking.fee_paid_at = new Date();
        booking.fee_transaction_id = String(transaction.transaction_uuid || transaction.uuid || '');
        booking.status_history.push({
          status: 'pending_approval',
          changed_at: new Date(),
          changed_by: 'system',
        });

        notifyAdmins(booking.tenant_id, {
          title: 'Nueva reserva pendiente de aprobacion',
          body: `Reserva ${booking._id.toString().slice(-6)} pagada, lista para revisar.`,
          url: '/admin/bookings',
        });
      } else if (isFailed && booking.status === 'pending_payment') {
        booking.status = 'cancelled';
        booking.payment_stage = status;
        booking.status_history.push({
          status: 'cancelled',
          changed_at: new Date(),
          changed_by: 'system',
        });
      } else {
        booking.payment_stage = 'pending';
      }

      if (booking.isModified()) {
        await booking.save();
      }
    } else {
      await OrphanedPayment.create({
        invoice_id: String(transaction.transaction_uuid || transaction.uuid || ''),
        order_id: String(remoteId),
        payment_status: status,
        price_amount: transaction.amount,
        price_currency: 'USD',
        reason: 'booking_not_found',
        raw_payload: transaction,
      }).then(() => {
        notifyAdmins(null, {
          title: 'Pago huerfano detectado',
          body: 'Un pago de QvaPay no se pudo asociar a ninguna reserva.',
          url: '/admin/orphaned-payments',
        });
      }).catch((err) => console.error('[QvaPay webhook] No se pudo registrar pago huerfano:', err));
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
