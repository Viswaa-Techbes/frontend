const { Router } = require('express');
const { protect } = require('../middleware/auth');
const paymentReceiptController = require('../controllers/paymentReceiptController');

const router = Router();

router.use(protect);

router.get('/', paymentReceiptController.getPaymentReceipts);
router.post('/', paymentReceiptController.createPaymentReceipt);
router.get('/next-number', paymentReceiptController.getNextReceiptNumber);
router.get('/unpaid-invoices', paymentReceiptController.getUnpaidInvoices);
router.get('/:id', paymentReceiptController.getPaymentReceiptById);
router.delete('/:id', paymentReceiptController.deletePaymentReceipt);
router.patch('/:id/status', paymentReceiptController.cancelPaymentReceipt);

module.exports = router;
