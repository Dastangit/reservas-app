const axios = require('axios');
const crypto = require('crypto');
const env = require('../config/env');

const { apiKey, ipnSecret, apiUrl } = env.nowpayments;

function sortObject(obj) {
  return Object.keys(obj).sort().reduce((result, key) => {
    result[key] = (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key]))
      ? sortObject(obj[key])
      : obj[key];
    return result;
  }, {});
}

async function createInvoice({ price_amount, price_currency, order_id, ipn_callback_url, success_url, cancel_url, is_fee_paid_by_user, is_fixed_rate }) {
  const payload = {
    price_amount,
    price_currency,
    order_id,
    ipn_callback_url,
    success_url,
    cancel_url,
    is_fee_paid_by_user: is_fee_paid_by_user !== undefined ? is_fee_paid_by_user : true,
    is_fixed_rate: is_fixed_rate !== undefined ? is_fixed_rate : false,
  };

  const response = await axios.post(`${apiUrl}/invoice`, payload, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
}

function verifyIpnSignature(body, signature) {
  const sorted = sortObject(body);
  const sortedJson = JSON.stringify(sorted);
  const hmac = crypto.createHmac('sha512', ipnSecret);
  hmac.update(sortedJson);
  const computed = hmac.digest('hex');
  if (computed.length !== signature.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

module.exports = { createInvoice, verifyIpnSignature };
