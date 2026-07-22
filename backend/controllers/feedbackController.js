const Feedback = require('../models/Feedback');
const Booking = require('../models/Booking');

exports.submitFeedback = async (req, res, next) => {
  try {
    const { message, category, booking_id } = req.body;

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
      category: category || 'other',
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
    const { status, category, sort_by, page = 1, limit = 10 } = req.query;

    const query = { tenant_id: req.tenantId };

    if (status) query.status = status;
    if (category) query.category = category;

    let sortOption = { created_at: -1 };
    if (sort_by === 'oldest') sortOption = { created_at: 1 };

    const skip = (Number(page) - 1) * Number(limit);

    const [feedback, total_count] = await Promise.all([
      Feedback.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .populate('user_id', 'name email'),
      Feedback.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: { feedback, total_count, page: Number(page), per_page: Number(limit) },
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

    feedback.admin_response = req.body.response;
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
