import { apiClient } from './apiClient';

/**
 * Super Admin Customer & User Management Service (SSOT)
 */
export const customerService = {
  /**
   * Fetch paginated customers with server-side filters
   * @param {Object} params - { page, limit, search, status, role }
   */
  getCustomers: async (params = {}) => {
    const response = await apiClient.get('/admin/customers', { params });
    return response.data?.data || response.data;
  },

  /**
   * Fetch single customer full profile with recent bookings and memberships
   * @param {string} id - Customer ObjectId
   */
  getCustomerById: async (id) => {
    const response = await apiClient.get(`/admin/customers/${id}`);
    return response.data?.data || response.data;
  },

  /**
   * Create a new Customer account directly from Super Admin
   * @param {Object} payload - { fullName, email, phone, status, password }
   */
  createCustomer: async (payload) => {
    const response = await apiClient.post('/admin/customers', payload);
    return response.data?.data || response.data;
  },

  /**
   * Update customer profile details
   * @param {string} id - Customer ObjectId
   * @param {Object} payload - { fullName, email, phone, status, isActive }
   */
  updateCustomer: async (id, payload) => {
    const response = await apiClient.put(`/admin/customers/${id}`, payload);
    return response.data?.data || response.data;
  },

  /**
   * Toggle Customer active/inactive status
   * @param {string} id - Customer ObjectId
   */
  toggleCustomerStatus: async (id) => {
    const response = await apiClient.patch(`/admin/customers/${id}/status`);
    return response.data?.data || response.data;
  },
};

export default customerService;
