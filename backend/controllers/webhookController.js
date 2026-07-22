const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const OrphanedPayment = require('../models/OrphanedPayment');
const { verifyIpnSignature } = require('../utils/nowpayments');

exports.handleNowPaymentsWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-nowpayments-sig'];

    if (!signature) {
      return res.status(401).json({ success: false, error: 'Missing signature' });
    }

    const isValid = verifyIpnSignature(req.body, signature);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const { payment_id, payment_status, order_id, actually_paid, pay_amount, pay_currency, price_amount, price_currency } = req.body;

    const payment = await Payment.findOne({ invoice_id: String(req.body.invoice_id) });
    if (payment) {
      payment.payment_id = payment_id ? String(payment_id) : payment.payment_id;
      payment.payment_status = payment_status;
      if (actually_paid !== undefined) payment.actually_paid = actually_paid;
      if (pay_amount !== undefined) payment.pay_amount = pay_amount;
      if (pay_currency !== undefined) payment.pay_currency = pay_currency;
      payment.raw_response = req.body;
      await payment.save();
    }

    if (order_id) {
      const booking = await Booking.findById(order_id);

      if (booking) {
        const oldStatus = booking.status;

        // payment_stage se actualiza siempre que el estado sea reconocido, sin
        // importar si cambia el status principal de la reserva -- así el turista
        // y el host pueden ver "pago en camino / confirmando" en vez de que la
        // reserva parezca colgada sin explicación.
        const recognizedStages = ['waiting', 'confirming', 'sending', 'partially_paid', 'finished', 'failed', 'expired'];
        if (recognizedStages.includes(payment_status)) {
          booking.payment_stage = payment_status;
        }

        switch (payment_status) {
          case 'finished':
            if (booking.status === 'pending_payment') {
              booking.status = 'pending_approval';
              booking.fee_paid = true;
              booking.fee_paid_at = new Date();
              booking.fee_transaction_id = payment_id ? String(payment_id) : undefined;
              booking.payment_needs_review = false;
              booking.status_history.push({
                status: 'pending_approval',
                changed_at: new Date(),
                changed_by: 'system',
              });
            }
            break;

          case 'failed':
          case 'expired':
            if (booking.status === 'pending_payment') {
              booking.status = 'cancelled';
              booking.status_history.push({
                status: 'cancelled',
                changed_at: new Date(),
                changed_by: 'system',
              });
            }
            break;

          case 'partially_paid':
            // NOWPayments ya tiene configurado un umbral de cobertura para que
            // faltantes mínimos de red se resuelvan solos como "finished". Si
            // igual llega partially_paid, es un faltante real -- no se aprueba
            // automáticamente, se marca para revisión manual del admin.
            booking.payment_needs_review = true;
            booking.status_history.push({
              status: booking.status,
              changed_at: new Date(),
              changed_by: 'system',
            });
            break;

          case 'waiting':
          case 'confirming':
          case 'sending':
            // Solo actualiza payment_stage (ya hecho arriba). La reserva sigue
            // en pending_payment -- sin esto el tourist/host no veía ninguna
            // señal de que el pago ya iba en camino en la blockchain.
            break;
        }

        if (booking.isModified()) {
          await booking.save();
        }
      } else {
        // order_id presente pero no corresponde a ninguna reserva (borrada,
        // corrupta, o un IPN falso). Se registra para revisión manual.
        await OrphanedPayment.create({
          invoice_id: req.body.invoice_id ? String(req.body.invoice_id) : undefined,
          payment_id: payment_id ? String(payment_id) : undefined,
          order_id: String(order_id),
          payment_status,
          price_amount,
          price_currency,
          actually_paid,
          pay_currency,
          reason: 'booking_not_found',
          raw_payload: req.body,
        }).catch((err) => console.error('[NOWPayments IPN] No se pudo registrar pago huérfano:', err));
      }
    } else {
      // IPN sin order_id válido -- pago huérfano, no se puede asociar a ninguna reserva.
      await OrphanedPayment.create({
        invoice_id: req.body.invoice_id ? String(req.body.invoice_id) : undefined,
        payment_id: payment_id ? String(payment_id) : undefined,
        payment_status,
        price_amount,
        price_currency,
        actually_paid,
        pay_currency,
        reason: 'missing_order_id',
        raw_payload: req.body,
      }).catch((err) => console.error('[NOWPayments IPN] No se pudo registrar pago huérfano:', err));
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
