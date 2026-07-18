const { Router } = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth');
const importController = require('../controllers/importController');

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(protect);

router.post('/upload', upload.single('file'), importController.uploadAndPreview);
router.post('/validate', importController.validateImport);
router.post('/confirm', importController.confirmImport);
router.get('/history', importController.getHistory);
router.get('/template/:type', importController.downloadTemplate);

module.exports = router;
