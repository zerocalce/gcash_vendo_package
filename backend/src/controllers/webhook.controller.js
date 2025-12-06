/**
 * webhook.controller.js
 * Validates Xendit webhook and updates transaction status.
 *
 * This example uses a simple header token check; in production validate signatures robustly
 * per Xendit docs.
 */
const validate = require('../utils/validateXendit');
const db = require('../models/transactions.model');
const bus = require('../utils/bus');

exports.xenditWebhook = async (req, res) => {
  try {
    if (!validate(req)) {
      return res.status(401).send('invalid signature');
    }
    const event = req.body;
    // Event handling: adjust to Xendit event structure
    const referenceId = event.data?.reference_id || event.data?.id;
    const status = event.data?.status || event.event;
    console.log('Webhook:', referenceId, status);

    // Update DB (mark PENDING->PAID)
    if (status === 'SUCCEEDED' || status === 'COMPLETED') {
      await db.updateTransactionStatus(referenceId, 'PAID');
    } else if (status === 'FAILED' || status === 'EXPIRED') {
      await db.updateTransactionStatus(referenceId, 'FAILED');
    }
    try { bus.emit('webhook.status', { referenceId, status }); } catch (_) { /* ignore */ }
    res.status(200).send('OK');
  } catch (err) {
    console.error('webhook error', err);
    res.status(500).send('error');
  }
};
