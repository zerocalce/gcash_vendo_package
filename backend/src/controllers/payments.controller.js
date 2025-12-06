/**
 * payments.controller.js
 * Creates Xendit/eWallet charge for GCash via Xendit API.
 *
 * Requires:
 * - process.env.XENDIT_SECRET_KEY
 * - process.env.XENDIT_CALLBACK_TOKEN (for webhook validation)
 *
 * This is a simplified example using axios.
 */
const xendit = require('../services/xendit.service.mock');
const db = require('../models/transactions.model');
const bus = require('../utils/bus');

exports.createPayment = async (req, res) => {
  try {
    const { amount, sessionId, mobileNumber } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'invalid amount' });

    const referenceId = 'CASHIN_' + Date.now();
    // Create DB transaction record (PENDING)
    await db.createTransaction({ id: referenceId, amount, sessionId, status: 'PENDING' });

    // Create Xendit charge
    const charge = await xendit.createGCashCharge(referenceId, amount, mobileNumber);
    const payload = { referenceId, amount, sessionId, charge: charge.data };
    try { bus.emit('payment.created', payload); } catch (_) { /* ignore */ }
    res.json(payload);
  } catch (err) {
    console.error('createPayment error', err.toString());
    res.status(500).json({ error: 'internal' });
  }
};
