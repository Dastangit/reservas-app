const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
  },
  phone: String,
  phone_whatsapp: {
    type: Boolean,
    default: false,
  },
  whatsapp_phone: String,
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  role: {
    type: String,
    enum: ['tourist', 'host', 'admin'],
    required: true,
  },
  profile: {
    avatar_url: String,
    bio: String,
    verified: { type: Boolean, default: false },
    verification_date: Date,
  },
  password_hash: {
    type: String,
    required: [true, 'Password is required'],
    select: false,
  },
  auth: {
    last_login: Date,
    login_count: { type: Number, default: 0 },
    ip_addresses: [String],
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  host_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  host_status_reason: String,
  host_approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  host_region: {
    type: String,
    enum: ['cuba', 'international'],
    default: 'cuba',
  },
  host_fee_waived_until: Date,
  refresh_token: {
    type: String,
    select: false,
  },
  two_factor: {
    enabled: { type: Boolean, default: false },
    secret: { type: String, select: false },
    backup_codes: { type: [String], select: false },
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password_hash = await bcrypt.hash(this.password_hash, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password_hash);
};

userSchema.index({ tenant_id: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
