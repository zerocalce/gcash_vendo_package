/**
 * bills.controller.js
 * Handles incoming bill detector events from the Arduino/edge module.
 * Stores temporary session info and notifies frontend via simple console log for this skeleton.
 */

const db = require('../models/transactions.model');
const bus = require('../utils/bus');

exports.detected = async (req, res) => {
  try {
    const { denomination, confidence, sensorId, metadata } = req.body;
    // Basic validation
    if (!denomination) return res.status(400).json({ error: 'denomination required' });

    // Insert a provisional banknote log (DB layer is a lightweight SQLite wrapper in models/)
    await db.insertBanknoteLog({ denomination, confidence, sensorId, metadata });

    // In production: notify frontend (WebSocket) and update session totals.
    console.log('Bill detected:', denomination, 'confidence', confidence);
    bus.emit('bill.detected', { denomination, confidence, sensorId, metadata });
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('bills.detected error', err);
    res.status(500).json({ error: 'internal' });
  }
};
