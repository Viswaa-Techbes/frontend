const { body } = require('express-validator');

const getBase64Size = (base64String) => {
  if (!base64String || typeof base64String !== 'string') return 0;
  const base64Data = base64String.split(',')[1] || base64String;
  const padding = (base64Data.endsWith('==') ? 2 : (base64Data.endsWith('=') ? 1 : 0));
  return (base64Data.length * 3) / 4 - padding;
};

const businessRules = [
  body('businessName')
    .trim()
    .notEmpty()
    .withMessage('Business name is required')
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
  body('address.stateCode')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 2 })
    .withMessage('State code must be 2 characters'),
  body('logoUrl')
    .optional({ values: 'falsy' })
    .custom((value) => {
      if (value && value.startsWith('data:')) {
        const size = getBase64Size(value);
        if (size > 2 * 1024 * 1024) {
          throw new Error('Business logo must be at most 2 MB');
        }
      }
      return true;
    }),
  body('signatureUrl')
    .optional({ values: 'falsy' })
    .custom((value) => {
      if (value && value.startsWith('data:')) {
        const size = getBase64Size(value);
        if (size > 1 * 1024 * 1024) {
          throw new Error('Signature image must be at most 1 MB');
        }
      }
      return true;
    }),
  body('qrCodeUrl')
    .optional({ values: 'falsy' })
    .custom((value) => {
      if (value && value.startsWith('data:')) {
        const size = getBase64Size(value);
        if (size > 1 * 1024 * 1024) {
          throw new Error('QR Code image must be at most 1 MB');
        }
      }
      return true;
    }),
  body('accountName')
    .optional({ values: 'falsy' })
    .trim(),
  body('defaultTerms')
    .optional({ values: 'falsy' })
    .trim(),
  body('defaultNotes')
    .optional({ values: 'falsy' })
    .trim(),
  body('defaultFooter')
    .optional({ values: 'falsy' })
    .trim(),
];

module.exports = { businessRules };

