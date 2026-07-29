const env = require('../config/env');
const PushSubscription = require('../models/PushSubscription');

exports.getVapidPublicKey = async (req, res) => {
  res.json({ success: true, data: { public_key: env.vapid.publicKey || null } });
};

exports.subscribe = async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, error: 'Invalid subscription object' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { endpoint, keys, user_id: req.user._id, tenant_id: req.tenantId },
      { upsert: true, new: true },
    );

    res.json({ success: true, data: { subscribed: true } });
  } catch (error) {
    next(error);
  }
};

exports.unsubscribe = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await PushSubscription.deleteOne({ endpoint, user_id: req.user._id });
    }
    res.json({ success: true, data: { subscribed: false } });
  } catch (error) {
    next(error);
  }
};
