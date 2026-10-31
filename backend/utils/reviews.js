const mongoose = require('mongoose');
const Review = require('../models/Review');
const Property = require('../models/Property');

// Recalcula rating y reviews_count de una propiedad a partir de las resenas visibles.
async function recomputePropertyRating(propertyId) {
  const [stats] = await Review.aggregate([
    { $match: { property_id: new mongoose.Types.ObjectId(String(propertyId)), status: 'visible', reviewer_role: 'tourist' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Property.updateOne(
    { _id: propertyId },
    { rating: stats ? Math.round(stats.avg * 10) / 10 : 0, reviews_count: stats ? stats.count : 0 },
  );
}

module.exports = { recomputePropertyRating };
