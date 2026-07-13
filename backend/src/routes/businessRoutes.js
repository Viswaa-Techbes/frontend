const { Router } = require('express');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { businessRules } = require('../validators/businessValidator');
const businessController = require('../controllers/businessController');

const router = Router();

router.use(protect);

router.get('/', businessController.getBusiness);
router.put('/', validate(businessRules), businessController.upsertBusiness);

module.exports = router;
