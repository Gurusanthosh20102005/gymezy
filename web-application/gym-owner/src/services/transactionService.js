import { apiClient } from './apiClient';

/**
 * Gym Owner Transactions & Payments Service (SSOT)
 * Fetches transactions and collections metrics strictly for this gym alone.
 */
export const transactionService = {
  /**
   * Fetch paginated transactions and financial stats for a gym
   * @param {string} gymId - The target gym ID or 'me'
   * @param {Object} params - { page, limit, search, paymentMode, status }
   */
  getGymTransactions: async (gymId, params = {}) => {
    const target = gymId || 'me';
    const response = await apiClient.get(`/gyms/${target}/transactions`, { params });
    return response.data?.data || response.data;
  },
};

export default transactionService;
