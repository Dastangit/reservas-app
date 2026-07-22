const Property = require('../models/Property');
const Booking = require('../models/Booking');

exports.getProperties = async (req, res, next) => {
  try {
    const {
      city, min_price, max_price, type, amenities,
      rating_min, sort, page = 1, limit = 10,
    } = req.query;

    const query = { tenant_id: req.tenantId, status: 'active', suspended: { $ne: true } };

    if (city) query['location.city'] = new RegExp(city, 'i');
    if (min_price || max_price) {
      query.price_per_night = {};
      if (min_price) query.price_per_night.$gte = Number(min_price);
      if (max_price) query.price_per_night.$lte = Number(max_price);
    }
    if (type) query.type = type;
    if (amenities) query.amenities = { $in: amenities.split(',') };
    if (rating_min) query.rating = { $gte: Number(rating_min) };

    let sortOption = { created_at: -1 };
    if (sort === 'price_asc') sortOption = { price_per_night: 1 };
    if (sort === 'price_desc') sortOption = { price_per_night: -1 };
    if (sort === 'rating_desc') sortOption = { rating: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    const [properties, total_count] = await Promise.all([
      Property.find(query).sort(sortOption).skip(skip).limit(Number(limit)).populate('host_id', 'name'),
      Property.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        properties,
        total_count,
        page: Number(page),
        per_page: Number(limit),
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

    res.json({ success: true, data: { property } });
  } catch (error) {
    next(error);
  }
};

exports.createProperty = async (req, res, next) => {
  try {
    req.body.tenant_id = req.tenantId;
    req.body.host_id = req.user._id;

    const property = await Property.create(req.body);

    res.status(201).json({
      success: true,
      data: { property_id: property._id, status: property.status },
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

    const allowedUpdates = { ...req.body };
    delete allowedUpdates.status;
    delete allowedUpdates.host_id;
    delete allowedUpdates.tenant_id;

    property = await Property.findByIdAndUpdate(req.params.id, allowedUpdates, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: { property } });
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

    const conflictingBooking = await Booking.findOne({
      property_id: property._id,
      tenant_id: req.tenantId,
      status: { $in: ['pending_payment', 'pending_approval', 'approved'] },
      check_in: { $lt: new Date(end_date) },
      check_out: { $gt: new Date(start_date) },
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        error: 'DATE_CONFLICT',
        conflicting_booking_id: conflictingBooking._id,
      });
    }

    property.blocked_dates.push({
      start_date,
      end_date,
      reason,
      blocked_by: 'host',
      blocked_by_user: req.user._id,
    });
    await property.save();

    res.status(201).json({
      success: true,
      data: { block: property.blocked_dates[property.blocked_dates.length - 1] },
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
      check_in: { $lte: new Date(check_out) },
      check_out: { $gte: new Date(check_in) },
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
