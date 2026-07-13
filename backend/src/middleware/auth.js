const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const env = require('../config/env');

/**
 * Protect routes — verifies Bearer JWT and attaches `req.user`.
 */
const protect = async (req, _res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return next(ApiError.unauthorized('Not authorized — no token'));
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(ApiError.unauthorized('User no longer exists'));
    }
    req.user = user;
    next();
  } catch (err) {
    return next(err); // JsonWebTokenError / TokenExpiredError handled by errorHandler
  }
};

module.exports = { protect };
