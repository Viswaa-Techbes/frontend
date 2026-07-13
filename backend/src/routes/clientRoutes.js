const { Router } = require('express');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createClientRules, updateClientRules } = require('../validators/clientValidator');
const clientController = require('../controllers/clientController');

const router = Router();

router.use(protect);

router.get('/', clientController.listClients);
router.post('/', validate(createClientRules), clientController.createClient);
router.get('/:id', clientController.getClient);
router.get('/:id/summary', clientController.getClientSummary);
router.put('/:id', validate(updateClientRules), clientController.updateClient);
router.delete('/:id', clientController.deleteClient);

module.exports = router;
