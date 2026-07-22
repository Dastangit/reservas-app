const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const { createInvoice } = require('../utils/nowpayments');
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

    const invoice = await createInvoice({
      price_amount: booking.fee_amount,
      price_currency: 'USD',
      order_id: booking._id.toString(),
      ipn_callback_url: `${env.apiUrl}/api/webhooks/nowpayments`,
      success_url: `${env.frontendUrl}/booking/confirmation/${booking._id}`,
      cancel_url: `${env.frontendUrl}/booking/${booking.property_id}`,
      is_fee_paid_by_user: false,
      is_fixed_rate: false,
    });

    const payment = await Payment.create({
      booking_id: booking._id,
      user_id: req.user._id,
      tenant_id: req.tenantId,
      invoice_id: String(invoice.id),
      price_amount: invoiceAmount,
      price_currency: 'USD',
      payment_status: 'waiting',
      order_id: booking._id.toString(),
      invoice_url: invoice.invoice_url,
      raw_response: invoice,
    });

    booking.invoice_id = String(invoice.id);
    booking.invoice_url = invoice.invoice_url;
    await booking.save();

    res.status(201).json({
      success: true,
      data: {
        invoice_url: invoice.invoice_url,
        invoice_id: invoice.id,
        payment_id: payment._id,
      },
    });
  } catch (error) {
    next(error);
  }
};
