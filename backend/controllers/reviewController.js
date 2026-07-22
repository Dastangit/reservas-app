const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Property = require('../models/Property');

exports.submitReview = async (req, res, next) => {
  try {
    const { booking_id, rating, text } = req.body;

    const booking = await Booking.findOne({
      _id: booking_id,
      tenant_id: req.tenantId,
      status: 'completed',
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Completed booking not found' });
    }

    const isTourist = booking.tourist_id.toString() === req.user._id.toString();
    const isHost = booking.host_id.toString() === req.user._id.toString();

    if (!isTourist && !isHost) {
      return res.status(403).json({ success: false, error: 'Not authorized to review this booking' });
    }

    const reviewer_role = isTourist ? 'tourist' : 'host';

    const existingReview = await Review.findOne({
      booking_id,
      reviewer_id: req.user._id,
    });

    if (existingReview) {
      return res.status(400).json({ success: false, error: 'You have already reviewed this booking' });
    }

    const pairReview = await Review.findOne({
      booking_id,
      reviewer_role: reviewer_role === 'tourist' ? 'host' : 'tourist',
    });

    const review = await Review.create({
      tenant_id: req.tenantId,
      booking_id,
      property_id: booking.property_id,
      reviewer_id: req.user._id,
      reviewer_role,
      rating,
      text,
      pair_review_id: pairReview?._id,
      both_submitted: !!pairReview,
    });

    if (pairReview) {
      pairReview.pair_review_id = review._id;
      pairReview.both_submitted = true;
      pairReview.status = 'visible';
      pairReview.revealed_at = new Date();
      await pairReview.save();

      review.status = 'visible';
      review.revealed_at = new Date();
      await review.save();

      const allReviews = await Review.find({
        property_id: booking.property_id,
        status: 'visible',
      });

      const avgRating = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;

      await Property.findByIdAndUpdate(booking.property_id, {
        rating: Math.round(avgRating * 10) / 10,
        reviews_count: allReviews.length,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        review_id: review._id,
        status: review.status,
        revealed: review.status === 'visible',
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getPropertyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({
      property_id: req.params.id,
      status: 'visible',
      tenant_id: req.tenantId,
    }).populate('reviewer_id', 'name profile.avatar_url');

    const total_count = reviews.length;
    const average_rating = total_count > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / total_count
      : 0;

    res.json({
      success: true,
      data: {
        reviews,
        average_rating: Math.round(average_rating * 10) / 10,
        total_count,
      },
    });
  } catch (error) {
    next(error);
  }
};
