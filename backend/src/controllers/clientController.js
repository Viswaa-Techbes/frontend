const asyncHandler = require('../middleware/asyncHandler');
const clientService = require('../services/clientService');
const businessService = require('../services/businessService');
const ApiError = require('../utils/ApiError');

/**
 * Helper: resolve the user's businessId.
 * In Phase 1 every user has exactly one business profile.
 */
const getBusinessId = async (userId) => {
  const profile = await businessService.getByUserId(userId);
  if (!profile) {
    throw ApiError.badRequest(
      'Please set up your business profile before managing clients'
    );
  }
  return profile._id;
};

/** GET /api/clients */
const listClients = asyncHandler(async (req, res) => {
  const businessId = await getBusinessId(req.user._id);
  const result = await clientService.list(businessId, req.query);
  res.json({ success: true, data: result });
});

/** GET /api/clients/:id */
const getClient = asyncHandler(async (req, res) => {
  const businessId = await getBusinessId(req.user._id);
  const client = await clientService.getById(req.params.id, businessId);
  res.json({ success: true, data: client });
});

/** POST /api/clients */
const createClient = asyncHandler(async (req, res) => {
  const businessId = await getBusinessId(req.user._id);
  const client = await clientService.create(businessId, req.user._id, req.body);
  res.status(201).json({ success: true, data: client });
});

/** PUT /api/clients/:id */
const updateClient = asyncHandler(async (req, res) => {
  const businessId = await getBusinessId(req.user._id);
  const client = await clientService.update(
    req.params.id,
    businessId,
    req.user._id,
    req.body
  );
  res.json({ success: true, data: client });
});

/** DELETE /api/clients/:id */
const deleteClient = asyncHandler(async (req, res) => {
  const businessId = await getBusinessId(req.user._id);
  await clientService.softDelete(req.params.id, businessId, req.user._id);
  res.json({ success: true, data: { message: 'Client deleted successfully' } });
});

/** POST /api/clients/bulk-delete */
const bulkDeleteClients = asyncHandler(async (req, res) => {
  const businessId = await getBusinessId(req.user._id);
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    throw ApiError.badRequest('Client IDs array is required');
  }
  const result = await clientService.bulkDelete(ids, businessId, req.user._id);
  res.json({ success: true, data: result });
});

/** GET /api/clients/:id/summary */
const getClientSummary = asyncHandler(async (req, res) => {
  const businessId = await getBusinessId(req.user._id);
  const summary = await clientService.getSummary(req.params.id, businessId);
  res.json({ success: true, data: summary });
});

module.exports = {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  bulkDeleteClients,
  getClientSummary,
};
