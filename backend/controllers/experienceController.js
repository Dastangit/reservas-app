const Experience = require('../models/Experience');
const ExperienceBooking = require('../models/ExperienceBooking');
const ExperienceWaitlist = require('../models/ExperienceWaitlist');
const { promoteNextWaitlistEntry } = require('../utils/experienceWaitlist');

exports.getExperiences = async (req, res, next) => {
  try {
    const {
      city, category, date_from, date_to, audience, currency,
      page = 1, limit = 10,
    } = req.query;

    const query = {
      tenant_id: req.tenantId,
      status: 'active',
      date: { $gte: new Date() }, // solo excursiones futuras
    };

    if (city) query['location.city'] = new RegExp(city, 'i');
    if (category) query.category = category;
    if (date_from || date_to) {
      query.date = query.date || {};
      if (date_from) query.date.$gte = new Date(date_from);
      if (date_to) query.date.$lte = new Date(date_to);
    }
    if (audience || currency) {
      query.pricing = {
        $elemMatch: {
          ...(audience ? { audience } : {}),
          ...(currency ? { currency } : {}),
        },
      };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [experiences, total_count] = await Promise.all([
      Experience.find(query).sort({ date: 1 }).skip(skip).limit(Number(limit)).populate('organizer_id', 'name'),
      Experience.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: { experiences, total_count, page: Number(page), per_page: Number(limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.getExperienceById = async (req, res, next) => {
  try {
    const experience = await Experience.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    }).populate('organizer_id', 'name profile.avatar_url');

    if (!experience) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    res.json({
      success: true,
      data: {
        experience,
        spots_available: Math.max(experience.max_participants - experience.current_participants, 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Reserva cupos -- sin fee de plataforma (se decidió no cobrar dos veces al
// cliente). Entra directo a pending_approval. El cupo se descuenta
// atómicamente al reservar, no al aprobar, para evitar overselling; si el
// admin no aprueba en 24h, jobs/holdExpiry.js libera el cupo automáticamente.
exports.createExperienceBooking = async (req, res, next) => {
  try {
    const { payment_info: rawPaymentInfo, tourist_data } = req.body;

    const experience = await Experience.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      status: 'active',
    });

    if (!experience) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    if (!Array.isArray(rawPaymentInfo) || rawPaymentInfo.length === 0) {
      return res.status(400).json({ success: false, error: 'payment_info is required' });
    }

    if (!experience.allows_mixed_audience && rawPaymentInfo.length > 1) {
      return res.status(400).json({
        success: false,
        error: 'This experience does not allow mixing local and tourist bookings',
      });
    }

    // El monto se recalcula server-side a partir del pricing[] de la
    // excursión -- nunca se confía en el amount que manda el cliente.
    const payment_info = [];
    let num_spots = 0;

    for (const entry of rawPaymentInfo) {
      const { audience, currency, num_spots: entry_spots } = entry;

      if (!audience || !currency || !entry_spots || entry_spots < 1) {
        return res.status(400).json({ success: false, error: 'Invalid payment_info entry' });
      }

      const pricingRule = experience.pricing.find(
        (p) => p.audience === audience && p.currency === currency
      );

      if (!pricingRule) {
        return res.status(400).json({
          success: false,
          error: `No pricing available for ${audience}/${currency} on this experience`,
        });
      }

      payment_info.push({
        audience,
        currency,
        num_spots: entry_spots,
        amount: pricingRule.amount * entry_spots,
      });
      num_spots += entry_spots;
    }

    // Incremento atómico -- solo si no se excede max_participants. Evita
    // overselling en reservas simultáneas para el mismo último cupo.
    const updatedExperience = await Experience.findOneAndUpdate(
      {
        _id: experience._id,
        tenant_id: req.tenantId,
        $expr: { $lte: [{ $add: ['$current_participants', num_spots] }, '$max_participants'] },
      },
      { $inc: { current_participants: num_spots } },
      { new: true }
    );

    if (!updatedExperience) {
      return res.status(409).json({
        success: false,
        error: 'NOT_ENOUGH_SPOTS',
        message: 'No hay suficientes cupos disponibles. Podés unirte a la lista de espera.',
      });
    }

    const hold_expires_at = new Date();
    hold_expires_at.setHours(hold_expires_at.getHours() + 24);

    const booking = await ExperienceBooking.create({
      tenant_id: req.tenantId,
      experience_id: experience._id,
      tourist_id: req.user._id,
      organizer_id: experience.organizer_id,
      num_spots,
      payment_info,
      tourist_data,
      hold_expires_at,
      status: 'pending_approval',
      status_history: [{ status: 'pending_approval', changed_at: new Date(), changed_by: 'system' }],
    });

    res.status(201).json({
      success: true,
      data: {
        booking_id: booking._id,
        hold_expires_at: booking.hold_expires_at,
        num_spots: booking.num_spots,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.joinWaitlist = async (req, res, next) => {
  try {
    const { num_spots_requested = 1 } = req.body;

    const experience = await Experience.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });

    if (!experience) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    const lastEntry = await ExperienceWaitlist.findOne({
      tenant_id: req.tenantId,
      experience_id: experience._id,
    }).sort({ position: -1 });

    const position = lastEntry ? lastEntry.position + 1 : 1;

    const entry = await ExperienceWaitlist.create({
      tenant_id: req.tenantId,
      experience_id: experience._id,
      tourist_id: req.user._id,
      num_spots_requested,
      position,
    });

    res.status(201).json({ success: true, data: { waitlist_id: entry._id, position: entry.position } });
  } catch (error) {
    next(error);
  }
};

exports.getMyExperienceBookings = async (req, res, next) => {
  try {
    const bookings = await ExperienceBooking.find({
      tenant_id: req.tenantId,
      tourist_id: req.user._id,
    })
      .populate('experience_id', 'title date location images')
      .sort({ created_at: -1 });

    res.json({ success: true, data: { bookings, count: bookings.length } });
  } catch (error) {
    next(error);
  }
};

exports.getExperienceBookingById = async (req, res, next) => {
  try {
    const booking = await ExperienceBooking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    })
      .populate('experience_id', 'title date location images')
      .populate('tourist_id', 'name email')
      .populate('organizer_id', 'name email');

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const isOwner =
      booking.tourist_id._id.toString() === req.user._id.toString() ||
      booking.organizer_id._id.toString() === req.user._id.toString() ||
      req.user.role === 'admin';

    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    res.json({ success: true, data: { booking } });
  } catch (error) {
    next(error);
  }
};

// Cancela la reserva y devuelve los cupos al contador de la excursión.
// Reclama un cupo liberado por la lista de espera dentro de la ventana de
// tiempo asignada (ver promoteNextWaitlistEntry). El cupo ya fue reservado
// atomicamente al momento de promover -- aca solo se valida el reclamo y se
// crea la reserva real, sin volver a tocar current_participants.
exports.claimWaitlistSpot = async (req, res, next) => {
  try {
    const { payment_info: rawPaymentInfo, tourist_data } = req.body;

    const entry = await ExperienceWaitlist.findOne({
      _id: req.params.waitlistId,
      tenant_id: req.tenantId,
      experience_id: req.params.id,
      tourist_id: req.user._id,
      status: 'notified',
    });

    if (!entry) {
      return res.status(404).json({ success: false, error: 'Waitlist claim not found or already resolved' });
    }

    if (entry.claim_expires_at < new Date()) {
      return res.status(410).json({ success: false, error: 'Claim window expired' });
    }

    const experience = await Experience.findOne({ _id: req.params.id, tenant_id: req.tenantId });
    if (!experience) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    if (!Array.isArray(rawPaymentInfo) || rawPaymentInfo.length === 0) {
      return res.status(400).json({ success: false, error: 'payment_info is required' });
    }
    if (!experience.allows_mixed_audience && rawPaymentInfo.length > 1) {
      return res.status(400).json({
        success: false,
        error: 'This experience does not allow mixing local and tourist bookings',
      });
    }

    const payment_info = [];
    let num_spots = 0;

    for (const p of rawPaymentInfo) {
      const { audience, currency, num_spots: entry_spots } = p;

      if (!audience || !currency || !entry_spots || entry_spots < 1) {
        return res.status(400).json({ success: false, error: 'Invalid payment_info entry' });
      }

      const pricingRule = experience.pricing.find((pr) => pr.audience === audience && pr.currency === currency);
      if (!pricingRule) {
        return res.status(400).json({ success: false, error: `No pricing available for ${audience}/${currency}` });
      }

      payment_info.push({ audience, currency, num_spots: entry_spots, amount: pricingRule.amount * entry_spots });
      num_spots += entry_spots;
    }

    if (num_spots !== entry.num_spots_requested) {
      return res.status(400).json({
        success: false,
        error: `num_spots must equal ${entry.num_spots_requested}`,
      });
    }

    const hold_expires_at = new Date();
    hold_expires_at.setHours(hold_expires_at.getHours() + 24);

    const booking = await ExperienceBooking.create({
      tenant_id: req.tenantId,
      experience_id: experience._id,
      tourist_id: req.user._id,
      organizer_id: experience.organizer_id,
      num_spots,
      payment_info,
      tourist_data,
      hold_expires_at,
      status: 'pending_approval',
      status_history: [{ status: 'pending_approval', changed_at: new Date(), changed_by: 'system' }],
    });

    entry.status = 'claimed';
    await entry.save();

    res.status(201).json({
      success: true,
      data: { booking_id: booking._id, hold_expires_at: booking.hold_expires_at, num_spots: booking.num_spots },
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelExperienceBooking = async (req, res, next) => {
  try {
    const booking = await ExperienceBooking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      tourist_id: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (!['pending_approval', 'approved'].includes(booking.status)) {
      return res.status(400).json({ success: false, error: 'Cannot cancel booking in current status' });
    }

    booking.status = 'cancelled';
    booking.status_history.push({
      status: 'cancelled',
      changed_at: new Date(),
      changed_by: req.user._id,
    });
    await booking.save();

    await Experience.findOneAndUpdate(
      { _id: booking.experience_id, tenant_id: req.tenantId },
      { $inc: { current_participants: -booking.num_spots } }
    );

    await promoteNextWaitlistEntry(req.tenantId, booking.experience_id);

    res.json({ success: true, data: { booking_id: booking._id, status: 'cancelled' } });
  } catch (error) {
    next(error);
  }
};
