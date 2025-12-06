const express = require('express');
const router = express.Router();
const controller = require('../controllers/bills.controller');

/**
 * POST /api/bills/detected
 * Body: { denomination: number, confidence: float, sensorId: string, metadata: {...} }
 */
router.post('/detected', controller.detected);

module.exports = router;
