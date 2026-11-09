const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const Booking = require('../models/Booking');
const { parsePagination } = require('../utils/helpers');
const { notifyAdmins } = require('../utils/pushNotifications');

const CATEGORIES = ['ux', 'payment', 'communication', 'features', 'other', 'complaint'];
// Un reclamo puede ser sobre cualquier reserva ya pagada, este en curso o no.
const COMPLAINT_STATUSES = ['pending_approval', 'approved', 'completed', 'cancelled', 'rejected'];

exports.submitFeedback = async (req, res, next) => {
  try {
    const { booking_id } = req.body;
    const category = CATEGORIES.includes(req.body.category) ? req.body.category : 'other';
    const isComplaint = category === 'complaint';
    const message = String(req.body.message || '').trim().slice(0, 5000);

    if (isComplaint && !booking_id) {
      return res.status(400).json({ success: false, error: 'A complaint must be about one of your bookings' });
    }

    let booking = null;
    if (booking_id) {
      if (!mongoose.isValidObjectId(booking_id)) {
        return res.status(400).json({ success: false, error: 'Invalid booking' });
      }
      booking = await Booking.findOne({
        _id: booking_id,
        tenant_id: req.tenantId,
        tourist_id: req.user._id,
        status: isComplaint ? { $in: COMPLAINT_STATUSES } : 'completed',
      }).populate('property_id', 'name');

      if (!booking) {
        return res.status(404).json({
          success: false,
          error: isComplaint ? 'Booking not found' : 'Completed booking not found',
        });
      }
    }

    const feedback = await Feedback.create({
      tenant_id: req.tenantId,
      user_id: req.user._id,
      booking_id: booking?._id,
      message,
      category,
    });

    res.status(201).json({
      success: true,
      data: { feedback_id: feedback._id, status: feedback.status },
    });

    if (isComplaint) {
      notifyAdmins(req.tenantId, {
        title: 'Reclamo nuevo de un turista',
        body: `Sobre la reserva …${String(booking._id).slice(-6)} en "${booking.property_id?.name || 'alojamiento'}". Compáralo con lo que se ofrecía al reservar.`,
        url: '/admin/feedback',
      });
    }
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
        .populate('user_id', 'name email')
        // Para los reclamos: la reserva con lo que se ofrecia al reservar.
        .populate({
          path: 'booking_id',
          select: 'check_in check_out status property_id offer_snapshot offer_accepted_at offer_changed_at offer_changes',
          populate: { path: 'property_id', select: 'name' },
        }),
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
