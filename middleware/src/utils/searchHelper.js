/**
 * searchHelper.js
 * Single Source of Truth (SSOT) helper for search and pagination across all middleware controllers.
 */

/**
 * Escapes characters that have special meaning in regular expressions
 * to prevent RegExp crashes and ReDoS injection attacks.
 * @param {string} str - User-supplied search string
 * @returns {string} - Escaped string safe for new RegExp()
 */
export const escapeRegex = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Extracts and sanitizes search query from request query parameters.
 * Canonical parameter is `search`, with fallback support for `q`.
 * @param {object} reqQuery - req.query object
 * @returns {string} - Trimmed search term
 */
export const getSearchTerm = (reqQuery) => {
  if (!reqQuery || typeof reqQuery !== 'object') return '';
  const term = reqQuery.search ?? reqQuery.q ?? '';
  return typeof term === 'string' ? term.trim() : '';
};

/**
 * Builds a MongoDB $or query across the given fields with a case-insensitive regex.
 * Returns null if the search term is empty.
 * @param {string} searchTerm - Search string
 * @param {string[]} fields - Array of document field paths to search across
 * @returns {object|null} - MongoDB query condition or null
 */
export const buildRegexSearchQuery = (searchTerm, fields = []) => {
  if (!searchTerm || typeof searchTerm !== 'string' || !searchTerm.trim()) {
    return null;
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    return null;
  }

  const escaped = escapeRegex(searchTerm.trim());
  const regex = new RegExp(escaped, 'i');

  return {
    $or: fields.map((field) => ({ [field]: regex })),
  };
};

/**
 * Standardizes pagination parameters from request query.
 * @param {object} reqQuery - req.query object
 * @param {number} defaultLimit - Fallback page size
 * @param {number} maxLimit - Upper bound cap for limit
 * @returns {{ page: number, limit: number, skip: number, isFetchAll: boolean }}
 */
export const parsePagination = (reqQuery = {}, defaultLimit = 20, maxLimit = 100) => {
  const rawPage = reqQuery.page;
  const rawLimit = reqQuery.limit ?? reqQuery.pageSize;

  const isFetchAll = rawLimit === 'all' || rawLimit === '0' || rawLimit === 0;

  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const limit = isFetchAll ? 0 : Math.min(maxLimit, Math.max(1, parseInt(rawLimit, 10) || defaultLimit));
  const skip = limit > 0 ? (page - 1) * limit : 0;

  return { page, limit, skip, isFetchAll };
};

export default {
  escapeRegex,
  getSearchTerm,
  buildRegexSearchQuery,
  parsePagination,
};

