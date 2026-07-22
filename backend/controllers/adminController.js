const Booking = require('../models/Booking');
const Property = require('../models/Property');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const Payment = require('../models/Payment');
const OrphanedPayment = require('../models/OrphanedPayment');
const HostMonthlyCommission = require('../models/HostMonthlyCommission');
const { sendEmail } = require('../utils/email');
const { buildWhatsAppLink } = require('../utils/whatsapp');
const { buildMailtoLink } = require('../utils/mailto');
const { buildTouristMessage } = require('../utils/touristMessages');
const { logAdminAction } = require('../utils/auditLog');

exports.getDashboard = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const [
      bookings_today,
      pending_approvals_bookings,
      pending_approvals_properties,
      new_feedback,
      total_revenue,
      total_properties,
      total_users,
    ] = await Promise.all([
      Booking.countDocuments({
        tenant_id: tenantId,
        created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
      Booking.countDocuments({ tenant_id: tenantId, status: 'pending_approval' }),
      Property.countDocuments({ tenant_id: tenantId, status: 'pending_approval' }),
      Feedback.countDocuments({ tenant_id: tenantId, status: 'new' }),
      Booking.aggregate([
        { $match: { tenant_id: tenantId, status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$fee_amount' } } },
      ]),
      Property.countDocuments({ tenant_id: tenantId }),
      User.countDocuments({ tenant_id: tenantId }),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          bookings_today,
          pending_approvals_bookings,
          pending_approvals_properties,
          new_feedback,
          total_revenue: total_revenue[0]?.total || 0,
          total_properties,
          total_users,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getPendingProperties = async (req, res, next) => {
  try {
    const properties = await Property.find({
      tenant_id: req.tenantId,
      status: 'pending_approval',
    }).populate('host_id', 'name email');

    res.json({ success: true, data: { properties } });
  } catch (error) {
    next(error);
  }
};

exports.approveProperty = async (req, res, next) => {
  try {
    const property = await Property.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    }).populate('host_id', 'name email');

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    property.status = 'active';
    property.approval_date = new Date();
    await property.save();

    res.json({ success: true, data: { property_id: property._id, status: 'active', email_sent: true } });

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'approve_property',
      target_type: 'Property',
      target_id: property._id,
    });

    if (property.host_id?.email) {
      sendEmail({
        to: property.host_id.email,
        subject: 'Property Approved - Da-El World Travelers',
        html: `
          <h1>Property Approved!</h1>
          <p>Your property <strong>${property.name}</strong> has been approved and is now active on the platform.</p>
          <p>Tourists can now find and book your property.</p>
        `,
      }).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
};

exports.rejectProperty = async (req, res, next) => {
  try {
    const property = await Property.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    }).populate('host_id', 'name email');

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    property.status = 'rejected';
    property.rejection_reason = req.body.reason;
    await property.save();

    res.json({ success: true, data: { property_id: property._id, status: 'rejected' } });

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'reject_property',
      target_type: 'Property',
      target_id: property._id,
      metadata: { reason: req.body.reason },
    });

    if (property.host_id?.email) {
      sendEmail({
        to: property.host_id.email,
        subject: 'Property Rejected - Da-El World Travelers',
        html: `
          <h1>Property Not Approved</h1>
          <p>Your property <strong>${property.name}</strong> was not approved.</p>
          ${req.body.reason ? `<p><strong>Reason:</strong> ${req.body.reason}</p>` : ''}
          <p>Please review the requirements and try again.</p>
        `,
      }).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
};

exports.getAllBookings = async (req, res, next) => {
  try {
    const { status, property_id, sort_by, page = 1, limit = 10 } = req.query;

    const query = { tenant_id: req.tenantId };

    if (status) query.status = status;
    if (property_id) query.property_id = property_id;

    let sortOption = { created_at: -1 };
    if (sort_by === 'oldest') sortOption = { created_at: 1 };

    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total_count] = await Promise.all([
      Booking.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .populate('property_id', 'name')
        .populate('tourist_id', 'name email')
        .populate('host_id', 'name'),
      Booking.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: { bookings, total_count, page: Number(page), per_page: Number(limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.getHostPayouts = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const matchStage = {
      tenant_id: req.tenantId,
      booking_type: 'full_online',
      status: { $in: ['approved', 'completed'] },
    };

    if (year && month) {
      const rangeStart = new Date(Number(year), Number(month) - 1, 1);
      const rangeEnd = new Date(Number(year), Number(month), 1);
      matchStage.check_out = { $gte: rangeStart, $lt: rangeEnd };
    }

    const payouts = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$host_id',
          total_bookings: { $sum: 1 },
          total_amount: { $sum: '$total_amount' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'host',
        },
      },
      { $unwind: { path: '$host', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          host_id: '$_id',
          host_name: { $ifNull: ['$host.name', 'Unknown'] },
          host_email: { $ifNull: ['$host.email', ''] },
          total_bookings: 1,
          total_amount: 1,
          commission: { $multiply: ['$total_amount', 0.10] },
          net_payable: { $multiply: ['$total_amount', 0.90] },
        },
      },
      { $sort: { host_name: 1 } },
    ]);

    res.json({ success: true, data: { payouts } });
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const Tenant = require('../models/Tenant');

    const tenant = await Tenant.findById(req.tenantId);

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    const s = tenant.settings;

    if (req.body.logo_url !== undefined) s.branding.logo_url = req.body.logo_url;
    if (req.body.primary_color !== undefined) s.branding.primary_color = req.body.primary_color;
    if (req.body.secondary_color !== undefined) s.branding.secondary_color = req.body.secondary_color;
    if (req.body.favicon_url !== undefined) s.branding.favicon_url = req.body.favicon_url;
    if (req.body.languages !== undefined) s.languages = req.body.languages;
    if (req.body.default_language !== undefined) s.default_language = req.body.default_language;
    if (req.body.currency !== undefined) s.currency = req.body.currency;
    if (req.body.timezone !== undefined) s.timezone = req.body.timezone;
    if (req.body.gateway !== undefined) s.payment.gateway = req.body.gateway;
    if (req.body.nowpayments_api_key !== undefined) s.payment.nowpayments_api_key = req.body.nowpayments_api_key;
    if (req.body.nowpayments_ipn_key !== undefined) s.payment.nowpayments_ipn_key = req.body.nowpayments_ipn_key;
    if (req.body.fee_amount !== undefined) s.payment.fee_amount = req.body.fee_amount;
    if (req.body.fee_currency !== undefined) s.payment.fee_currency = req.body.fee_currency;

    await tenant.save();

    res.json({ success: true, data: { tenant_id: tenant._id, settings: tenant.settings } });
  } catch (error) {
    next(error);
  }
};

exports.getHosts = async (req, res, next) => {
  try {
    const { host_status, page = 1, limit = 20 } = req.query;
    const filter = { tenant_id: req.tenantId, role: 'host' };
    if (host_status) filter.host_status = host_status;

    const total = await User.countDocuments(filter);
    const hosts = await User.find(filter)
      .select('-password_hash')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ created_at: -1 });

    res.json({
      success: true,
      data: { hosts, total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.approveHost = async (req, res, next) => {
  try {
    const host = await User.findOne({ _id: req.params.id, tenant_id: req.tenantId, role: 'host' });
    if (!host) {
      return res.status(404).json({ success: false, error: 'Host not found' });
    }

    host.host_status = 'approved';
    host.host_approved_by = req.user._id;
    await host.save();

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'approve_host',
      target_type: 'User',
      target_id: host._id,
    });

    res.json({ success: true, data: { host_id: host._id, host_status: 'approved' } });
  } catch (error) {
    next(error);
  }
};

exports.rejectHost = async (req, res, next) => {
  try {
    const host = await User.findOne({ _id: req.params.id, tenant_id: req.tenantId, role: 'host' });
    if (!host) {
      return res.status(404).json({ success: false, error: 'Host not found' });
    }

    host.host_status = 'rejected';
    host.host_status_reason = req.body.reason;
    await host.save();

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'reject_host',
      target_type: 'User',
      target_id: host._id,
      metadata: { reason: req.body.reason },
    });

    res.json({ success: true, data: { host_id: host._id, host_status: 'rejected' } });
  } catch (error) {
    next(error);
  }
};

exports.suspendHost = async (req, res, next) => {
  try {
    const host = await User.findOne({ _id: req.params.id, tenant_id: req.tenantId, role: 'host' });
    if (!host) {
      return res.status(404).json({ success: false, error: 'Host not found' });
    }

    host.status = 'suspended';
    await host.save();

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'suspend_host',
      target_type: 'User',
      target_id: host._id,
    });

    res.json({ success: true, data: { host_id: host._id, status: 'suspended' } });
  } catch (error) {
    next(error);
  }
};

exports.deleteHost = async (req, res, next) => {
  try {
    const host = await User.findOne({ _id: req.params.id, tenant_id: req.tenantId, role: 'host' });
    if (!host) {
      return res.status(404).json({ success: false, error: 'Host not found' });
    }

    const activeBookings = await Booking.countDocuments({
      host_id: host._id,
      tenant_id: req.tenantId,
      status: { $in: ['pending_payment', 'pending_approval', 'approved'] },
    });

    if (activeBookings > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete host with active bookings. Cancel or complete their bookings first.' });
    }

    await Property.deleteMany({ host_id: host._id, tenant_id: req.tenantId });
    await User.findByIdAndDelete(host._id);

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'delete_host',
      target_type: 'User',
      target_id: host._id,
      metadata: { host_email: host.email, host_name: host.name },
    });

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

exports.getAllProperties = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { tenant_id: req.tenantId };
    if (status) filter.status = status;

    const total = await Property.countDocuments(filter);
    const properties = await Property.find(filter)
      .populate('host_id', 'name email')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ created_at: -1 });

    res.json({ success: true, data: { properties, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

exports.adminEditProperty = async (req, res, next) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, tenant_id: req.tenantId });
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const updated = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: { property: updated } });
  } catch (error) {
    next(error);
  }
};

exports.adminDeleteProperty = async (req, res, next) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, tenant_id: req.tenantId });
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    await Property.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// Bloqueo de fechas en nombre del host (mismo mecanismo que blockDates del host,
// pero sin restringir por host_id y marcando blocked_by:'admin').
exports.adminBlockDates = async (req, res, next) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, tenant_id: req.tenantId });
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
      blocked_by: 'admin',
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

exports.adminUnblockDates = async (req, res, next) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, tenant_id: req.tenantId });
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

exports.adminGetAvailabilityCalendar = async (req, res, next) => {
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

// Genera el link wa.me pre-llenado para avisarle al host de una reserva aprobada.
// El admin lo abre manualmente con un clic -- sin costo de API.
exports.getBookingWhatsAppLink = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, tenant_id: req.tenantId })
      .populate('property_id', 'name')
      .populate('host_id', 'name phone');

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (!booking.host_id?.phone) {
      return res.status(400).json({ success: false, error: 'Host has no phone number on file' });
    }

    const message = `Hola ${booking.host_id.name}, tienes una nueva reserva confirmada en ${booking.property_id.name} `
      + `del ${new Date(booking.check_in).toLocaleDateString()} al ${new Date(booking.check_out).toLocaleDateString()}. `
      + `Total a cobrar en el alojamiento: $${booking.total_amount} USD.`;

    const url = buildWhatsAppLink(booking.host_id.phone, message);

    res.json({ success: true, data: { url } });
  } catch (error) {
    next(error);
  }
};

// Arma los links wa.me y mailto: pre-llenados para que el admin le escriba
// manualmente al turista (pago recibido / recordatorio / confirmación completa).
// El envío lo hace el admin con un clic -- sin API de pago ni proveedor de correo.
exports.getBookingTouristContactLinks = async (req, res, next) => {
  try {
    const { type } = req.query;
    const validTypes = ['payment_received', 'payment_reminder', 'booking_complete'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid or missing type. Use: ' + validTypes.join(', ') });
    }

    const booking = await Booking.findOne({ _id: req.params.id, tenant_id: req.tenantId })
      .populate('property_id', 'name location')
      .populate('host_id', 'name phone');

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const phone = booking.tourist_data?.phone;
    const email = booking.tourist_data?.email;
    const lang = booking.tourist_data?.language || 'es';

    if (!phone && !email) {
      return res.status(400).json({ success: false, error: 'Tourist has no phone or email on file' });
    }

    // Para el recordatorio, si ya existe un intento de pago con red elegida,
    // se la indicamos explícita en el mensaje (evita que envíen por la red equivocada).
    let network;
    if (type === 'payment_reminder') {
      const payment = await Payment.findOne({ booking_id: booking._id }).sort({ created_at: -1 });
      const payCurrency = payment?.pay_currency?.toLowerCase();
      if (payCurrency) {
        if (payCurrency.includes('trc')) network = 'TRC20';
        else if (payCurrency.includes('bsc') || payCurrency.includes('bep')) network = 'BEP20';
      }
    }

    const location = booking.property_id?.location;
    const address = location
      ? [location.address, location.neighborhood, location.city].filter(Boolean).join(', ')
      : '';

    const data = {
      touristName: booking.tourist_data?.name || '',
      propertyName: booking.property_id?.name || '',
      address,
      checkIn: new Date(booking.check_in).toLocaleDateString(lang),
      checkOut: new Date(booking.check_out).toLocaleDateString(lang),
      bookingType: booking.booking_type,
      totalAmount: booking.total_amount,
      feeAmount: booking.fee_amount,
      hostName: booking.host_id?.name || '',
      hostPhone: booking.host_id?.phone || '',
      network,
    };

    const message = buildTouristMessage(type, lang, data);
    if (!message) {
      return res.status(400).json({ success: false, error: 'Unable to build message for this type' });
    }

    const whatsapp_url = phone ? buildWhatsAppLink(phone, message.body) : null;
    const mailto_url = email ? buildMailtoLink(email, message.subject, message.body) : null;

    res.json({ success: true, data: { whatsapp_url, mailto_url } });
  } catch (error) {
    next(error);
  }
};

// Lista los IPN de NOWPayments que no se pudieron asociar a ninguna reserva,
// para revisión manual del admin (en vez de que se pierdan en el log).
exports.getOrphanedPayments = async (req, res, next) => {
  try {
    const { reviewed } = req.query;
    // Los pagos huérfanos pueden no tener tenant_id (un IPN sin order_id válido
    // no tiene forma de saber a qué tenant pertenece) -- se incluyen igual,
    // ya que hoy solo existe un tenant en el sistema.
    const filter = { $or: [{ tenant_id: req.tenantId }, { tenant_id: { $exists: false } }, { tenant_id: null }] };
    if (reviewed === 'true') filter.reviewed = true;
    if (reviewed === 'false') filter.reviewed = false;

    const payments = await OrphanedPayment.find(filter).sort({ created_at: -1 }).limit(200);

    res.json({ success: true, data: { payments } });
  } catch (error) {
    next(error);
  }
};

// Marca un pago huérfano como revisado, con notas de cómo se resolvió
// (ej. "se aprobó manualmente la reserva X", "pago duplicado, ignorar", etc.)
exports.reviewOrphanedPayment = async (req, res, next) => {
  try {
    const orphan = await OrphanedPayment.findOne({
      _id: req.params.id,
      $or: [{ tenant_id: req.tenantId }, { tenant_id: { $exists: false } }, { tenant_id: null }],
    });
    if (!orphan) {
      return res.status(404).json({ success: false, error: 'Orphaned payment not found' });
    }

    orphan.reviewed = true;
    orphan.reviewed_by = req.user._id;
    orphan.reviewed_at = new Date();
    orphan.resolution_notes = req.body.notes || '';
    await orphan.save();

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'review_orphaned_payment',
      target_type: 'OrphanedPayment',
      target_id: orphan._id,
      metadata: { notes: req.body.notes },
    });

    res.json({ success: true, data: { orphan_id: orphan._id, reviewed: true } });
  } catch (error) {
    next(error);
  }
};

// Lista el historial de acciones admin (logs de auditoría), más reciente
// primero. Filtrable por tipo de acción o por recurso afectado.
exports.getAuditLog = async (req, res, next) => {
  try {
    const AdminActionLog = require('../models/AdminActionLog');
    const { action, target_type, page = 1, limit = 50 } = req.query;

    const filter = { tenant_id: req.tenantId };
    if (action) filter.action = action;
    if (target_type) filter.target_type = target_type;

    const [logs, total] = await Promise.all([
      AdminActionLog.find(filter)
        .populate('admin_id', 'name email')
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      AdminActionLog.countDocuments(filter),
    ]);

    res.json({ success: true, data: { logs, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

// Lista las comisiones mensuales de hosts (Opción B) -- filtra opcionalmente
// por status para ver, por ejemplo, solo las vencidas ("overdue").
exports.getHostCommissions = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { tenant_id: req.tenantId };
    if (status) filter.status = status;

    const commissions = await HostMonthlyCommission.find(filter)
      .populate('host_id', 'name email phone')
      .sort({ year: -1, month: -1 });

    res.json({ success: true, data: { commissions } });
  } catch (error) {
    next(error);
  }
};

exports.markHostCommissionPaid = async (req, res, next) => {
  try {
    const commission = await HostMonthlyCommission.findOne({ _id: req.params.id, tenant_id: req.tenantId });
    if (!commission) {
      return res.status(404).json({ success: false, error: 'Commission not found' });
    }

    commission.status = 'paid';
    commission.paid_at = new Date();
    commission.paid_method = req.body.method || 'manual';
    commission.notes = req.body.notes;
    await commission.save();

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'mark_host_commission_paid',
      target_type: 'HostMonthlyCommission',
      target_id: commission._id,
      metadata: { amount: commission.commission_amount, method: req.body.method },
    });

    res.json({ success: true, data: { commission_id: commission._id, status: 'paid' } });
  } catch (error) {
    next(error);
  }
};

exports.markHostCommissionWaived = async (req, res, next) => {
  try {
    const commission = await HostMonthlyCommission.findOne({ _id: req.params.id, tenant_id: req.tenantId });
    if (!commission) {
      return res.status(404).json({ success: false, error: 'Commission not found' });
    }

    commission.status = 'waived';
    commission.notes = req.body.reason || 'Waived by admin';
    await commission.save();

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'waive_host_commission',
      target_type: 'HostMonthlyCommission',
      target_id: commission._id,
      metadata: { amount: commission.commission_amount, reason: req.body.reason },
    });

    res.json({ success: true, data: { commission_id: commission._id, status: 'waived' } });
  } catch (error) {
    next(error);
  }
};

// Link wa.me pre-llenado para recordarle al host que debe su comisión
// mensual. El admin lo abre manualmente -- mismo patrón que los demás wa.me.
exports.getHostCommissionWhatsAppLink = async (req, res, next) => {
  try {
    const commission = await HostMonthlyCommission.findOne({ _id: req.params.id, tenant_id: req.tenantId })
      .populate('host_id', 'name phone');

    if (!commission) {
      return res.status(404).json({ success: false, error: 'Commission not found' });
    }
    if (!commission.host_id?.phone) {
      return res.status(400).json({ success: false, error: 'Host has no phone number on file' });
    }

    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const monthLabel = `${monthNames[commission.month - 1]} ${commission.year}`;

    const message = `Hola ${commission.host_id.name}, tienes una comisión pendiente de $${commission.commission_amount} USD `
      + `correspondiente a las reservas de ${monthLabel} pagadas en efectivo (10% sobre $${commission.total_amount} USD). `
      + `Por favor coordina el pago cuando puedas. ¡Gracias!`;

    const url = buildWhatsAppLink(commission.host_id.phone, message);

    res.json({ success: true, data: { url } });
  } catch (error) {
    next(error);
  }
};
