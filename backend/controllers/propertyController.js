const Property = require('../models/Property');
const { withPropertyLock } = require('../utils/propertyLock');
const Booking = require('../models/Booking');
const { notifyAdmins } = require('../utils/pushNotifications');
const { escapeRegex, parsePagination } = require('../utils/helpers');
const { sanitizeImages } = require('../utils/images');

// Campos que un host puede enviar al crear/editar una propiedad. Todo lo demas
// (status, suspended, rating, reviews_count, approval_date, admin_notes,
// blocked_dates...) lo controla el servidor o el admin, nunca el cliente.
const HOST_EDITABLE_FIELDS = [
  'name', 'type', 'description', 'location', 'max_guests', 'bedrooms', 'bathrooms',
  'bed_types', 'price_per_night', 'currency', 'amenities', 'images', 'payment_options',
];

const pickFields = (source, keys) => Object.fromEntries(
  keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]),
);

// Cambios que el admin debe volver a revisar en una propiedad ya aprobada
// (un host podia cambiar fotos/descripcion o meter su contacto sin control).
const REVIEWABLE_FIELDS = ['name', 'type', 'description', 'location', 'images'];

// Campos internos que no se muestran a quien no es dueno ni admin.
const INTERNAL_FIELDS = ['admin_notes', 'rejection_reason', 'suspension_reason', 'changes_pending_review'];

const canSeeInternal = (req, hostId) => Boolean(req.user)
  && (req.user.role === 'admin' || String(req.user._id) === String(hostId?._id || hostId));

exports.getProperties = async (req, res, next) => {
  try {
    const {
      city, min_price, max_price, type, amenities,
      rating_min, sort,
    } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });

    const query = { tenant_id: req.tenantId, status: 'active', suspended: { $ne: true } };

    if (city) query['location.city'] = new RegExp(escapeRegex(city), 'i');
    if (min_price || max_price) {
      query.price_per_night = {};
      if (min_price) query.price_per_night.$gte = Number(min_price);
      if (max_price) query.price_per_night.$lte = Number(max_price);
    }
    if (type) query.type = String(type);
    if (amenities) query.amenities = { $in: String(amenities).split(',') };
    if (rating_min) query.rating = { $gte: Number(rating_min) };

    let sortOption = { created_at: -1 };
    if (sort === 'price_asc') sortOption = { price_per_night: 1 };
    if (sort === 'price_desc') sortOption = { price_per_night: -1 };
    if (sort === 'rating_desc') sortOption = { rating: -1 };

    const [properties, total_count] = await Promise.all([
      Property.find(query).select(INTERNAL_FIELDS.map((f) => `-${f}`).join(' '))
        .sort(sortOption).skip(skip).limit(limit).populate('host_id', 'name'),
      Property.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        properties,
        total_count,
        page,
        per_page: limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyProperties = async (req, res, next) => {
  try {
    const properties = await Property.find({
      tenant_id: req.tenantId,
      host_id: req.user._id,
    }).populate('host_id', 'name');

    res.json({
      success: true,
      data: { properties },
    });
  } catch (error) {
    next(error);
  }
};

exports.getPropertyById = async (req, res, next) => {
  try {
    const property = await Property.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    }).populate('host_id', 'name profile.avatar_url');

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const privileged = canSeeInternal(req, property.host_id);
    const isPublic = property.status === 'active' && !property.suspended;
    // Las propiedades pendientes, rechazadas o suspendidas solo las ve su host o el admin.
    if (!isPublic && !privileged) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const data = property.toObject();
    if (!privileged) INTERNAL_FIELDS.forEach((f) => delete data[f]);

    res.json({ success: true, data: { property: data } });
  } catch (error) {
    next(error);
  }
};

exports.createProperty = async (req, res, next) => {
  try {
    const fields = pickFields(req.body, HOST_EDITABLE_FIELDS);
    if (fields.images !== undefined) fields.images = sanitizeImages(fields.images, req.user._id);

    const property = await Property.create({
      ...fields,
      tenant_id: req.tenantId,
      host_id: req.user._id,
      status: 'pending_approval',
    });

    res.status(201).json({
      success: true,
      data: { property_id: property._id, status: property.status },
    });

    notifyAdmins(req.tenantId, {
      title: 'Propiedad nueva pendiente de aprobación',
      body: `"${property.name}" fue enviada para revisión.`,
      url: '/admin/properties',
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProperty = async (req, res, next) => {
  try {
    let property = await Property.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      host_id: req.user._id,
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const allowedUpdates = pickFields(req.body, HOST_EDITABLE_FIELDS);
    if (allowedUpdates.images !== undefined) {
      allowedUpdates.images = sanitizeImages(allowedUpdates.images, req.user._id, property.images);
    }

    // Si la propiedad ya estaba publicada y cambia contenido visible, sigue
    // publicada pero queda marcada para que el admin la revise.
    const current = property.toObject();
    const changedReviewable = property.status === 'active' && REVIEWABLE_FIELDS.some((field) => (
      allowedUpdates[field] !== undefined
      && JSON.stringify(allowedUpdates[field]) !== JSON.stringify(current[field])
    ));
    if (changedReviewable) allowedUpdates.changes_pending_review = true;

    property = await Property.findByIdAndUpdate(req.params.id, allowedUpdates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: { property } });

    if (changedReviewable) {
      notifyAdmins(req.tenantId, {
        title: 'Propiedad editada por revisar',
        body: `"${property.name}" cambio su contenido publicado.`,
        url: '/admin/properties',
      });
    }
  } catch (error) {
    next(error);
  }
};

// Agrega un solo rango de fechas bloqueadas (aditivo, no reemplaza el array).
// Valida contra reservas activas antes de bloquear.
exports.blockDates = async (req, res, next) => {
  try {
    const property = await Property.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      host_id: req.user._id,
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const { start_date, end_date, reason } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, error: 'start_date and end_date are required' });
    }

    // Con la propiedad bloqueada: no puede entrar una reserva entre la
    // comprobacion de conflictos y el guardado del bloqueo.
    const result = await withPropertyLock(property._id, async () => {
      const conflictingBooking = await Booking.findOne({
        property_id: property._id,
        tenant_id: req.tenantId,
        status: { $in: ['pending_payment', 'pending_approval', 'approved'] },
        check_in: { $lt: new Date(end_date) },
        check_out: { $gt: new Date(start_date) },
      });
      if (conflictingBooking) return { conflict: conflictingBooking._id };

      const updated = await Property.findByIdAndUpdate(
        property._id,
        {
          $push: {
            blocked_dates: {
              start_date,
              end_date,
              reason: reason ? String(reason).slice(0, 200) : undefined,
              blocked_by: 'host',
              blocked_by_user: req.user._id,
            },
          },
        },
        { new: true, runValidators: true },
      );
      return { block: updated.blocked_dates[updated.blocked_dates.length - 1] };
    });

    if (result.conflict) {
      return res.status(409).json({
        success: false,
        error: 'DATE_CONFLICT',
        conflicting_booking_id: result.conflict,
      });
    }

    res.status(201).json({
      success: true,
      data: { block: result.block },
    });
  } catch (error) {
    next(error);
  }
};

// Elimina un bloqueo puntual por su id de subdocumento.
exports.unblockDates = async (req, res, next) => {
  try {
    const property = await Property.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      host_id: req.user._id,
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const block = property.blocked_dates.id(req.params.blockId);
    if (!block) {
      return res.status(404).json({ success: false, error: 'Block not found' });
    }

    block.deleteOne();
    await property.save();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Devuelve blocked_dates + reservas activas en un rango, para pintar el calendario visual.
// Ruta nueva y separada de checkAvailability (que sigue igual, sin tocar).
exports.getAvailabilityCalendar = async (req, res, next) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, tenant_id: req.tenantId });
    if (property && property.status !== 'active' && !canSeeInternal(req, property.host_id)) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const { from, to } = req.query;
    const rangeStart = from ? new Date(from) : new Date();
    const rangeEnd = to ? new Date(to) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const bookings = await Booking.find({
      property_id: property._id,
      tenant_id: req.tenantId,
      status: { $in: ['pending_payment', 'pending_approval', 'approved'] },
      check_in: { $lt: rangeEnd },
      check_out: { $gt: rangeStart },
    }).select('check_in check_out status');

    res.json({
      success: true,
      data: {
        blocked_dates: property.blocked_dates,
        bookings: bookings.map((b) => ({
          check_in: b.check_in,
          check_out: b.check_out,
          status: b.status,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.checkAvailability = async (req, res, next) => {
  try {
    const { check_in, check_out } = req.query;

    const property = await Property.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const isBlocked = property.blocked_dates.some((blocked) => {
      const blockStart = new Date(blocked.start_date);
      const blockEnd = new Date(blocked.end_date);
      const requestStart = new Date(check_in);
      const requestEnd = new Date(check_out);

      return requestStart < blockEnd && requestEnd > blockStart;
    });

    if (isBlocked) {
      return res.json({
        success: true,
        data: { available: false, blocked_dates: property.blocked_dates },
      });
    }

    const existingBooking = await Booking.findOne({
      property_id: req.params.id,
      tenant_id: req.tenantId,
      status: { $in: ['pending_payment', 'pending_approval', 'approved'] },
      check_in: { $lt: new Date(check_out) },
      check_out: { $gt: new Date(check_in) },
    });

    res.json({
      success: true,
      data: {
        available: !existingBooking,
        blocked_dates: property.blocked_dates,
      },
    });
  } catch (error) {
    next(error);
  }
};
