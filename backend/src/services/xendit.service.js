/**
 * xendit.service.js
 * Minimal Xendit wrapper using axios.
 * NOTE: This code uses HTTP Basic with secret key in username per Xendit API.
 */
const axios = require('axios');

const XENDIT_API = process.env.XENDIT_API_URL || 'https://api.xendit.co';

async function createGCashCharge(referenceId, amount, mobileNumber) {
  const payload = {
    reference_id: referenceId,
    currency: 'PHP',
    amount,
    checkout_method: 'ONE_TIME_PAYMENT',
    ewallet: {
      channel_code: 'GCASH',
      channel_properties: {
        mobile_number: mobileNumber || ''
      }
    }
  };
  const auth = {
    username: process.env.XENDIT_SECRET_KEY || '',
    password: ''
  };
  return axios.post(`${XENDIT_API}/ewallets/charges`, payload, { auth });
}

module.exports = { createGCashCharge };
