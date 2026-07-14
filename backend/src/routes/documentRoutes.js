const { Router } = require('express');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createDocumentRules } = require('../validators/documentValidator');
const documentController = require('../controllers/documentController');

const router = Router();

router.use(protect);

router.post('/', validate(createDocumentRules), documentController.createDocument);
router.get('/', documentController.getDocuments);
router.post('/preview', documentController.previewCalculations);
router.get('/eligible-invoices', documentController.getEligibleInvoices);
router.get('/next-number', documentController.getNextNumber);

// New specific routes (put specific routes BEFORE parameter routes or structure cleanly)
router.post('/:id/settle-credit', documentController.settleCredit);
router.post('/:id/duplicate', documentController.duplicateDocument);
router.post('/:id/convert', documentController.convertDocument);
router.post('/:id/payments', documentController.recordPayment);
router.put('/:id/settings', documentController.updateDocumentSettings);
router.get('/:id/audit-trail', documentController.getAuditTrail);
router.get('/:id/acceptance-history', documentController.getAcceptanceHistory);
router.get('/:id/linked-documents', documentController.getLinkedDocuments);
router.post('/:id/pdf', documentController.generatePdf);
router.post('/:id/e-invoice', documentController.generateEInvoice);
router.post('/:id/e-way-bill', documentController.generateEWayBill);

router.get('/:id', documentController.getDocumentById);
router.put('/:id', validate(createDocumentRules), documentController.updateDocument);
router.patch('/:id/status', documentController.updateDocumentStatus);

module.exports = router;
