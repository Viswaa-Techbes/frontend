const { body } = require('express-validator');
const { CLIENT_TYPES, CLIENT_STATUS } = require('../utils/constants');

const createClientRules = [
  body('clientType')
    .notEmpty()
    .withMessage('Client type is required')
    .isIn(Object.values(CLIENT_TYPES))
    .withMessage(`Client type must be one of: ${Object.values(CLIENT_TYPES).join(', ')}`),
  body('clientName')
    .trim()
    .notEmpty()
    .withMessage('Client name is required')
    .isLength({ max: 200 })
    .withMessage('Client name must be at most 200 characters'),
  body('businessName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Business name must be at most 200 characters'),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone must be at most 20 characters'),
  body('gstin')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/)
    .withMessage('Please provide a valid GSTIN'),
  body('pan')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage('Please provide a valid PAN'),
  body('openingBalance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Opening balance must be a non-negative number'),
  body('status')
    .optional()
    .isIn(Object.values(CLIENT_STATUS))
    .withMessage(`Status must be one of: ${Object.values(CLIENT_STATUS).join(', ')}`),
  body('billingAddress.stateCode')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 2 })
    .withMessage('Billing state code must be 2 characters'),
  body('shippingAddress.stateCode')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 2 })
    .withMessage('Shipping state code must be 2 characters'),
];

const updateClientRules = [
  body('clientType')
    .optional()
    .isIn(Object.values(CLIENT_TYPES))
    .withMessage(`Client type must be one of: ${Object.values(CLIENT_TYPES).join(', ')}`),
  body('clientName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Client name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Client name must be at most 200 characters'),
  body('businessName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Business name must be at most 200 characters'),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone must be at most 20 characters'),
  body('gstin')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/)
    .withMessage('Please provide a valid GSTIN'),
  body('pan')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage('Please provide a valid PAN'),
  body('openingBalance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Opening balance must be a non-negative number'),
  body('status')
    .optional()
    .isIn(Object.values(CLIENT_STATUS))
    .withMessage(`Status must be one of: ${Object.values(CLIENT_STATUS).join(', ')}`),
];

module.exports = { createClientRules, updateClientRules };
