import { apiClient } from './apiClient';

/**
 * Super Admin Transactions & Payments Service (SSOT)
 */
export const transactionService = {
  /**
   * Fetch paginated transactions fleet with server-side filters
   * @param {Object} params - { page, limit, search, paymentMode, status }
   */
  getTransactions: async (params = {}) => {
    const response = await apiClient.get('/admin/transactions', { params });
    return response.data?.data || response.data;
  },
};

export default transactionService;

