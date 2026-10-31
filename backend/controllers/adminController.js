const Booking = require('../models/Booking');
const Property = require('../models/Property');
const { withPropertyLock } = require('../utils/propertyLock');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const Payment = require('../models/Payment');
const OrphanedPayment = require('../models/OrphanedPayment');
const HostMonthlyCommission = require('../models/HostMonthlyCommission');
const Experience = require('../models/Experience');
const ExperienceBooking = require('../models/ExperienceBooking');
const OrganizerMonthlyCommission = require('../models/OrganizerMonthlyCommission');
const { promoteNextWaitlistEntry } = require('../utils/experienceWaitlist');
const { sendEmail } = require('../utils/email');
const { buildWhatsAppLink } = require('../utils/whatsapp');
const { buildMailtoLink } = require('../utils/mailto');
const { buildTouristMessage } = require('../utils/touristMessages');
const { logAdminAction } = require('../utils/auditLog');
const env = require('../config/env');
const { parsePagination } = require('../utils/helpers');

const ACTIVE_BOOKING_STATUSES = ['pending_payment', 'pending_approval', 'approved'];

// Campos que el admin puede editar en una propiedad (nunca tenant_id/host_id/_id).
const ADMIN_PROPERTY_FIELDS = [
  'name', 'type', 'description', 'location', 'max_guests', 'bedrooms', 'bathrooms', 'bed_types',
  'price_per_night', 'currency', 'amenities', 'images', 'payment_options', 'status', 'admin_notes',
  'suspended', 'suspension_reason', 'rejection_reason',
];

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
        // Fees cobrados: incluye reservas completadas (antes solo 'approved',
        // asi que el ingreso "desaparecia" al completarse la reserva).
        { $match: { tenant_id: tenantId, fee_paid: true, status: { $in: ['pending_approval', 'approved', 'completed'] } } },
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
    property.changes_pending_review = false;
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
        subject: 'Property Approved - Elysio Experiences',
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
        subject: 'Property Rejected - Elysio Experiences',
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
    const { status, property_id, sort_by } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10 });

    const query = { tenant_id: req.tenantId };

    if (status) query.status = String(status);
    if (property_id) query.property_id = String(property_id);

    let sortOption = { created_at: -1 };
    if (sort_by === 'oldest') sortOption = { created_at: 1 };

    const [bookings, total_count] = await Promise.all([
      Booking.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate('property_id', 'name')
        .populate('tourist_id', 'name email')
        .populate('host_id', 'name'),
      Booking.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: { bookings, total_count, page, per_page: limit },
    });
  } catch (error) {
    next(error);
  }
};

// Confirma a mano un pago del metodo 'paypal_manual' (link a la cuenta de
// un tercero fuera de Cuba -- no hay API ni webhook posible para este metodo,
// ver decision del 31-ago-2026). El admin revisa el deposito por fuera del
// sistema y despues llama esto; produce el mismo efecto que el webhook de
// QvaPay cuando confirma un pago (pasa a pending_approval para revision normal).
exports.confirmManualPayment = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      payment_method: 'paypal_manual',
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found or not using manual PayPal' });
    }

    if (booking.status !== 'pending_payment') {
      return res.status(400).json({ success: false, error: 'Booking is not pending payment' });
    }

    const result = await Booking.updateOne(
      { _id: booking._id, status: 'pending_payment' },
      {
        $set: {
          status: 'pending_approval',
          payment_stage: 'paid',
          fee_paid: true,
          fee_paid_at: new Date(),
          fee_transaction_id: String(req.body.reference || booking.payment_reference || 'manual-paypal').slice(0, 200),
          payment_needs_review: false,
        },
        $push: { status_history: { status: 'pending_approval', changed_at: new Date(), changed_by: String(req.user._id) } },
      },
    );
    if (result.modifiedCount !== 1) {
      return res.status(409).json({ success: false, error: 'Booking status changed, reload and try again' });
    }

    await Payment.findOneAndUpdate(
      { booking_id: booking._id, method: 'paypal_manual' },
      { payment_status: 'finished' },
      { sort: { created_at: -1 } }
    );

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'confirm_manual_paypal_payment',
      target_type: 'Booking',
      target_id: booking._id,
      metadata: { reference: req.body.reference },
    });

    res.json({ success: true, data: { booking_id: booking._id, status: 'pending_approval' } });
  } catch (error) {
    next(error);
  }
};

// Solo se exponen/editan los ajustes que de verdad usa la app. Los antiguos
// campos de pasarela (NOWPayments) y fee no tenian efecto: el fee esta fijo
// en $7 (Booking.fee_amount) y las credenciales de QvaPay van por variables de entorno.
const pickSettings = (tenant) => ({
  logo_url: tenant.settings?.branding?.logo_url || '',
  favicon_url: tenant.settings?.branding?.favicon_url || '',
  primary_color: tenant.settings?.branding?.primary_color || '',
  secondary_color: tenant.settings?.branding?.secondary_color || '',
  languages: tenant.settings?.languages || [],
  default_language: tenant.settings?.default_language || 'en',
  admin_email: tenant.admin_email || '',
  admin_whatsapp: tenant.admin_whatsapp || '',
});

exports.getSettings = async (req, res, next) => {
  try {
    const Tenant = require('../models/Tenant');
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }
    res.json({ success: true, data: { settings: pickSettings(tenant) } });
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
    const str = (value) => String(value ?? '').trim().slice(0, 500);

    if (req.body.logo_url !== undefined) s.branding.logo_url = str(req.body.logo_url);
    if (req.body.favicon_url !== undefined) s.branding.favicon_url = str(req.body.favicon_url);
    if (req.body.primary_color !== undefined) s.branding.primary_color = str(req.body.primary_color);
    if (req.body.secondary_color !== undefined) s.branding.secondary_color = str(req.body.secondary_color);
    if (Array.isArray(req.body.languages)) {
      s.languages = req.body.languages.filter((l) => ['en', 'es', 'fr'].includes(l));
    }
    if (['en', 'es', 'fr'].includes(req.body.default_language)) s.default_language = req.body.default_language;
    if (req.body.admin_email !== undefined && str(req.body.admin_email)) tenant.admin_email = str(req.body.admin_email);
    if (req.body.admin_whatsapp !== undefined) tenant.admin_whatsapp = str(req.body.admin_whatsapp);

    await tenant.save();

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'update_settings',
      target_type: 'Tenant',
      target_id: tenant._id,
    });

    res.json({ success: true, data: { tenant_id: tenant._id, settings: pickSettings(tenant) } });
  } catch (error) {
    next(error);
  }
};

exports.getHosts = async (req, res, next) => {
  try {
    const { host_status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { tenant_id: req.tenantId, role: 'host' };
    if (host_status) filter.host_status = String(host_status);

    const total = await User.countDocuments(filter);
    const hosts = await User.find(filter)
      .select('-password_hash')
      .skip(skip)
      .limit(limit)
      .sort({ created_at: -1 });

    res.json({
      success: true,
      data: { hosts, total, page, pages: Math.ceil(total / limit) },
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
    host.refresh_token = null;
    await host.save();

    // Antes sus propiedades seguian publicadas y reservables.
    await Property.updateMany(
      { host_id: host._id, tenant_id: req.tenantId, suspended: { $ne: true } },
      { $set: { suspended: true, suspension_reason: 'host_suspended', suspended_at: new Date() } },
    );

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

// Reactiva un host suspendido y vuelve a publicar las propiedades que se
// suspendieron por su suspension (no las que el admin suspendio aparte).
exports.reactivateHost = async (req, res, next) => {
  try {
    const host = await User.findOne({ _id: req.params.id, tenant_id: req.tenantId, role: 'host' });
    if (!host) {
      return res.status(404).json({ success: false, error: 'Host not found' });
    }

    host.status = 'active';
    await host.save();

    await Property.updateMany(
      { host_id: host._id, tenant_id: req.tenantId, suspended: true, suspension_reason: 'host_suspended' },
      { $set: { suspended: false }, $unset: { suspension_reason: '', suspended_at: '' } },
    );

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'reactivate_host',
      target_type: 'User',
      target_id: host._id,
    });

    res.json({ success: true, data: { host_id: host._id, status: 'active' } });
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
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { tenant_id: req.tenantId };
    if (status) filter.status = String(status);

    const total = await Property.countDocuments(filter);
    const properties = await Property.find(filter)
      .populate('host_id', 'name email phone whatsapp_phone created_at')
      .skip(skip)
      .limit(limit)
      .sort({ created_at: -1 });

    res.json({ success: true, data: { properties, total, page, pages: Math.ceil(total / limit) } });
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

    const updates = Object.fromEntries(
      ADMIN_PROPERTY_FIELDS.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]),
    );
    if (updates.suspended === true && !property.suspended) updates.suspended_at = new Date();

    const updated = await Property.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json({ success: true, data: { property: updated } });

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'edit_property',
      target_type: 'Property',
      target_id: property._id,
      metadata: { fields: Object.keys(updates) },
    });
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

    const activeBookings = await Booking.countDocuments({
      property_id: property._id,
      tenant_id: req.tenantId,
      status: { $in: ACTIVE_BOOKING_STATUSES },
    });
    if (activeBookings > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete a property with active bookings. Suspend it instead.' });
    }

    await Property.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'delete_property',
      target_type: 'Property',
      target_id: property._id,
      metadata: { name: property.name, host_id: property.host_id },
    });
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
              blocked_by: 'admin',
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
    const { action, target_type } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });

    const filter = { tenant_id: req.tenantId };
    if (action) filter.action = String(action);
    if (target_type) filter.target_type = String(target_type);

    const [logs, total] = await Promise.all([
      AdminActionLog.find(filter)
        .populate('admin_id', 'name email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      AdminActionLog.countDocuments(filter),
    ]);

    res.json({ success: true, data: { logs, total, page, pages: Math.ceil(total / limit) } });
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

// Lista los usuarios con una solicitud de reset de contraseña pendiente
// (token válido, no expirado, sin usar todavía). El admin entrega el link
// manualmente -- no hay envío automático de email.
exports.getPasswordResetRequests = async (req, res, next) => {
  try {
    const users = await User.find({
      tenant_id: req.tenantId,
      password_reset_token: { $exists: true, $ne: null },
      password_reset_expires: { $gt: new Date() },
    }).select('+password_reset_token +password_reset_expires').sort({ password_reset_expires: -1 });

    res.json({
      success: true,
      data: {
        requests: users.map((u) => ({
          user_id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          expires_at: u.password_reset_expires,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Arma los links wa.me/mailto con el enlace de reset real, para que el
// admin se lo mande al usuario con un clic. Regenera el token al momento de
// la entrega (el guardado está hasheado y no se puede revertir).
exports.getPasswordResetDeliveryLinks = async (req, res, next) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
      password_reset_expires: { $gt: new Date() },
    }).select('+password_reset_token +password_reset_expires');

    if (!user) {
      return res.status(404).json({ success: false, error: 'No pending reset request found (may have expired)' });
    }

    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.password_reset_token = crypto.createHash('sha256').update(rawToken).digest('hex');
    await user.save();

    // Con este link el admin puede entrar en la cuenta: queda registrado.
    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'generate_password_reset_link',
      target_type: 'User',
      target_id: user._id,
      metadata: { email: user.email },
    });

    const resetLink = `${env.frontendUrl}/reset-password?token=${rawToken}`;
    const message = `Hola ${user.name}, recibimos tu solicitud para restablecer tu contraseña en Elysio Experiences. `
      + `Usa este link para crear una nueva contraseña (válido por 1 hora): ${resetLink}\n\n`
      + `Si no lo solicitaste, ignora este mensaje.`;

    const whatsapp_url = user.phone ? buildWhatsAppLink(user.phone, message) : null;
    const mailto_url = user.email ? buildMailtoLink(user.email, 'Restablecer tu contraseña - Elysio Experiences', message) : null;

    res.json({ success: true, data: { whatsapp_url, mailto_url, reset_link: resetLink } });
  } catch (error) {
    next(error);
  }
};

// ===== ORGANIZADORES (excursiones y viajes locales) =====
// Mismo patrón que getHosts/approveHost/rejectHost/suspendHost/deleteHost,
// pero para role='organizer' + organizer_status.

exports.getOrganizers = async (req, res, next) => {
  try {
    const { organizer_status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { tenant_id: req.tenantId, role: 'organizer' };
    if (organizer_status) filter.organizer_status = String(organizer_status);

    const total = await User.countDocuments(filter);
    const organizers = await User.find(filter)
      .select('-password_hash')
      .skip(skip)
      .limit(limit)
      .sort({ created_at: -1 });

    res.json({
      success: true,
      data: { organizers, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.approveOrganizer = async (req, res, next) => {
  try {
    const organizer = await User.findOne({ _id: req.params.id, tenant_id: req.tenantId, role: 'organizer' });
    if (!organizer) {
      return res.status(404).json({ success: false, error: 'Organizer not found' });
    }

    organizer.organizer_status = 'approved';
    organizer.organizer_approved_by = req.user._id;
    await organizer.save();

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'approve_organizer',
      target_type: 'User',
      target_id: organizer._id,
    });

    res.json({ success: true, data: { organizer_id: organizer._id, organizer_status: 'approved' } });
  } catch (error) {
    next(error);
  }
};

exports.rejectOrganizer = async (req, res, next) => {
  try {
    const organizer = await User.findOne({ _id: req.params.id, tenant_id: req.tenantId, role: 'organizer' });
    if (!organizer) {
      return res.status(404).json({ success: false, error: 'Organizer not found' });
    }

    organizer.organizer_status = 'rejected';
    organizer.organizer_status_reason = req.body.reason;
    await organizer.save();

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'reject_organizer',
      target_type: 'User',
      target_id: organizer._id,
      metadata: { reason: req.body.reason },
    });

    res.json({ success: true, data: { organizer_id: organizer._id, organizer_status: 'rejected' } });
  } catch (error) {
    next(error);
  }
};

exports.suspendOrganizer = async (req, res, next) => {
  try {
    const organizer = await User.findOne({ _id: req.params.id, tenant_id: req.tenantId, role: 'organizer' });
    if (!organizer) {
      return res.status(404).json({ success: false, error: 'Organizer not found' });
    }

    organizer.status = 'suspended';
    organizer.refresh_token = null;
    await organizer.save();

    // Sus excursiones futuras dejan de estar publicadas.
    await Experience.updateMany(
      { organizer_id: organizer._id, tenant_id: req.tenantId, status: 'active', date: { $gt: new Date() } },
      { $set: { status: 'cancelled', admin_notes: 'Organizador suspendido' } },
    );

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'suspend_organizer',
      target_type: 'User',
      target_id: organizer._id,
    });

    res.json({ success: true, data: { organizer_id: organizer._id, status: 'suspended' } });
  } catch (error) {
    next(error);
  }
};

// Reactiva un organizador. Sus excursiones futuras canceladas por la
// suspension vuelven a revision del admin (no se publican solas).
exports.reactivateOrganizer = async (req, res, next) => {
  try {
    const organizer = await User.findOne({ _id: req.params.id, tenant_id: req.tenantId, role: 'organizer' });
    if (!organizer) {
      return res.status(404).json({ success: false, error: 'Organizer not found' });
    }

    organizer.status = 'active';
    await organizer.save();

    await Experience.updateMany(
      {
        organizer_id: organizer._id,
        tenant_id: req.tenantId,
        status: 'cancelled',
        admin_notes: 'Organizador suspendido',
        date: { $gt: new Date() },
      },
      { $set: { status: 'pending_approval' }, $unset: { admin_notes: '' } },
    );

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'reactivate_organizer',
      target_type: 'User',
      target_id: organizer._id,
    });

    res.json({ success: true, data: { organizer_id: organizer._id, status: 'active' } });
  } catch (error) {
    next(error);
  }
};

exports.deleteOrganizer = async (req, res, next) => {
  try {
    const organizer = await User.findOne({ _id: req.params.id, tenant_id: req.tenantId, role: 'organizer' });
    if (!organizer) {
      return res.status(404).json({ success: false, error: 'Organizer not found' });
    }

    const activeBookings = await ExperienceBooking.countDocuments({
      organizer_id: organizer._id,
      tenant_id: req.tenantId,
      status: { $in: ['pending_approval', 'approved'] },
    });

    if (activeBookings > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete organizer with active bookings. Cancel or complete their bookings first.' });
    }

    await Experience.deleteMany({ organizer_id: organizer._id, tenant_id: req.tenantId });
    await User.findByIdAndDelete(organizer._id);

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'delete_organizer',
      target_type: 'User',
      target_id: organizer._id,
      metadata: { organizer_email: organizer.email, organizer_name: organizer.name },
    });

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// ===== EXCURSIONES =====
// Incluye tanto excursiones de fecha única como ocurrencias generadas por
// una plantilla recurrente (recurrence_id != null) -- ambas se aprueban
// individualmente, mismo endpoint.

exports.getPendingExperiences = async (req, res, next) => {
  try {
    const experiences = await Experience.find({
      tenant_id: req.tenantId,
      status: 'pending_approval',
    }).populate('organizer_id', 'name email').sort({ date: 1 });

    res.json({ success: true, data: { experiences } });
  } catch (error) {
    next(error);
  }
};

exports.approveExperience = async (req, res, next) => {
  try {
    const experience = await Experience.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    }).populate('organizer_id', 'name email');

    if (!experience) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    experience.status = 'active';
    await experience.save();

    res.json({ success: true, data: { experience_id: experience._id, status: 'active' } });

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'approve_experience',
      target_type: 'Experience',
      target_id: experience._id,
    });

    if (experience.organizer_id?.email) {
      sendEmail({
        to: experience.organizer_id.email,
        subject: 'Excursión aprobada - Elysio Experiences',
        html: `
          <h1>¡Excursión aprobada!</h1>
          <p>Tu excursión <strong>${experience.title}</strong> del ${new Date(experience.date).toLocaleDateString()} fue aprobada y ya está visible para los clientes.</p>
        `,
      }).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
};

exports.rejectExperience = async (req, res, next) => {
  try {
    const experience = await Experience.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    }).populate('organizer_id', 'name email');

    if (!experience) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    experience.status = 'rejected';
    experience.rejection_reason = req.body.reason;
    await experience.save();

    res.json({ success: true, data: { experience_id: experience._id, status: 'rejected' } });

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'reject_experience',
      target_type: 'Experience',
      target_id: experience._id,
      metadata: { reason: req.body.reason },
    });

    if (experience.organizer_id?.email) {
      sendEmail({
        to: experience.organizer_id.email,
        subject: 'Excursión no aprobada - Elysio Experiences',
        html: `
          <h1>Excursión no aprobada</h1>
          <p>Tu excursión <strong>${experience.title}</strong> del ${new Date(experience.date).toLocaleDateString()} no fue aprobada.</p>
          ${req.body.reason ? `<p><strong>Motivo:</strong> ${req.body.reason}</p>` : ''}
        `,
      }).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
};

// ===== RESERVAS DE EXCURSIONES =====

exports.getAllExperienceBookings = async (req, res, next) => {
  try {
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { tenant_id: req.tenantId };
    if (status) filter.status = String(status);

    const [bookings, total_count] = await Promise.all([
      ExperienceBooking.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate('experience_id', 'title date')
        .populate('tourist_id', 'name email')
        .populate('organizer_id', 'name'),
      ExperienceBooking.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { bookings, total_count, page, per_page: limit },
    });
  } catch (error) {
    next(error);
  }
};

exports.approveExperienceBooking = async (req, res, next) => {
  try {
    const booking = await ExperienceBooking.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId,
    }).populate('experience_id', 'title date').populate('tourist_id', 'email').populate('organizer_id', 'name email phone');

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'pending_approval') {
      return res.status(400).json({ success: false, error: 'Booking is not pending approval' });
    }

    const set = { status: 'approved', approved_by: req.user._id, approved_at: new Date() };
    if (req.body.notes) set.admin_notes = String(req.body.notes).slice(0, 2000);
    const approved = await ExperienceBooking.updateOne(
      { _id: booking._id, status: 'pending_approval' },
      { $set: set, $push: { status_history: { status: 'approved', changed_at: new Date(), changed_by: String(req.user._id) } } },
    );
    if (approved.modifiedCount !== 1) {
      return res.status(409).json({ success: false, error: 'Booking status changed, reload and try again' });
    }

    res.json({ success: true, data: { booking_id: booking._id, status: 'approved' } });

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'approve_experience_booking',
      target_type: 'ExperienceBooking',
      target_id: booking._id,
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectExperienceBooking = async (req, res, next) => {
  try {
    const booking = await ExperienceBooking.findOne({ _id: req.params.id, tenant_id: req.tenantId });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (booking.status !== 'pending_approval') {
      return res.status(400).json({ success: false, error: 'Booking is not pending approval' });
    }

    // Atomico: si el cron la vencio en paralelo, no se liberan los cupos dos veces.
    const rejected = await ExperienceBooking.updateOne(
      { _id: booking._id, status: 'pending_approval' },
      {
        $set: { status: 'rejected', rejection_reason: String(req.body.reason || '').slice(0, 2000) },
        $push: { status_history: { status: 'rejected', changed_at: new Date(), changed_by: String(req.user._id) } },
      },
    );
    if (rejected.modifiedCount !== 1) {
      return res.status(409).json({ success: false, error: 'Booking status changed, reload and try again' });
    }

    // Libera los cupos que se habían descontado atómicamente al reservar.
    await Experience.findOneAndUpdate(
      { _id: booking.experience_id, tenant_id: req.tenantId },
      { $inc: { current_participants: -booking.num_spots } }
    );

    await promoteNextWaitlistEntry(req.tenantId, booking.experience_id);

    res.json({ success: true, data: { booking_id: booking._id, status: 'rejected' } });

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'reject_experience_booking',
      target_type: 'ExperienceBooking',
      target_id: booking._id,
      metadata: { reason: req.body.reason },
    });
  } catch (error) {
    next(error);
  }
};

// Link wa.me pre-llenado para avisarle al organizador de una reserva
// aprobada -- incluye cuánto cobrar en cada moneda, ya que el pago real
// lo coordina el organizador directo con el cliente (no pasa por la
// plataforma).
exports.getExperienceBookingOrganizerWhatsAppLink = async (req, res, next) => {
  try {
    const booking = await ExperienceBooking.findOne({ _id: req.params.id, tenant_id: req.tenantId })
      .populate('experience_id', 'title date')
      .populate('organizer_id', 'name phone')
      .populate('tourist_id', 'name');

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    if (!booking.organizer_id?.phone) {
      return res.status(400).json({ success: false, error: 'Organizer has no phone number on file' });
    }

    const paymentLines = booking.payment_info
      .map((p) => `${p.num_spots} x ${p.audience === 'local' ? 'local' : 'turista'} -- ${p.amount} ${p.currency}`)
      .join('; ');

    const message = `Hola ${booking.organizer_id.name}, tienes una nueva reserva confirmada en "${booking.experience_id.title}" `
      + `del ${new Date(booking.experience_id.date).toLocaleDateString()}. `
      + `Cliente: ${booking.tourist_data?.name || booking.tourist_id?.name || 'N/A'}, contacto: ${booking.tourist_data?.phone || 'N/A'}. `
      + `Cupos: ${booking.num_spots}. A cobrar: ${paymentLines}.`;

    const url = buildWhatsAppLink(booking.organizer_id.phone, message);

    res.json({ success: true, data: { url } });
  } catch (error) {
    next(error);
  }
};

// Links wa.me/mailto para avisarle al turista que su reserva de excursión
// fue aprobada (con contacto del organizador) o rechazada.
exports.getExperienceBookingTouristContactLinks = async (req, res, next) => {
  try {
    const booking = await ExperienceBooking.findOne({ _id: req.params.id, tenant_id: req.tenantId })
      .populate('experience_id', 'title date')
      .populate('organizer_id', 'name phone');

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const phone = booking.tourist_data?.phone;
    const email = booking.tourist_data?.email;
    if (!phone && !email) {
      return res.status(400).json({ success: false, error: 'Tourist has no phone or email on file' });
    }

    let message;
    const subject = `Tu reserva en "${booking.experience_id.title}" - Elysio Experiences`;

    if (booking.status === 'approved') {
      message = `Hola ${booking.tourist_data?.name || ''}, tu reserva en "${booking.experience_id.title}" `
        + `del ${new Date(booking.experience_id.date).toLocaleDateString()} fue confirmada. `
        + `El organizador ${booking.organizer_id?.name || ''} se pondrá en contacto contigo`
        + `${booking.organizer_id?.phone ? ` (${booking.organizer_id.phone})` : ''} para coordinar el pago y los detalles.`;
    } else if (booking.status === 'rejected') {
      message = `Hola ${booking.tourist_data?.name || ''}, lamentablemente tu reserva en "${booking.experience_id.title}" no pudo confirmarse.`
        + `${booking.rejection_reason ? ` Motivo: ${booking.rejection_reason}.` : ''}`;
    } else {
      return res.status(400).json({ success: false, error: 'Booking must be approved or rejected to contact the tourist' });
    }

    const whatsapp_url = phone ? buildWhatsAppLink(phone, message) : null;
    const mailto_url = email ? buildMailtoLink(email, subject, message) : null;

    res.json({ success: true, data: { whatsapp_url, mailto_url } });
  } catch (error) {
    next(error);
  }
};

// ===== COMISIONES MENSUALES DE ORGANIZADORES =====
// Mismo patrón que las comisiones de hosts, pero con desglose por moneda
// (totals[]) en vez de un total_amount único -- ver plan del módulo,
// sección 3.4.

exports.getOrganizerCommissions = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { tenant_id: req.tenantId };
    if (status) filter.status = status;

    const commissions = await OrganizerMonthlyCommission.find(filter)
      .populate('organizer_id', 'name email phone')
      .sort({ year: -1, month: -1 });

    res.json({ success: true, data: { commissions } });
  } catch (error) {
    next(error);
  }
};

exports.markOrganizerCommissionPaid = async (req, res, next) => {
  try {
    const commission = await OrganizerMonthlyCommission.findOne({ _id: req.params.id, tenant_id: req.tenantId });
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
      action: 'mark_organizer_commission_paid',
      target_type: 'OrganizerMonthlyCommission',
      target_id: commission._id,
      metadata: { totals: commission.totals, method: req.body.method },
    });

    res.json({ success: true, data: { commission_id: commission._id, status: 'paid' } });
  } catch (error) {
    next(error);
  }
};

exports.markOrganizerCommissionWaived = async (req, res, next) => {
  try {
    const commission = await OrganizerMonthlyCommission.findOne({ _id: req.params.id, tenant_id: req.tenantId });
    if (!commission) {
      return res.status(404).json({ success: false, error: 'Commission not found' });
    }

    commission.status = 'waived';
    commission.notes = req.body.reason || 'Waived by admin';
    await commission.save();

    logAdminAction({
      tenant_id: req.tenantId,
      admin_id: req.user._id,
      action: 'waive_organizer_commission',
      target_type: 'OrganizerMonthlyCommission',
      target_id: commission._id,
      metadata: { totals: commission.totals, reason: req.body.reason },
    });

    res.json({ success: true, data: { commission_id: commission._id, status: 'waived' } });
  } catch (error) {
    next(error);
  }
};

// Link wa.me pre-llenado -- lista cada moneda por separado, ej:
// "debes 1500 CUP + 25 USD", ya que no se convierten entre sí.
exports.getOrganizerCommissionWhatsAppLink = async (req, res, next) => {
  try {
    const commission = await OrganizerMonthlyCommission.findOne({ _id: req.params.id, tenant_id: req.tenantId })
      .populate('organizer_id', 'name phone');

    if (!commission) {
      return res.status(404).json({ success: false, error: 'Commission not found' });
    }
    if (!commission.organizer_id?.phone) {
      return res.status(400).json({ success: false, error: 'Organizer has no phone number on file' });
    }

    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const monthLabel = `${monthNames[commission.month - 1]} ${commission.year}`;

    const amountsLine = commission.totals
      .map((t) => `${t.commission_amount} ${t.currency}`)
      .join(' + ');

    const message = `Hola ${commission.organizer_id.name}, tienes una comisión pendiente de ${amountsLine} `
      + `correspondiente a las excursiones de ${monthLabel} (10% sobre lo cobrado a los clientes). `
      + `Por favor coordina el pago cuando puedas. ¡Gracias!`;

    const url = buildWhatsAppLink(commission.organizer_id.phone, message);

    res.json({ success: true, data: { url } });
  } catch (error) {
    next(error);
  }
};

// Conteo de pendientes por categoría -- alimenta la campanita del panel
// admin. Un solo endpoint liviano en vez de 5 llamadas separadas.
exports.getPendingCounts = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const [
      bookings, properties, password_resets, orphaned_payments, overdue_commissions,
      pending_experiences, pending_experience_bookings, overdue_organizer_commissions,
      manual_payments_pending,
    ] = await Promise.all([
      Booking.countDocuments({ tenant_id: tenantId, status: 'pending_approval' }),
      Property.countDocuments({ tenant_id: tenantId, status: 'pending_approval' }),
      User.countDocuments({
        tenant_id: tenantId,
        password_reset_token: { $exists: true, $ne: null },
        password_reset_expires: { $gt: new Date() },
      }),
      OrphanedPayment.countDocuments({
        $or: [{ tenant_id: tenantId }, { tenant_id: { $exists: false } }, { tenant_id: null }],
        reviewed: false,
      }),
      HostMonthlyCommission.countDocuments({ tenant_id: tenantId, status: 'overdue' }),
      Experience.countDocuments({ tenant_id: tenantId, status: 'pending_approval' }),
      ExperienceBooking.countDocuments({ tenant_id: tenantId, status: 'pending_approval' }),
      OrganizerMonthlyCommission.countDocuments({ tenant_id: tenantId, status: 'overdue' }),
      Booking.countDocuments({
        tenant_id: tenantId,
        payment_method: 'paypal_manual',
        status: 'pending_payment',
        payment_needs_review: true,
      }),
    ]);

    const counts = {
      bookings,
      properties,
      password_resets,
      orphaned_payments,
      overdue_commissions,
      pending_experiences,
      pending_experience_bookings,
      overdue_organizer_commissions,
      manual_payments_pending,
    };
    counts.total = Object.values(counts).reduce((sum, n) => sum + n, 0);

    res.json({ success: true, data: counts });
  } catch (error) {
    next(error);
  }
};
