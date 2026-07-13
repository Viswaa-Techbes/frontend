const BusinessProfile = require('../models/BusinessProfile');
const ApiError = require('../utils/ApiError');

/**
 * Get the business profile for the authenticated user.
 * Returns null if no profile exists yet.
 */
const getByUserId = async (userId) => {
  return BusinessProfile.findOne({ userId });
};

/**
 * Create or update the business profile for the authenticated user.
 * Uses upsert so the first call creates, subsequent calls update.
 */
const upsert = async (userId, data) => {
  const profile = await BusinessProfile.findOneAndUpdate(
    { userId },
    { ...data, userId },
    { new: true, upsert: true, runValidators: true }
  );
  return profile;
};

/**
 * Get the business profile by its _id.
 * Used when we need to read the profile for document creation.
 */
const getById = async (id) => {
  const profile = await BusinessProfile.findById(id);
  if (!profile) {
    throw ApiError.notFound('Business profile not found');
  }
  return profile;
};

module.exports = { getByUserId, upsert, getById };
