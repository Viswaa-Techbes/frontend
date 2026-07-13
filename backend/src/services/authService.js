const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/**
 * Register a new user, return JWT + user data.
 */
const register = async ({ name, email, password }) => {
  // Check duplicate
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict('Email already registered');
  }

  const user = await User.create({ name, email, password });
  const token = user.generateToken();

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  };
};

/**
 * Authenticate user with email + password, return JWT + user data.
 */
const login = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = user.generateToken();

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  };
};

/**
 * Return the authenticated user's profile.
 */
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return {
    id: user._id,
    name: user.name,
    email: user.email,
  };
};

module.exports = { register, login, getMe };
