/**
 * Simple webhook token validation.
 * In production: validate Xendit signature per docs.
 */
module.exports = function validateXendit(req) {
  const token = process.env.XENDIT_CALLBACK_TOKEN || '';
  const header = req.headers['x-callback-token'] || req.headers['x-callback-token'.toLowerCase()];
  return header && header === token;
};
