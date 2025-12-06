'use strict';

// 404 handler
function notFound(req, res, next) {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
}

// Centralized error handler
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'internal_error';
  const message = err.expose ? err.message : (status >= 500 ? 'internal server error' : err.message || 'error');
  if (req.log) req.log.error({ err }, 'request error');
  else console.error('request error', err);
  res.status(status).json({ error: code, message });
}

module.exports = { notFound, errorHandler };
