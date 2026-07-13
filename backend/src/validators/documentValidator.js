const { body } = require('express-validator');

const getBase64Size = (base64String) => {
  if (!base64String || typeof base64String !== 'string') return 0;
  const base64Data = base64String.split(',')[1] || base64String;
  const padding = (base64Data.endsWith('==') ? 2 : (base64Data.endsWith('=') ? 1 : 0));
  return (base64Data.length * 3) / 4 - padding;
};

const createDocumentRules = [
  body('clientId')
    .notEmpty()
    .withMessage('Client ID is required')
    .isMongoId()
    .withMessage('Invalid Client ID format'),
  body('documentType')
    .notEmpty()
    .withMessage('Document Type is required')
    .isIn(['QUOTATION', 'PROFORMA_INVOICE', 'INVOICE', 'SALES_ORDER', 'DELIVERY_CHALLAN', 'CREDIT_NOTE'])
    .withMessage('Supported document types are QUOTATION, PROFORMA_INVOICE, INVOICE, SALES_ORDER, DELIVERY_CHALLAN, and CREDIT_NOTE.'),
  body('issueDate')
    .notEmpty()
    .withMessage('Issue Date is required')
    .isISO8601()
    .withMessage('Issue date must be a valid ISO8601 date'),
  body('placeOfSupply')
    .notEmpty()
    .withMessage('Place of Supply is required'),
  body('placeOfSupply.state')
    .notEmpty()
    .withMessage('Place of supply state name is required'),
  body('placeOfSupply.stateCode')
    .notEmpty()
    .withMessage('Place of supply state code is required')
    .isLength({ min: 2, max: 2 })
    .withMessage('Place of supply state code must be exactly 2 characters'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one line item is required'),
  body('items.*.itemName')
    .trim()
    .notEmpty()
    .withMessage('Item Name is required'),
  body('items.*.quantity')
    .isFloat({ min: 0.0001 })
    .withMessage('Quantity must be greater than 0'),
  body('items.*.rate')
    .isFloat({ min: 0 })
    .withMessage('Rate must be a non-negative number'),
  body('items.*.gstRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('GST rate must be a non-negative number'),
  body('items.*.image')
    .optional({ values: 'falsy' })
    .custom((value) => {
      if (value && value.startsWith('data:')) {
        const size = getBase64Size(value);
        if (size > 2 * 1024 * 1024) {
          throw new Error('Line item image must be at most 2 MB');
        }
      }
      return true;
    }),
  body('signature.signatureUrl')
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
  body('attachments')
    .optional()
    .isArray({ max: 3 })
    .withMessage('At most 3 attachments are allowed per document')
    .custom((attachments) => {
      let totalAttachmentsSize = 0;
      for (const att of attachments) {
        if (att.fileUrl && att.fileUrl.startsWith('data:')) {
          const size = getBase64Size(att.fileUrl);
          if (size > 3 * 1024 * 1024) {
            throw new Error(`Attachment ${att.fileName || 'file'} size exceeds the 3 MB limit`);
          }
          totalAttachmentsSize += size;
        }
      }
      return true;
    }),
  // Enforce total Base64 payload security check (protect from MongoDB BSON 16MB threshold)
  body()
    .custom((payload) => {
      let totalEncodedSize = 0;
      if (payload.signature && payload.signature.signatureUrl) {
        totalEncodedSize += getBase64Size(payload.signature.signatureUrl);
      }
      if (payload.items && Array.isArray(payload.items)) {
        for (const item of payload.items) {
          if (item.image) {
            totalEncodedSize += getBase64Size(item.image);
          }
        }
      }
      if (payload.attachments && Array.isArray(payload.attachments)) {
        for (const att of payload.attachments) {
          if (att.fileUrl) {
            totalEncodedSize += getBase64Size(att.fileUrl);
          }
        }
      }
      // Set conservative threshold at 8 MB total payload
      if (totalEncodedSize > 8 * 1024 * 1024) {
        throw new Error('Total base64 payload size of all signatures, item images, and attachments must not exceed 8 MB');
      }
      return true;
    })
];

module.exports = {
  createDocumentRules,
};

