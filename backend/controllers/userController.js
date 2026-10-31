const User = require('../models/User');
const { parsePagination } = require('../utils/helpers');

const MIN_PASSWORD = 8;
const asTrimmedString = (value, max) => String(value ?? '').trim().slice(0, max);

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, whatsapp_phone, phone_whatsapp, bio } = req.body;

    const user = await User.findById(req.user._id);

    if (name && String(name).trim()) user.name = asTrimmedString(name, 100);
    if (phone !== undefined) user.phone = asTrimmedString(phone, 30);
    if (whatsapp_phone !== undefined) user.whatsapp_phone = asTrimmedString(whatsapp_phone, 30);
    if (phone_whatsapp !== undefined) user.phone_whatsapp = Boolean(phone_whatsapp);
    if (bio !== undefined) user.profile.bio = asTrimmedString(bio, 2000);

    await user.save();

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, error: 'Both passwords are required' });
    }

    if (typeof new_password !== 'string' || new_password.length < MIN_PASSWORD || new_password.length > 128) {
      return res.status(400).json({ success: false, error: `New password must be at least ${MIN_PASSWORD} characters` });
    }

    const user = await User.findById(req.user._id).select('+password_hash');

    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    user.password_hash = new_password;
    // Cierra las sesiones de otros dispositivos (el refresh token deja de valer).
    user.refresh_token = null;
    await user.save();

    res.json({ success: true, data: { relogin_required: true } });
  } catch (error) {
    next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, tenant_id: req.tenantId });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const { role, status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { tenant_id: req.tenantId };
    if (role) filter.role = String(role);
    if (status) filter.status = String(status);

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ created_at: -1 });

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};
