const Experience = require('../models/Experience');
const ExperienceBooking = require('../models/ExperienceBooking');
const ExperienceWaitlist = require('../models/ExperienceWaitlist');
const { promoteNextWaitlistEntry } = require('../utils/experienceWaitlist');
const { escapeRegex, parsePagination } = require('../utils/helpers');
const { normalizeCountry } = require('../utils/countries');

// Una reserva de excursion no cuesta nada y retiene cupos 24 h: se limita cuantas
// pendientes puede tener un turista y cuantos cupos pide de una vez.
const MAX_PENDING_EXPERIENCE_BOOKINGS = 3;
const MAX_SPOTS_PER_BOOKING = 20;

const INTERNAL_FIELDS = ['admin_notes', 'rejection_reason'];

const toSpots = (value) => {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
};

const pickTouristData = (data = {}) => ({
  name: String(data.name || '').trim().slice(0, 100),
  email: String(data.email || '').trim().toLowerCase().slice(0, 200),
  phone: String(data.phone || '').trim(),
  contact_method: ['whatsapp', 'email'].includes(data.contact_method) ? data.contact_method : undefined,
  language: ['es', 'en', 'fr'].includes(data.language) ? data.language : 'es',
});

// Calcula payment_info a partir del pricing de la excursion (nunca del
// monto que manda el cliente). Devuelve { error } o { payment_info, num_spots }.
function buildPaymentInfo(experience, rawPaymentInfo) {
  if (!Array.isArray(rawPaymentInfo) || rawPaymentInfo.length === 0) {
    return { error: 'payment_info is required' };
  }
  if (!experience.allows_mixed_audience && rawPaymentInfo.length > 1) {
    return { error: 'This experience does not allow mixing local and tourist bookings' };
  }

  const payment_info = [];
  let num_spots = 0;
  for (const entry of rawPaymentInfo) {
    const audience = entry?.audience;
    const currency = entry?.currency;
    const spots = toSpots(entry?.num_spots);
    if (!audience || !currency || !(spots >= 1)) {
      return { error: 'Invalid payment_info entry' };
    }
    const pricingRule = experience.pricing.find((p) => p.audience === audience && p.currency === currency);
    if (!pricingRule) {
      return { error: `No pricing available for ${audience}/${currency} on this experience` };
    }
    payment_info.push({ audience, currency, num_spots: spots, amount: pricingRule.amount * spots });
    num_spots += spots;
  }

  if (num_spots > MAX_SPOTS_PER_BOOKING) {
    return { error: `Maximum ${MAX_SPOTS_PER_BOOKING} spots per booking` };
  }
  return { payment_info, num_spots };
}

exports.getExperiences = async (req, res, next) => {
  try {
    const {
      city, country, category, date_from, date_to, audience, currency,
    } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });

    const query = {
      tenant_id: req.tenantId,
      status: 'active',
      date: { $gte: new Date() }, // solo excursiones futuras
    };

    if (city) query['location.city'] = new RegExp(escapeRegex(city), 'i');
    if (normalizeCountry(country)) query['location.country'] = normalizeCountry(country);
    if (category) query.category = String(category);
    if (date_from || date_to) {
      query.date = query.date || {};
      // Nunca se listan excursiones pasadas, aunque date_from sea anterior.
      if (date_from) query.date.$gte = new Date(Math.max(new Date(date_from).getTime() || 0, Date.now()));
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

    const [experiences, total_count] = await Promise.all([
      Experience.find(query).select(INTERNAL_FIELDS.map((f) => `-${f}`).join(' '))
        .sort({ date: 1 }).skip(skip).limit(limit).populate('organizer_id', 'name'),
      Experience.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: { experiences, total_count, page, per_page: limit },
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

    const privileged = Boolean(req.user) && (req.user.role === 'admin'
      || String(req.user._id) === String(experience.organizer_id?._id || experience.organizer_id));
    // Pendientes/rechazadas/canceladas solo las ve su organizador o el admin.
    if (!['active', 'full', 'completed'].includes(experience.status) && !privileged) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    const data = experience.toObject();
    if (!privileged) INTERNAL_FIELDS.forEach((f) => delete data[f]);

    res.json({
      success: true,
      data: {
        experience: data,
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
      date: { $gt: new Date() },
    });

    if (!experience) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    const built = buildPaymentInfo(experience, rawPaymentInfo);
    if (built.error) {
      return res.status(400).json({ success: false, error: built.error });
    }
    const { payment_info, num_spots } = built;

    const pendingCount = await ExperienceBooking.countDocuments({
      tourist_id: req.user._id,
      status: 'pending_approval',
    });
    if (pendingCount >= MAX_PENDING_EXPERIENCE_BOOKINGS) {
      return res.status(429).json({
        success: false,
        error: 'You have too many bookings waiting for approval. Wait for them or cancel one first.',
      });
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
      tourist_data: pickTouristData(tourist_data),
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
    const numSpots = toSpots(req.body.num_spots_requested ?? 1);

    const experience = await Experience.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      status: { $in: ['active', 'full'] },
      date: { $gt: new Date() },
    });

    if (!experience) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    // Antes se aceptaba cualquier numero (incluso negativo, que al promoverse
    // bajaba current_participants y permitia sobrevender).
    if (!(numSpots >= 1) || numSpots > Math.min(experience.max_participants, MAX_SPOTS_PER_BOOKING)) {
      return res.status(400).json({ success: false, error: 'Invalid number of spots' });
    }

    if (experience.current_participants + numSpots <= experience.max_participants) {
      return res.status(400).json({ success: false, error: 'There are spots available, book directly instead' });
    }

    const alreadyWaiting = await ExperienceWaitlist.exists({
      experience_id: experience._id,
      tourist_id: req.user._id,
      status: { $in: ['waiting', 'notified'] },
    });
    if (alreadyWaiting) {
      return res.status(400).json({ success: false, error: 'You are already on the waitlist for this experience' });
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
      num_spots_requested: numSpots,
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
      .populate('experience_id', 'title date timezone location images')
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
      .populate('experience_id', 'title date timezone location images')
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

    const built = buildPaymentInfo(experience, rawPaymentInfo);
    if (built.error) {
      return res.status(400).json({ success: false, error: built.error });
    }
    const { payment_info, num_spots } = built;

    if (num_spots !== entry.num_spots_requested) {
      return res.status(400).json({
        success: false,
        error: `num_spots must equal ${entry.num_spots_requested}`,
      });
    }

    // Se marca reclamado de forma atomica antes de crear la reserva: si el
    // cron lo vencio en paralelo, no se crea una reserva sobre un cupo liberado.
    const claimed = await ExperienceWaitlist.updateOne(
      { _id: entry._id, status: 'notified' },
      { $set: { status: 'claimed' } },
    );
    if (claimed.modifiedCount !== 1) {
      return res.status(410).json({ success: false, error: 'Claim window expired' });
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
      tourist_data: pickTouristData(tourist_data),
      hold_expires_at,
      status: 'pending_approval',
      status_history: [{ status: 'pending_approval', changed_at: new Date(), changed_by: 'system' }],
    });

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

    // Atomico: dos cancelaciones simultaneas liberaban los cupos dos veces.
    const result = await ExperienceBooking.updateOne(
      { _id: booking._id, status: { $in: ['pending_approval', 'approved'] } },
      {
        $set: { status: 'cancelled' },
        $push: { status_history: { status: 'cancelled', changed_at: new Date(), changed_by: String(req.user._id) } },
      },
    );
    if (result.modifiedCount !== 1) {
      return res.status(409).json({ success: false, error: 'Booking status changed, reload and try again' });
    }

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
