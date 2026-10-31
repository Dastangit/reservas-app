const Booking = require('../models/Booking');
const Property = require('../models/Property');
const User = require('../models/User');
const { notifyAdmins } = require('../utils/pushNotifications');
const { withPropertyLock } = require('../utils/propertyLock');
const {
  sendBookingConfirmation, sendBookingApproved, sendBookingRejected, sendHostBookingNotification,
} = require('../utils/email');

// Estados que ocupan las fechas de una propiedad.
const BLOCKING_STATUSES = ['pending_payment', 'pending_approval', 'approved'];

// Cada reserva sin pagar bloquea fechas 3 h: se limita cuantas puede tener
// abiertas un turista a la vez para que no se pueda acaparar inventario.
const MAX_OPEN_UNPAID_BOOKINGS = 3;

// Cambio de estado atomico: solo aplica si la reserva sigue en uno de los
// estados esperados. Evita que, p. ej., el turista cancele mientras el admin
// aprueba y ambos "ganen". Devuelve true si se aplico.
async function transitionBooking(id, fromStatuses, set, changedBy) {
  const result = await Booking.updateOne(
    { _id: id, status: { $in: fromStatuses } },
    {
      $set: set,
      $push: { status_history: { status: set.status, changed_at: new Date(), changed_by: String(changedBy) } },
    },
  );
  return result.modifiedCount === 1;
}

// Solo se guardan los campos conocidos de tourist_data, con longitud acotada.
const pickTouristData = (data = {}) => ({
  name: String(data.name || '').trim().slice(0, 100),
  email: String(data.email || '').trim().toLowerCase().slice(0, 200),
  phone: String(data.phone || '').trim(),
  contact_method: ['whatsapp', 'email'].includes(data.contact_method) ? data.contact_method : undefined,
  language: ['es', 'en', 'fr'].includes(data.language) ? data.language : 'es',
});

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
      suspended: { $ne: true },
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const host = await User.findOne({ _id: property.host_id, status: 'active', host_status: 'approved' }).select('_id');
    if (!host) {
      return res.status(400).json({ success: false, error: 'This property is not accepting bookings right now' });
    }

    const openUnpaid = await Booking.countDocuments({
      tourist_id: req.user._id,
      status: 'pending_payment',
    });
    if (openUnpaid >= MAX_OPEN_UNPAID_BOOKINGS) {
      return res.status(429).json({
        success: false,
        error: 'You have too many unpaid bookings. Pay or cancel one before creating another.',
      });
    }

    if (Number(num_guests) > property.max_guests) {
      return res.status(400).json({ success: false, error: 'Too many guests' });
    }

    const num_nights = Math.ceil(
      (new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24)
    );
    if (!(num_nights >= 1)) {
      return res.status(400).json({ success: false, error: 'Check-out must be after check-in' });
    }

    const total_amount = num_nights * property.price_per_night;

    // Comprobar disponibilidad y crear la reserva con la propiedad bloqueada:
    // asi dos peticiones simultaneas (aunque lleguen a instancias distintas
    // del backend) no pueden reservar las mismas fechas.
    const outcome = await withPropertyLock(property._id, async () => {
      // Se releen las fechas bloqueadas: el host pudo bloquear mientras tanto.
      const fresh = await Property.findById(property._id).select('blocked_dates');
      const requestStart = new Date(check_in);
      const requestEnd = new Date(check_out);
      const isBlocked = (fresh?.blocked_dates || []).some((blocked) => (
        requestStart < new Date(blocked.end_date) && requestEnd > new Date(blocked.start_date)
      ));
      if (isBlocked) return { status: 400, error: 'Dates are not available' };

      const existingBooking = await Booking.findOne({
        property_id,
        tenant_id: req.tenantId,
        status: { $in: BLOCKING_STATUSES },
        // Desigualdad estricta: una reserva puede entrar el dia que otra sale.
        check_in: { $lt: requestEnd },
        check_out: { $gt: requestStart },
      });
      if (existingBooking) return { status: 400, error: 'Property already booked for these dates' };

      const hold_expires_at = new Date();
      hold_expires_at.setHours(hold_expires_at.getHours() + 3);

      const created = await Booking.create({
        tenant_id: req.tenantId,
        property_id,
        tourist_id: req.user._id,
        host_id: property.host_id,
        booking_type,
        check_in,
        check_out,
        num_nights,
        num_guests: Number(num_guests),
        total_amount,
        payment_option,
        tourist_data: pickTouristData(tourist_data),
        hold_expires_at,
        status: 'pending_payment',
        status_history: [{ status: 'pending_payment', changed_at: new Date(), changed_by: 'system' }],
      });
      return { booking: created };
    });

    if (outcome.error) {
      return res.status(outcome.status).json({ success: false, error: outcome.error });
    }
    const { booking } = outcome;

    // Segunda red de seguridad (por si algun dia se crea una reserva sin pasar
    // por el bloqueo): si hay otra vigente que solapa y es anterior (menor _id),
    // esta pierde. Desempatar por _id garantiza que sobrevive exactamente una.
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

    const done = await transitionBooking(booking._id, ['pending_payment', 'pending_approval'], { status: 'cancelled' }, req.user._id);
    if (!done) {
      return res.status(409).json({ success: false, error: 'Booking status changed, reload and try again' });
    }

    res.json({ success: true, data: { booking_id: booking._id, status: 'cancelled' } });

    // Si ya habia pagado el fee, el admin debe decidir sobre el reembolso.
    if (booking.fee_paid) {
      notifyAdmins(booking.tenant_id, {
        title: 'Reserva pagada cancelada por el turista',
        body: `Reserva ${String(booking._id).slice(-6)} cancelada con el fee de $${booking.fee_amount} ya pagado. Revisa si corresponde reembolso.`,
        url: '/admin/bookings',
      });
    }
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

    const set = { status: 'approved', approved_by: req.user._id, approved_at: new Date() };
    if (req.body.notes) set.admin_notes = String(req.body.notes).slice(0, 2000);
    const done = await transitionBooking(booking._id, ['pending_approval'], set, req.user._id);
    if (!done) {
      return res.status(409).json({ success: false, error: 'Booking status changed, reload and try again' });
    }

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

    const done = await transitionBooking(
      booking._id, ['pending_approval'],
      { status: 'rejected', rejection_reason: String(req.body.reason || '').slice(0, 2000) },
      req.user._id,
    );
    if (!done) {
      return res.status(409).json({ success: false, error: 'Booking status changed, reload and try again' });
    }

    res.json({ success: true, data: { booking_id: booking._id, status: 'rejected' } });

    if (booking.tourist_id?.email) {
      sendBookingRejected(booking.tourist_id.email, booking, req.body.reason).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
};

// La marca el host o el admin. Ademas, jobs/bookingLifecycle.js completa
// automaticamente las aprobadas cuyo check-out ya paso, para que la comision
// y las resenas no dependan de que alguien pulse el boton.
exports.completeBooking = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, tenant_id: req.tenantId };
    if (req.user.role !== 'admin') filter.host_id = req.user._id;

    const booking = await Booking.findOne(filter);

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Booking is not approved' });
    }

    if (new Date(booking.check_in) > new Date()) {
      return res.status(400).json({ success: false, error: 'Booking cannot be completed before check-in' });
    }

    const result = await Booking.updateOne(
      { _id: booking._id, status: 'approved' },
      {
        $set: { status: 'completed' },
        $push: { status_history: { status: 'completed', changed_at: new Date(), changed_by: String(req.user._id) } },
      },
    );
    if (result.modifiedCount !== 1) {
      return res.status(409).json({ success: false, error: 'Booking status changed, reload and try again' });
    }

    res.json({ success: true, data: { booking_id: booking._id, status: 'completed' } });
  } catch (error) {
    next(error);
  }
};
