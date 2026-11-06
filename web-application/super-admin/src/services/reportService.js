import { apiClient } from './apiClient';

/**
 * Super Admin Reports & Analytics Service (SSOT)
 */
export const reportService = {
  /**
   * Fetch customer reports with server-side database aggregations
   * @param {Object} params - { page, limit, search, status, customerType, bookingType, startDate, endDate }
   */
  getCustomerReports: async (params = {}) => {
    const response = await apiClient.get('/admin/reports/customers', { params });
    return response.data?.data || response.data;
  },
};

export default reportService;

