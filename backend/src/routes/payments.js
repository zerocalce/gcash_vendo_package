const express = require('express');
const router = express.Router();
const controller = require('../controllers/payments.controller');

/**
 * POST /api/payments/create
 * Create a Xendit (GCash) charge for the specified amount
 * Body: { amount: number, sessionId: string, mobileNumber?: string }
 */
router.post('/create', controller.createPayment);

module.exports = router;
