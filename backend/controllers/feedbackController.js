const Feedback = require('../models/Feedback');
const Booking = require('../models/Booking');
const { parsePagination } = require('../utils/helpers');

exports.submitFeedback = async (req, res, next) => {
  try {
    const { category, booking_id } = req.body;
    const message = String(req.body.message || '').trim().slice(0, 5000);

    if (booking_id) {
      const booking = await Booking.findOne({
        _id: booking_id,
        tenant_id: req.tenantId,
        tourist_id: req.user._id,
        status: 'completed',
      });

      if (!booking) {
        return res.status(404).json({ success: false, error: 'Completed booking not found' });
      }
    }

    const feedback = await Feedback.create({
      tenant_id: req.tenantId,
      user_id: req.user._id,
      booking_id,
      message,
      category: ['ux', 'payment', 'communication', 'features', 'other'].includes(category) ? category : 'other',
    });

    res.status(201).json({
      success: true,
      data: { feedback_id: feedback._id, status: feedback.status },
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllFeedback = async (req, res, next) => {
  try {
    const { status, category, sort_by } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10 });

    const query = { tenant_id: req.tenantId };

    if (status) query.status = String(status);
    if (category) query.category = String(category);

    let sortOption = { created_at: -1 };
    if (sort_by === 'oldest') sortOption = { created_at: 1 };

    const [feedback, total_count] = await Promise.all([
      Feedback.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate('user_id', 'name email'),
      Feedback.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: { feedback, total_count, page, per_page: limit },
    });
  } catch (error) {
    next(error);
  }
};

exports.respondToFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    });

    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }

    feedback.admin_response = String(req.body.response || '').slice(0, 5000);
    feedback.admin_response_by = req.user._id;
    feedback.admin_response_at = new Date();
    feedback.status = 'responded';
    await feedback.save();

    res.json({
      success: true,
      data: {
        feedback_id: feedback._id,
        admin_response_at: feedback.admin_response_at,
      },
    });
  } catch (error) {
    next(error);
  }
};
