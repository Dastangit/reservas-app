const Property = require('../models/Property');
const Booking = require('../models/Booking');
const Experience = require('../models/Experience');
const { escapeRegex, parsePagination } = require('../utils/helpers');

exports.search = async (req, res, next) => {
  try {
    const {
      check_in, check_out, num_guests, city,
      min_price, max_price, type, amenities,
      rating_min, sort_by,
    } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });

    const query = { tenant_id: req.tenantId, status: 'active', suspended: { $ne: true } };

    if (city) query['location.city'] = new RegExp(escapeRegex(city), 'i');
    if (num_guests) query.max_guests = { $gte: Number(num_guests) };
    if (min_price || max_price) {
      query.price_per_night = {};
      if (min_price) query.price_per_night.$gte = Number(min_price);
      if (max_price) query.price_per_night.$lte = Number(max_price);
    }
    if (type) query.type = String(type);
    if (amenities) query.amenities = { $in: String(amenities).split(',') };
    if (rating_min) query.rating = { $gte: Number(rating_min) };

    // La disponibilidad se filtra EN la consulta (no despues de paginar), asi
    // el total y las paginas son correctos. Cuenta reservas vigentes y tambien
    // las fechas bloqueadas a mano por el host.
    const checkIn = check_in ? new Date(check_in) : null;
    const checkOut = check_out ? new Date(check_out) : null;
    if (checkIn && checkOut && !Number.isNaN(checkIn.getTime()) && !Number.isNaN(checkOut.getTime())) {
      const bookedIds = await Booking.distinct('property_id', {
        tenant_id: req.tenantId,
        status: { $in: ['pending_payment', 'pending_approval', 'approved'] },
        check_in: { $lt: checkOut },
        check_out: { $gt: checkIn },
      });
      query._id = { $nin: bookedIds };
      query.blocked_dates = {
        $not: { $elemMatch: { start_date: { $lt: checkOut }, end_date: { $gt: checkIn } } },
      };
    }

    let sortOption = { created_at: -1 };
    if (sort_by === 'price_asc') sortOption = { price_per_night: 1 };
    if (sort_by === 'price_desc') sortOption = { price_per_night: -1 };
    if (sort_by === 'rating_desc') sortOption = { rating: -1 };
    if (sort_by === 'newest') sortOption = { created_at: -1 };

    const [properties, total_count] = await Promise.all([
      Property.find(query)
        .select('-admin_notes -rejection_reason -suspension_reason -changes_pending_review')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate('host_id', 'name'),
      Property.countDocuments(query),
    ]);

    const filters_applied = {};
    if (city) filters_applied.city = city;
    if (check_in) filters_applied.check_in = check_in;
    if (check_out) filters_applied.check_out = check_out;
    if (num_guests) filters_applied.num_guests = Number(num_guests);
    if (min_price) filters_applied.min_price = Number(min_price);
    if (max_price) filters_applied.max_price = Number(max_price);
    if (type) filters_applied.type = type;
    if (amenities) filters_applied.amenities = String(amenities).split(',');
    if (rating_min) filters_applied.rating_min = Number(rating_min);
    if (sort_by) filters_applied.sort_by = sort_by;

    res.json({
      success: true,
      data: {
        results: properties,
        total_count,
        page,
        per_page: limit,
        filters_applied,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Destinos para el carrusel de la home: ciudades donde ya hay al menos una
// propiedad o excursion activa, con una foto real de esa ciudad. Nunca
// muestra lugares a los que la plataforma no pueda llevar al cliente.
exports.getDestinations = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const tenantMatch = { tenant_id: req.tenantId };

    const pickImage = {
      $let: {
        vars: {
          primary: {
            $arrayElemAt: [
              { $filter: { input: '$images', cond: { $eq: ['$$this.is_primary', true] } } },
              0,
            ],
          },
          first: { $arrayElemAt: ['$images', 0] },
        },
        in: { $ifNull: ['$$primary', '$$first'] },
      },
    };

    const byCity = (Model, matchExtra) => Model.aggregate([
      {
        $match: {
          ...tenantMatch,
          ...matchExtra,
          images: { $exists: true, $ne: [] },
          'location.city': { $exists: true, $ne: '' },
        },
      },
      { $sort: { created_at: -1 } },
      { $group: { _id: '$location.city', image: { $first: pickImage } } },
      { $project: { _id: 0, city: '$_id', image_url: '$image.url' } },
    ]);

    const [fromProperties, fromExperiences] = await Promise.all([
      byCity(Property, { status: 'active', suspended: { $ne: true } }),
      byCity(Experience, { status: 'active', date: { $gte: new Date() } }),
    ]);

    const seen = new Map();
    [...fromProperties, ...fromExperiences].forEach((d) => {
      if (d.city && d.image_url && !seen.has(d.city)) {
        seen.set(d.city, { city: d.city, image_url: d.image_url });
      }
    });

    const destinations = Array.from(seen.values())
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);

    res.json({ success: true, data: { destinations } });
  } catch (error) {
    next(error);
  }
};
