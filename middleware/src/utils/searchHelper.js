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

/**
 * Resolves standard dashboard date range boundaries.
 * Supports: 'Today', 'Yesterday', 'This Week', 'This Month', 'All Time',
 * or custom ranges via startDate & endDate or "DD MMM YYYY - DD MMM YYYY" string.
 * @param {object} reqQuery - { range, startDate, endDate }
 * @param {Date} [referenceDate=new Date()] - Reference anchor date for testing/reproducibility
 * @returns {{ start: Date, end: Date, label: string } | null} - Date bounds or null if all-time
 */
export const parseDateRangeFilter = (reqQuery = {}, referenceDate = new Date()) => {
  if (!reqQuery || typeof reqQuery !== 'object') return null;
  const range = reqQuery.range || reqQuery.filterType;
  const { startDate, endDate } = reqQuery;

  // 1. Explicit ISO/Date strings for custom range
  if (startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e, label: 'Custom Range' };
    }
  }

  if (!range) return null;

  const r = String(range).trim().toLowerCase();

  // Explicit All Time / Unrestricted
  if (r === 'all' || r === 'all_time' || r === 'all time') {
    return null;
  }

  const now = new Date(referenceDate);

  // Today
  if (r === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: 'Today' };
  }

  // Yesterday
  if (r === 'yesterday') {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: 'Yesterday' };
  }

  // This Week (from Monday)
  if (r === 'this week' || r === 'this_week' || r === 'week') {
    const start = new Date(now);
    const day = start.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: 'This Week' };
  }

  // This Month (from 1st of current month)
  if (r === 'this month' || r === 'this_month' || r === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end, label: 'This Month' };
  }

  // Handle custom range string e.g. "01 Nov 2026 - 06 Nov 2026"
  if (range.includes('-') && !range.startsWith('-')) {
    const parts = range.split('-').map((s) => s.trim());
    if (parts.length === 2) {
      const s = new Date(parts[0]);
      const e = new Date(parts[1]);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        s.setHours(0, 0, 0, 0);
        e.setHours(23, 59, 59, 999);
        return { start: s, end: e, label: `${parts[0]} - ${parts[1]}` };
      }
    }
  }

  return null;
};

export {
  damerauLevenshteinDistance,
  tokenizeAndNormalize,
  isFuzzyMatch,
  scoreGymRelevance,
  scoreBannerRelevance,
  scoreBookingRelevance,
  scoreTransactionRelevance,
  scoreReportCustomerRelevance,
  getDidYouMeanSuggestion,
} from './fuzzySearchEngine.js';

export default {
  escapeRegex,
  getSearchTerm,
  buildRegexSearchQuery,
  parsePagination,
  parseDateRangeFilter,
};

