const express = require('express');
const router = express.Router();
const controller = require('../controllers/webhook.controller');

/**
 * POST /api/webhook/xendit
 * Xendit will POST webhook events here.
 * Validate signature and update transactions.
 */
router.post('/xendit', controller.xenditWebhook);

module.exports = router;
