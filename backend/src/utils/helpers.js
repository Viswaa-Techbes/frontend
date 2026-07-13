/**
 * Shared helpers used across the backend.
 */

/**
 * Build a Mongoose-compatible pagination helper.
 * @param {object} query  - { page, limit } from request query
 * @returns {{ page: number, limit: number, skip: number }}
 */
const parsePagination = (query) => {
  const { PAGINATION } = require('./constants');
  let page = parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE;
  let limit = parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT;

  if (page < 1) page = 1;
  if (limit < 1) limit = PAGINATION.DEFAULT_LIMIT;
  if (limit > PAGINATION.MAX_LIMIT) limit = PAGINATION.MAX_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
};

/**
 * Build standard pagination metadata for API responses.
 */
const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

/**
 * Pad a number with leading zeros to `width`.
 * padNumber(1, 5) → "00001"
 */
const padNumber = (num, width = 5) => String(num).padStart(width, '0');

/**
 * Normalise a string for case-insensitive comparison.
 */
const normalise = (str) => (str || '').trim().toUpperCase();

module.exports = {
  parsePagination,
  paginationMeta,
  padNumber,
  normalise,
};
