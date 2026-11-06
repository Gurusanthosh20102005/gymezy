import { apiClient } from './apiClient';

/**
 * gymService
 * Single Source of Truth (SSOT) service for gym fetching, dropdown options, and fleet management across Super Admin.
 */
export const gymService = {
  /**
   * Fetch lightweight gym options for dropdowns, selectors, and filters.
   * Supports pagination, relaxed regex search (e.g. 'supermax' matches 'Super Max Gym'),
   * and limit=0 / 'all' for complete fleet options without truncation.
   * @param {Object} [params={}] - { page, limit, search, status }
   * @returns {Promise<{ gyms: Array, page: number, limit: number, total: number, hasMore: boolean }>}
   */
  getGymOptions: async (params = {}) => {
    const res = await apiClient.get('/gyms/options', { params });
    return res.data?.data || { gyms: [], page: 1, limit: 0, total: 0, hasMore: false };
  },

  /**
   * Fetch full admin fleet with metrics, approvals, and pagination.
   * @param {Object} [params={}] - { page, limit, search, status, approvalStatus, ... }
   * @returns {Promise<any>}
   */
  getGymFleet: async (params = {}) => {
    const res = await apiClient.get('/gyms/admin/fleet', { params });
    return res.data;
  },

  /**
   * Fetch single gym details by ID.
   * @param {string} gymId
   * @returns {Promise<any>}
   */
  getGymById: async (gymId) => {
    const res = await apiClient.get(`/gyms/${gymId}`);
    return res.data;
  },

  /**
   * Update gym details.
   * @param {string} gymId
   * @param {Object} data
   * @returns {Promise<any>}
   */
  updateGym: async (gymId, data) => {
    const res = await apiClient.put(`/gyms/${gymId}`, data);
    return res.data;
  },

  /**
   * Update gym approval / active status.
   * @param {string} gymId
   * @param {Object} data
   * @returns {Promise<any>}
   */
  updateGymStatus: async (gymId, data) => {
    const res = await apiClient.patch(`/gyms/${gymId}/status`, data);
    return res.data;
  },
};

export default gymService;

