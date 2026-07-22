const Booking = require('../models/Booking');
const Property = require('../models/Property');
const {
  sendBookingConfirmation, sendBookingApproved, sendBookingRejected, sendHostBookingNotification,
} = require('../utils/email');

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
      status: { $in: ['pending_payment', 'pending_approval', 'approved'] },
      $or: [
        { check_in: { $lte: new Date(check_out) }, check_out: { $gte: new Date(check_in) } },
      ],
    });

    if (existingBooking) {
      return res.status(400).json({ success: false, error: 'Property already booked for these dates' });
    }

    const num_nights = Math.ceil(
      (new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24)
    );
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

    // Verificación posterior a la creación: el chequeo de conflicto de arriba
    // y este create() no son atómicos -- si dos personas reservan las mismas
    // fechas casi simultáneamente, ambas pueden pasar el chequeo antes de que
    // ninguna termine de crearse. Esto detecta esa condición de carrera después
    // del hecho y cancela automáticamente la que perdió, en vez de dejar una
    // doble reserva silenciosa sin que nadie se entere.
    (async () => {
      try {
        const conflictingBooking = await Booking.findOne({
          _id: { $ne: booking._id },
          property_id,
          tenant_id: req.tenantId,
          status: { $in: ['pending_payment', 'pending_approval', 'approved'] },
          check_in: { $lte: new Date(check_out) },
          check_out: { $gte: new Date(check_in) },
          created_at: { $lte: booking.created_at },
        });

        if (conflictingBooking) {
          const fresh = await Booking.findById(booking._id);
          if (fresh && fresh.status === 'pending_payment') {
            fresh.status = 'cancelled';
            fresh.status_history.push({
              status: 'cancelled',
              changed_at: new Date(),
              changed_by: 'system',
            });
            await fresh.save();
            console.error(`[Race condition] Booking ${booking._id} cancelada automáticamente -- otra reserva (${conflictingBooking._id}) reclamó las mismas fechas primero.`);
          }
        }
      } catch (err) {
        console.error('[Race condition check] Error:', err.message);
      }
    })();
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
