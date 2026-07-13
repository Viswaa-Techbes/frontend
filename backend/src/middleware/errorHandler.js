const ApiError = require('../utils/ApiError');
const env = require('../config/env');

/**
 * Centralized Express error-handling middleware.
 * Must be registered after all routes.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // ── Operational (known) errors ──────────────────────────────────
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors.length > 0 && { errors: err.errors }),
    });
  }

  // ── Mongoose validation error ───────────────────────────────────
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // ── Mongoose duplicate key ──────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for field: ${field}`,
    });
  }

  // ── Mongoose bad ObjectId ───────────────────────────────────────
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      success: false,
      message: `Invalid ID: ${err.value}`,
    });
  }

  // ── JWT errors ──────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
    });
  }

  // ── Unknown / programmer errors ─────────────────────────────────
  console.error('UNHANDLED ERROR:', err);

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(env.nodeEnv === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
