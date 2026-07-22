const Property = require('../models/Property');
const Booking = require('../models/Booking');

exports.search = async (req, res, next) => {
  try {
    const {
      check_in, check_out, num_guests, city,
      min_price, max_price, type, amenities,
      rating_min, sort_by, page = 1, limit = 10,
    } = req.query;

    const query = { tenant_id: req.tenantId, status: 'active' };

    if (city) query['location.city'] = new RegExp(city, 'i');
    if (num_guests) query.max_guests = { $gte: Number(num_guests) };
    if (min_price || max_price) {
      query.price_per_night = {};
      if (min_price) query.price_per_night.$gte = Number(min_price);
      if (max_price) query.price_per_night.$lte = Number(max_price);
    }
    if (type) query.type = type;
    if (amenities) query.amenities = { $in: amenities.split(',') };
    if (rating_min) query.rating = { $gte: Number(rating_min) };

    let sortOption = { created_at: -1 };
    if (sort_by === 'price_asc') sortOption = { price_per_night: 1 };
    if (sort_by === 'price_desc') sortOption = { price_per_night: -1 };
    if (sort_by === 'rating_desc') sortOption = { rating: -1 };
    if (sort_by === 'newest') sortOption = { created_at: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    let properties = await Property.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .populate('host_id', 'name');

    let total_count = await Property.countDocuments(query);

    if (check_in && check_out) {
      const availablePropertyIds = await getAvailablePropertyIds(
        req.tenantId, check_in, check_out, properties.map((p) => p._id)
      );
      properties = properties.filter((p) => availablePropertyIds.includes(p._id.toString()));
      total_count = properties.length;
    }

    const filters_applied = {};
    if (city) filters_applied.city = city;
    if (check_in) filters_applied.check_in = check_in;
    if (check_out) filters_applied.check_out = check_out;
    if (num_guests) filters_applied.num_guests = Number(num_guests);
    if (min_price) filters_applied.min_price = Number(min_price);
    if (max_price) filters_applied.max_price = Number(max_price);
    if (type) filters_applied.type = type;
    if (amenities) filters_applied.amenities = amenities.split(',');
    if (rating_min) filters_applied.rating_min = Number(rating_min);
    if (sort_by) filters_applied.sort_by = sort_by;

    res.json({
      success: true,
      data: {
        results: properties,
        total_count,
        page: Number(page),
        per_page: Number(limit),
        filters_applied,
      },
    });
  } catch (error) {
    next(error);
  }
};

async function getAvailablePropertyIds(tenantId, checkIn, checkOut, propertyIds) {
  const overlappingBookings = await Booking.find({
    tenant_id: tenantId,
    property_id: { $in: propertyIds },
    status: { $in: ['pending_payment', 'pending_approval', 'approved'] },
    check_in: { $lte: new Date(checkOut) },
    check_out: { $gte: new Date(checkIn) },
  }).select('property_id');

  const bookedIds = new Set(overlappingBookings.map((b) => b.property_id.toString()));
  return propertyIds.filter((id) => !bookedIds.has(id.toString()));
}
