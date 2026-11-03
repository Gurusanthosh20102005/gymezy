import { apiClient } from './apiClient';

/**
 * Super Admin Bookings & Group Classes Service (SSOT)
 */
export const bookingService = {
  /**
   * Fetch paginated bookings fleet with server-side filters
   * @param {Object} params - { page, limit, type, status, gymId, search }
   */
  getBookings: async (params = {}) => {
    const response = await apiClient.get('/admin/bookings', { params });
    return response.data?.data || response.data;
  },
};

export default bookingService;
