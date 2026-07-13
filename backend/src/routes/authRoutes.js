const { Router } = require('express');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerRules, loginRules } = require('../validators/authValidator');
const authController = require('../controllers/authController');

const router = Router();

router.post('/register', validate(registerRules), authController.register);
router.post('/login', validate(loginRules), authController.login);
router.get('/me', protect, authController.getMe);

module.exports = router;
