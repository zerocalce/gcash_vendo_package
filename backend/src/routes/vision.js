'use strict';
const express = require('express');
const router = express.Router();
const bus = require('../utils/bus');
const camera = require('../utils/camera');
const { classifyBill } = require('../utils/gemini');

router.post('/classify', async (req, res) => {
  try {
    const { buffer, mimeType } = await camera.snapshot();
    const result = await classifyBill(buffer, mimeType);
    const denom = result.denomination;
    const conf = result.confidence;
    const genuine = result.is_genuine;
    const confMin = parseFloat(process.env.GEMINI_CONF_MIN || '0.85');
    const genMin = parseFloat(process.env.GEMINI_GENUINE_MIN || '0.80');
    const allowDenomOnly = process.env.GEMINI_ALLOW_DENOM_ONLY === '1';
    let emitted = false;
    const hasScores = typeof conf === 'number' && typeof genuine === 'number';
    const passScores = hasScores && conf >= confMin && genuine >= genMin;
    const canEmit = denom && (passScores || allowDenomOnly);
    if (canEmit && (req.query.emit === '1' || req.body?.emit === true)) {
      const effConf = typeof conf === 'number' ? conf : 1.0;
      bus.emit('bill.detected', { denomination: denom, confidence: effConf });
      emitted = true;
    }
    res.json({ ok: true, result, emitted });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
