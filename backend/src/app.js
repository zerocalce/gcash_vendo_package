'use strict';
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const { notFound, errorHandler } = require('./middleware/errors');

const billsRoutes = require('./routes/bills');
const paymentsRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhook');
const visionRoutes = require('./routes/vision');
const cameraRoutes = require('./routes/camera');
const hybridRoutes = require('./routes/hybrid');

const app = express();
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"]
        }
    }
}));
app.use(pinoHttp());
app.use(cors());
app.use(bodyParser.json());

// Static frontend (if bundled)
app.use('/', express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/bills', billsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/camera', cameraRoutes);
app.use('/api/hybrid', hybridRoutes);

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true }));

// 404 and error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
