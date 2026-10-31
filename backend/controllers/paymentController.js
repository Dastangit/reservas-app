const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const { createInvoice: createQvaPayInvoice } = require('../utils/qvapay');
const { buildPaypalManualLink } = require('../utils/paypalManual');
const { notifyAdmins } = require('../utils/pushNotifications');
const env = require('../config/env');

exports.createInvoice = async (req, res, next) => {
  try {
    const { booking_id } = req.body;

    if (!booking_id) {
      return res.status(400).json({ success: false, error: 'Booking ID is required' });
    }

    const booking = await Booking.findOne({
      _id: booking_id,
      tenant_id: req.tenantId,
      tourist_id: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'pending_payment') {
      return res.status(400).json({ success: false, error: 'Booking is not pending payment' });
    }

    // Reutiliza la factura abierta: crear una nueva en cada clic permitia pagar
    // dos veces la misma reserva (el segundo pago se perdia sin aviso).
    const existing = await Payment.findOne({
      booking_id: booking._id,
      method: 'qvapay',
      payment_status: 'waiting',
      invoice_url: { $exists: true, $ne: null },
    }).sort({ created_at: -1 });
    if (existing) {
      return res.status(200).json({
        success: true,
        data: { invoice_url: existing.invoice_url, invoice_id: existing.invoice_id, payment_id: existing._id },
      });
    }

    const invoice = await createQvaPayInvoice({
      amount: booking.fee_amount,
      description: 'Elysio Experiences - Booking Service Fee',
      remote_id: booking._id.toString(),
      webhook: `${env.apiUrl}/api/webhooks/qvapay`,
      expire_at: booking.hold_expires_at ? booking.hold_expires_at.toISOString() : undefined,
    });

    const payment = await Payment.create({
      booking_id: booking._id,
      user_id: req.user._id,
      tenant_id: req.tenantId,
      invoice_id: String(invoice.transaction_uuid),
      price_amount: booking.fee_amount,
      price_currency: 'USD',
      payment_status: 'waiting',
      order_id: booking._id.toString(),
      invoice_url: invoice.url,
      raw_response: invoice,
    });

    booking.invoice_id = String(invoice.transaction_uuid);
    booking.invoice_url = invoice.url;
    booking.payment_method = 'qvapay';
    await booking.save();

    res.status(201).json({
      success: true,
      data: {
        invoice_url: invoice.url,
        invoice_id: invoice.transaction_uuid,
        payment_id: payment._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Genera el link de pago manual (paypal.me) para el turista. No hay
// integracion de API con PayPal -- el pago ocurre por fuera del sistema y
// alguien (el admin, tras avisarle el turista) lo confirma a mano despues.
exports.createManualPaypalRequest = async (req, res, next) => {
  try {
    const { booking_id } = req.body;

    if (!booking_id) {
      return res.status(400).json({ success: false, error: 'Booking ID is required' });
    }

    const booking = await Booking.findOne({
      _id: booking_id,
      tenant_id: req.tenantId,
      tourist_id: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'pending_payment') {
      return res.status(400).json({ success: false, error: 'Booking is not pending payment' });
    }

    const paypalUrl = buildPaypalManualLink(booking.fee_amount);
    if (!paypalUrl) {
      return res.status(500).json({ success: false, error: 'Manual PayPal payment is not configured' });
    }

    const payment = await Payment.create({
      booking_id: booking._id,
      user_id: req.user._id,
      tenant_id: req.tenantId,
      method: 'paypal_manual',
      price_amount: booking.fee_amount,
      price_currency: 'USD',
      payment_status: 'waiting',
      order_id: booking._id.toString(),
      invoice_url: paypalUrl,
    });

    booking.invoice_url = paypalUrl;
    booking.payment_method = 'paypal_manual';
    booking.payment_stage = 'pending';
    await booking.save();

    res.status(201).json({
      success: true,
      data: {
        paypal_url: paypalUrl,
        payment_id: payment._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// El turista pulsa "Ya pague" tras volver de PayPal -- esto no confirma nada
// por si solo (no hay forma de verificarlo automaticamente), solo le avisa
// al admin por push que hay un pago para revisar y confirmar a mano.
exports.notifyManualPaymentSent = async (req, res, next) => {
  try {
    const { booking_id } = req.body;
    // Todas las reservas pagan lo mismo: sin el ID de transaccion o el email
    // del pagador el admin no puede saber que deposito corresponde a cual.
    const reference = String(req.body.reference || '').trim().slice(0, 200);
    const payerEmail = String(req.body.payer_email || '').trim().toLowerCase().slice(0, 200);
    if (!reference && !payerEmail) {
      return res.status(400).json({ success: false, error: 'Please provide the PayPal transaction ID or the email you paid from' });
    }

    const booking = await Booking.findOne({
      _id: booking_id,
      tenant_id: req.tenantId,
      tourist_id: req.user._id,
      payment_method: 'paypal_manual',
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'pending_payment') {
      return res.status(400).json({ success: false, error: 'Booking is not pending payment' });
    }

    booking.payment_needs_review = true;
    booking.payment_reference = reference || undefined;
    booking.payer_email = payerEmail || undefined;
    booking.payment_reported_at = new Date();
    await booking.save();

    notifyAdmins(booking.tenant_id, {
      title: 'Pago manual de PayPal por confirmar',
      body: `Reserva ${booking._id.toString().slice(-6)}: el turista dice haber pagado (ref: ${reference || '-'}, pagador: ${payerEmail || '-'}). Revisa PayPal y confirma en el panel.`,
      telegramBody: `Reserva ${booking._id.toString().slice(-6)}: el turista dice haber pagado por PayPal. Revisa PayPal y confirma en el panel.`,
      url: '/admin/bookings',
    });

    res.json({ success: true, data: { booking_id: booking._id } });
  } catch (error) {
    next(error);
  }
};
