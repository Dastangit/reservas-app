const Booking = require('../models/Booking');
const Property = require('../models/Property');
const {
  sendBookingConfirmation, sendBookingApproved, sendBookingRejected, sendHostBookingNotification,
} = require('../utils/email');

// Estados que ocupan las fechas de una propiedad.
const BLOCKING_STATUSES = ['pending_payment', 'pending_approval', 'approved'];

exports.createBooking = async (req, res, next) => {
  try {
    const {
      property_id, check_in, check_out, num_guests,
      booking_type, payment_option, tourist_data,
    } = req.body;

    const property = await Property.findOne({
      _id: property_id,
      tenant_id: req.tenantId,
      status: 'active',
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    if (num_guests > property.max_guests) {
      return res.status(400).json({ success: false, error: 'Too many guests' });
    }

    const isBlocked = property.blocked_dates.some((blocked) => {
      const blockStart = new Date(blocked.start_date);
      const blockEnd = new Date(blocked.end_date);
      const requestStart = new Date(check_in);
      const requestEnd = new Date(check_out);
      return requestStart < blockEnd && requestEnd > blockStart;
    });

    if (isBlocked) {
      return res.status(400).json({ success: false, error: 'Dates are not available' });
    }

    const existingBooking = await Booking.findOne({
      property_id,
      tenant_id: req.tenantId,
      status: { $in: BLOCKING_STATUSES },
      // Desigualdad estricta: una reserva puede entrar el dia que otra sale.
      check_in: { $lt: new Date(check_out) },
      check_out: { $gt: new Date(check_in) },
    });

    if (existingBooking) {
      return res.status(400).json({ success: false, error: 'Property already booked for these dates' });
    }

    const num_nights = Math.ceil(
      (new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24)
    );
    if (!(num_nights >= 1)) {
      return res.status(400).json({ success: false, error: 'Check-out must be after check-in' });
    }

    const total_amount = num_nights * property.price_per_night;

    const hold_expires_at = new Date();
    hold_expires_at.setHours(hold_expires_at.getHours() + 3);

    const booking = await Booking.create({
      tenant_id: req.tenantId,
      property_id,
      tourist_id: req.user._id,
      host_id: property.host_id,
      booking_type,
      check_in,
      check_out,
      num_nights,
      num_guests,
      total_amount,
      payment_option,
      tourist_data,
      hold_expires_at,
      status: 'pending_payment',
      status_history: [{ status: 'pending_payment', changed_at: new Date(), changed_by: 'system' }],
    });

    // El chequeo de conflicto de arriba y este create() no son atomicos: si dos
    // personas reservan las mismas fechas casi a la vez, ambas pueden pasar el
    // chequeo. Por eso verificamos DESPUES de crear y ANTES de responder: si hay
    // otra reserva vigente que solapa y se creo antes (menor _id), esta pierde.
    // Desempatar por _id garantiza que sobrevive exactamente una, incluso si las
    // dos se crearon en el mismo milisegundo.
    const earlierConflict = await Booking.findOne({
      _id: { $lt: booking._id },
      property_id,
      tenant_id: req.tenantId,
      status: { $in: BLOCKING_STATUSES },
      check_in: { $lt: new Date(check_out) },
      check_out: { $gt: new Date(check_in) },
    });

    if (earlierConflict) {
      await Booking.updateOne(
        { _id: booking._id, status: 'pending_payment' },
        {
          $set: { status: 'cancelled' },
          $push: { status_history: { status: 'cancelled', changed_at: new Date(), changed_by: 'system' } },
        },
      );
      console.error(`[Race condition] Booking ${booking._id} cancelada automaticamente -- otra reserva (${earlierConflict._id}) reclamo las mismas fechas primero.`);
      return res.status(400).json({ success: false, error: 'Property already booked for these dates' });
    }

    res.status(201).json({
      success: true,
      data: {
        booking_id: booking._id,
        hold_expires_at: booking.hold_expires_at,
        total_amount: booking.total_amount,
        fee_amount: booking.fee_amount,
      },
    });

    sendBookingConfirmation(req.user.email, booking, property).catch(() => {});
  } catch (error) {
    next(error);
  }
};

exports.getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({
      tenant_id: req.tenantId,
      tourist_id: req.user._id,
    })
      .populate('property_id', 'name location images')
      .sort({ created_at: -1 });

    res.json({ success: true, data: { bookings, count: bookings.length } });
  } catch (error) {
    next(error);
  }
};

exports.getHostBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({
      tenant_id: req.tenantId,
      host_id: req.user._id,
    })
      .populate('property_id', 'name location')
      .populate('tourist_id', 'name email')
      .sort({ created_at: -1 });

    res.json({ success: true, data: { bookings, count: bookings.length } });
  } catch (error) {
    next(error);
  }
};

exports.getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    })
      .populate('property_id', 'name location images price_per_night')
      .populate('tourist_id', 'name email phone')
      .populate('host_id', 'name email');

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const isOwner =
      booking.tourist_id._id.toString() === req.user._id.toString() ||
      booking.host_id._id.toString() === req.user._id.toString() ||
      req.user.role === 'admin';

    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    res.json({ success: true, data: { booking } });
  } catch (error) {
    next(error);
  }
};

exports.cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      tourist_id: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (!['pending_payment', 'pending_approval'].includes(booking.status)) {
      return res.status(400).json({ success: false, error: 'Cannot cancel booking in current status' });
    }

    booking.status = 'cancelled';
    booking.status_history.push({
      status: 'cancelled',
      changed_at: new Date(),
      changed_by: req.user._id,
    });
    await booking.save();

    res.json({ success: true, data: { booking_id: booking._id, status: 'cancelled' } });
  } catch (error) {
    next(error);
  }
};

exports.approveBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    }).populate('property_id', 'name').populate('tourist_id', 'email').populate('host_id', 'name email phone');

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'pending_approval') {
      return res.status(400).json({ success: false, error: 'Booking is not pending approval' });
    }

    booking.status = 'approved';
    booking.approved_by = req.user._id;
    booking.approved_at = new Date();
    if (req.body.notes) booking.admin_notes = req.body.notes;
    booking.status_history.push({
      status: 'approved',
      changed_at: new Date(),
      changed_by: req.user._id,
    });
    await booking.save();

    res.json({ success: true, data: { booking_id: booking._id, status: 'approved', notifications_sent: true } });

    if (booking.tourist_id?.email) {
      sendBookingApproved(booking.tourist_id.email, booking, booking.property_id).catch(() => {});
    }
    if (booking.host_id?.email) {
      sendHostBookingNotification(booking.host_id.email, booking, booking.property_id).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
};

exports.rejectBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    }).populate('tourist_id', 'email');

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'pending_approval') {
      return res.status(400).json({ success: false, error: 'Booking is not pending approval' });
    }

    booking.status = 'rejected';
    booking.rejection_reason = req.body.reason;
    booking.status_history.push({
      status: 'rejected',
      changed_at: new Date(),
      changed_by: req.user._id,
    });
    await booking.save();

    res.json({ success: true, data: { booking_id: booking._id, status: 'rejected' } });

    if (booking.tourist_id?.email) {
      sendBookingRejected(booking.tourist_id.email, booking, req.body.reason).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
};

exports.completeBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      host_id: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Booking is not approved' });
    }

    booking.status = 'completed';
    booking.status_history.push({
      status: 'completed',
      changed_at: new Date(),
      changed_by: req.user._id,
    });
    await booking.save();

    res.json({ success: true, data: { booking_id: booking._id, status: 'completed' } });
  } catch (error) {
    next(error);
  }
};
