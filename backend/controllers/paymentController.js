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

    const invoice = await createQvaPayInvoice({
      amount: booking.fee_amount,
      description: 'Da-El Travels - Booking Service Fee',
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

    const booking = await Booking.findOne({
      _id: booking_id,
      tenant_id: req.tenantId,
      tourist_id: req.user._id,
      payment_method: 'paypal_manual',
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    booking.payment_needs_review = true;
    await booking.save();

    notifyAdmins(booking.tenant_id, {
      title: 'Pago manual de PayPal por confirmar',
      body: `Reserva ${booking._id.toString().slice(-6)}: el turista dice haber pagado el fee. Revisa la cuenta de PayPal y confirma en el panel.`,
      url: '/admin/bookings',
    });

    res.json({ success: true, data: { booking_id: booking._id } });
  } catch (error) {
    next(error);
  }
};
