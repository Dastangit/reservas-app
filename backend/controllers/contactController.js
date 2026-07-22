const Tenant = require('../models/Tenant');
const { sendEmail } = require('../utils/email');

exports.contact = async (req, res, next) => {
  try {
    const { name, email, message, property_id } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Name, email, and message are required' });
    }

    const tenant = await Tenant.findById(req.tenantId);

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    const adminEmail = tenant.admin_email;
    const adminWhatsapp = tenant.admin_phone || tenant.admin_whatsapp;

    const propertyContext = property_id ? `<p><strong>Related Property ID:</strong> ${property_id}</p>` : '';

    await sendEmail({
      to: adminEmail,
      subject: `New Contact Message from ${name} - Da-El World Travelers`,
      html: `
        <h1>New Contact Message</h1>
        <p><strong>From:</strong> ${name} (${email})</p>
        ${propertyContext}
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        ticket_id: `TICKET-${Date.now()}`,
        admin_email: adminEmail,
        admin_whatsapp: adminWhatsapp,
      },
    });
  } catch (error) {
    next(error);
  }
};
