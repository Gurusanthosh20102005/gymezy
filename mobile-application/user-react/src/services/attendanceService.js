import { apiService } from './apiService';

class AttendanceService {
  /**
   * Fetch attendance history for the user
   * @param {Object} [params]
   * @param {string} [params.userId]
   * @param {string} [params.membershipId]
   * @param {string} [params.bookingId]
   * @param {string} [params.gymId]
   */
  async fetchAttendanceHistory(params = {}) {
    try {
      const queryParts = [];
      if (params.userId) queryParts.push(`userId=${encodeURIComponent(params.userId)}`);
      if (params.membershipId) queryParts.push(`membershipId=${encodeURIComponent(params.membershipId)}`);
      if (params.bookingId) queryParts.push(`bookingId=${encodeURIComponent(params.bookingId)}`);
      if (params.gymId) queryParts.push(`gymId=${encodeURIComponent(params.gymId)}`);

      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const response = await apiService.executeFetch(`/attendance/my-history${queryString}`, {
        method: 'GET',
        headers: apiService.getHeaders(),
      }, 8000);

      const json = await response.json();
      if (response.ok && json.success && json.data) {
        return json.data;
      }
      return { logs: [], summary: { total: 0, thisMonth: 0, completed: 0, activeNow: 0 } };
    } catch (error) {
      console.warn('[ATTENDANCE SERVICE] fetchAttendanceHistory error:', error.message);
      return { logs: [], summary: { total: 0, thisMonth: 0, completed: 0, activeNow: 0 } };
    }
  }
}

export const attendanceService = new AttendanceService();
export default attendanceService;
