const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Express middleware that runs an array of express-validator checks
 * and returns 422 if any fail.
 *
 * Usage:
 *   router.post('/', validate(myValidations), controller);
 *
 * @param {import('express-validator').ValidationChain[]} validations
 */
const validate = (validations) => {
  return async (req, _res, next) => {
    // Run all validations in parallel
    await Promise.all(validations.map((v) => v.run(req)));

    const result = validationResult(req);
    if (result.isEmpty()) {
      return next();
    }

    const errors = result.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));

    return next(ApiError.unprocessable('Validation failed', errors));
  };
};

module.exports = validate;
