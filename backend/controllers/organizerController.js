const Experience = require('../models/Experience');
const ExperienceRecurrence = require('../models/ExperienceRecurrence');
const ExperienceBooking = require('../models/ExperienceBooking');
const { notifyAdmins } = require('../utils/pushNotifications');
const { generateOccurrences } = require('../utils/experienceRecurrence');

// ===== Excursiones de fecha única =====

exports.createExperience = async (req, res, next) => {
  try {
    const allowedFields = { ...req.body };
    delete allowedFields.status;
    delete allowedFields.organizer_id;
    delete allowedFields.tenant_id;
    delete allowedFields.current_participants;
    delete allowedFields.recurrence_id;

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

    const allowedUpdates = { ...req.body };
    delete allowedUpdates.status;
    delete allowedUpdates.organizer_id;
    delete allowedUpdates.tenant_id;
    delete allowedUpdates.current_participants;
    delete allowedUpdates.recurrence_id;

    const updated = await Experience.findByIdAndUpdate(req.params.id, allowedUpdates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: { experience: updated } });
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
      .populate('experience_id', 'title date')
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

// ===== Excursiones recurrentes =====

exports.createRecurrence = async (req, res, next) => {
  try {
    const recurrence = await ExperienceRecurrence.create({
      ...req.body,
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
    const allowedUpdates = { ...req.body };
    delete allowedUpdates.status;
    delete allowedUpdates.organizer_id;
    delete allowedUpdates.tenant_id;

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
