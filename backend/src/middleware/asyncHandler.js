/**
 * Wraps an async Express route handler so thrown errors are
 * forwarded to the centralized error handler automatically.
 *
 * Usage:  router.get('/', asyncHandler(myController));
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
