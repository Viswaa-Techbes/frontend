const asyncHandler = require('../middleware/asyncHandler');
const authService = require('../services/authService');

/** POST /api/auth/register */
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.register({ name, email, password });
  res.status(201).json({ success: true, data: result });
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  res.json({ success: true, data: result });
});

/** GET /api/auth/me */
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  res.json({ success: true, data: { user } });
});

module.exports = { register, login, getMe };
