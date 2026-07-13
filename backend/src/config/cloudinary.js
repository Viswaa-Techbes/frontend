/**
 * Cloudinary SDK configuration.
 * Prepared for Phase 1B+; not actively used in Phase 1A.
 */
const cloudinary = require('cloudinary').v2;
const env = require('./env');

if (env.cloudinary.cloudName) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
}

module.exports = cloudinary;
