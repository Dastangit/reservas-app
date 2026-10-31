const Experience = require('../models/Experience');
const ExperienceRecurrence = require('../models/ExperienceRecurrence');
const ExperienceBooking = require('../models/ExperienceBooking');
const { notifyAdmins } = require('../utils/pushNotifications');
const { generateOccurrences } = require('../utils/experienceRecurrence');
const { sanitizeImages } = require('../utils/images');
const { parseLocalDateTime, EXPERIENCE_TIMEZONE } = require('../utils/timezone');
const { normalizeCountry } = require('../utils/countries');

// Lista blanca de lo que un organizador puede enviar (antes se copiaba todo el
// body menos unos pocos campos: admin_notes, rejection_reason, etc. eran editables).
const EXPERIENCE_FIELDS = [
  'title', 'description', 'category', 'location', 'timezone', 'date', 'duration_hours', 'max_participants',
  'pricing', 'allows_mixed_audience', 'images', 'includes', 'requirements', 'cancellation_policy',
];
const RECURRENCE_FIELDS = EXPERIENCE_FIELDS.filter((f) => f !== 'date').concat(['recurrence']);
const REVIEWABLE_FIELDS = ['title', 'description', 'location', 'timezone', 'images', 'pricing', 'date'];

const pickFields = (source, keys) => Object.fromEntries(
  keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]),
);

// Normaliza fechas, pais e images. `existing` es el documento que se edita (si hay):
// la fecha se interpreta en la zona nueva o, si no cambia, en la que ya tenia.
function normalizeExperienceInput(fields, userId, existing) {
  if (fields.location?.country !== undefined) fields.location.country = normalizeCountry(fields.location.country);
  const timeZone = fields.timezone || existing?.timezone || EXPERIENCE_TIMEZONE;
  if (fields.date !== undefined) fields.date = parseLocalDateTime(fields.date, timeZone);
  const existingImages = existing?.images;
  if (fields.images !== undefined) fields.images = sanitizeImages(fields.images, userId, existingImages);
  if (fields.recurrence) {
    const r = fields.recurrence;
    fields.recurrence = {
      frequency: r.frequency,
      days_of_week: Array.isArray(r.days_of_week)
        ? r.days_of_week.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [],
      time_of_day: /^\d{2}:\d{2}$/.test(String(r.time_of_day || '')) ? r.time_of_day : '09:00',
      start_date: r.start_date,
      end_date: r.end_date || undefined,
    };
  }
  return fields;
}

// ===== Excursiones de fecha única =====

exports.createExperience = async (req, res, next) => {
  try {
    const allowedFields = normalizeExperienceInput(pickFields(req.body, EXPERIENCE_FIELDS), req.user._id);
    if (!allowedFields.date || Number.isNaN(allowedFields.date.getTime()) || allowedFields.date <= new Date()) {
      return res.status(400).json({ success: false, error: 'Date must be in the future' });
    }

    const experience = await Experience.create({
      ...allowedFields,
      tenant_id: req.tenantId,
      organizer_id: req.user._id,
      status: 'pending_approval',
    });

    res.status(201).json({
      success: true,
      data: { experience_id: experience._id, status: experience.status },
    });

    notifyAdmins(req.tenantId, {
      title: 'Excursión nueva pendiente de aprobación',
      body: `"${experience.title}" fue enviada para revisión.`,
      url: '/admin/experiences',
    });
  } catch (error) {
    next(error);
  }
};

exports.updateExperience = async (req, res, next) => {
  try {
    const experience = await Experience.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      organizer_id: req.user._id,
    });

    if (!experience) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    const allowedUpdates = normalizeExperienceInput(pickFields(req.body, EXPERIENCE_FIELDS), req.user._id, experience);

    if (allowedUpdates.max_participants !== undefined
      && Number(allowedUpdates.max_participants) < experience.current_participants) {
      return res.status(400).json({ success: false, error: 'Max participants cannot be lower than spots already booked' });
    }

    // Una excursion publicada que cambia contenido vuelve a revision del admin
    // (antes se podia cambiar fecha, precio o descripcion sin control).
    const current = experience.toObject();
    const changedReviewable = experience.status === 'active' && REVIEWABLE_FIELDS.some((field) => (
      allowedUpdates[field] !== undefined
      && JSON.stringify(allowedUpdates[field]) !== JSON.stringify(current[field])
    ));
    if (changedReviewable && experience.current_participants === 0) {
      allowedUpdates.status = 'pending_approval';
    }

    const updated = await Experience.findByIdAndUpdate(req.params.id, allowedUpdates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: { experience: updated } });

    if (changedReviewable) {
      notifyAdmins(req.tenantId, {
        title: 'Excursion editada por revisar',
        body: `"${updated.title}" cambio su contenido${experience.current_participants > 0 ? ' (ya tiene reservas)' : ''}.`,
        url: '/admin/experiences',
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.getMyExperiences = async (req, res, next) => {
  try {
    // Incluye tanto excursiones de fecha única como instancias generadas
    // por una recurrencia (recurrence_id != null).
    const experiences = await Experience.find({
      tenant_id: req.tenantId,
      organizer_id: req.user._id,
    }).sort({ date: 1 });

    res.json({ success: true, data: { experiences } });
  } catch (error) {
    next(error);
  }
};

exports.getOrganizerExperienceBookings = async (req, res, next) => {
  try {
    const bookings = await ExperienceBooking.find({
      tenant_id: req.tenantId,
      organizer_id: req.user._id,
    })
      .populate('experience_id', 'title date timezone')
      .sort({ created_at: -1 });

    res.json({ success: true, data: { bookings, count: bookings.length } });
  } catch (error) {
    next(error);
  }
};

// Marca la reserva como completada -- la hace elegible para la comisión
// mensual del organizador (ver jobs/organizerCommissionCron.js).
exports.completeExperienceBooking = async (req, res, next) => {
  try {
    const booking = await ExperienceBooking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      organizer_id: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Booking is not approved' });
    }

    const result = await ExperienceBooking.updateOne(
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

// ===== Excursiones recurrentes =====

exports.getMyRecurrences = async (req, res, next) => {
  try {
    const recurrences = await ExperienceRecurrence.find({
      tenant_id: req.tenantId,
      organizer_id: req.user._id,
    }).sort({ created_at: -1 }).lean();

    // Cuantas ocurrencias lleva cada serie (son documentos Experience normales).
    const counts = await Experience.aggregate([
      { $match: {
        tenant_id: req.tenantId,
        recurrence_id: { $in: recurrences.map((r) => r._id) },
      } },
      { $group: { _id: '$recurrence_id', count: { $sum: 1 } } },
    ]);
    const countById = new Map(counts.map((c) => [String(c._id), c.count]));

    res.json({
      success: true,
      data: {
        recurrences: recurrences.map((r) => ({ ...r, occurrences_generated: countById.get(String(r._id)) || 0 })),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createRecurrence = async (req, res, next) => {
  try {
    const recurrence = await ExperienceRecurrence.create({
      ...normalizeExperienceInput(pickFields(req.body, RECURRENCE_FIELDS), req.user._id),
      tenant_id: req.tenantId,
      organizer_id: req.user._id,
      status: 'active',
    });

    // Genera el primer lote de ocurrencias ya mismo, en vez de esperar al
    // próximo corte del cron diario -- así el organizador ve resultados
    // inmediatos al crear la serie.
    const occurrences_generated = await generateOccurrences(recurrence);

    res.status(201).json({
      success: true,
      data: { recurrence_id: recurrence._id, occurrences_generated },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateRecurrence = async (req, res, next) => {
  try {
    const recurrence = await ExperienceRecurrence.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      organizer_id: req.user._id,
    });

    if (!recurrence) {
      return res.status(404).json({ success: false, error: 'Recurrence not found' });
    }

    // Solo afecta instancias futuras aún no generadas -- las ya generadas
    // (algunas con reservas activas) no se tocan retroactivamente.
    const allowedUpdates = normalizeExperienceInput(pickFields(req.body, RECURRENCE_FIELDS), req.user._id, recurrence);

    const updated = await ExperienceRecurrence.findByIdAndUpdate(req.params.id, allowedUpdates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: { recurrence: updated } });
  } catch (error) {
    next(error);
  }
};

exports.pauseRecurrence = async (req, res, next) => {
  try {
    const recurrence = await ExperienceRecurrence.findOneAndUpdate(
      { _id: req.params.id, tenant_id: req.tenantId, organizer_id: req.user._id },
      { status: 'paused' },
      { new: true }
    );

    if (!recurrence) {
      return res.status(404).json({ success: false, error: 'Recurrence not found' });
    }

    res.json({ success: true, data: { recurrence_id: recurrence._id, status: recurrence.status } });
  } catch (error) {
    next(error);
  }
};

exports.endRecurrence = async (req, res, next) => {
  try {
    const recurrence = await ExperienceRecurrence.findOneAndUpdate(
      { _id: req.params.id, tenant_id: req.tenantId, organizer_id: req.user._id },
      { status: 'ended' },
      { new: true }
    );

    if (!recurrence) {
      return res.status(404).json({ success: false, error: 'Recurrence not found' });
    }

    res.json({ success: true, data: { recurrence_id: recurrence._id, status: recurrence.status } });
  } catch (error) {
    next(error);
  }
};

exports.getRecurrenceOccurrences = async (req, res, next) => {
  try {
    const recurrence = await ExperienceRecurrence.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      organizer_id: req.user._id,
    });

    if (!recurrence) {
      return res.status(404).json({ success: false, error: 'Recurrence not found' });
    }

    const occurrences = await Experience.find({ recurrence_id: recurrence._id }).sort({ date: 1 });

    res.json({ success: true, data: { occurrences } });
  } catch (error) {
    next(error);
  }
};
