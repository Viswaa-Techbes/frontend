const asyncHandler = require('../middleware/asyncHandler');
const businessService = require('../services/businessService');

/** GET /api/business */
const getBusiness = asyncHandler(async (req, res) => {
  const profile = await businessService.getByUserId(req.user._id);
  res.json({ success: true, data: { business: profile } });
});

/** PUT /api/business */
const upsertBusiness = asyncHandler(async (req, res) => {
  const profile = await businessService.upsert(req.user._id, req.body);
  res.json({ success: true, data: { business: profile } });
});

module.exports = { getBusiness, upsertBusiness };
