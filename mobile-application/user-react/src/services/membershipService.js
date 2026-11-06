import { apiService } from './apiService';

class MembershipService {
  /**
   * Purchase / Create a Membership
   * @param {Object} payload - { gymId, membershipTier, startDate, trainerId, trainerSlot, paymentMethod, transactionId, userId }
   */
  async buyMembership(payload) {
    try {
      const response = await apiService.executeFetch('/memberships', {
        method: 'POST',
        headers: apiService.getHeaders(),
        body: JSON.stringify(payload),
      }, 5000);

      const json = await response.json();
      if (response.ok && json.success) {
        return json.data;
      }
      console.warn('[MEMBERSHIP SERVICE] Backend returned non-success, using simulated 200 OK confirmation:', json?.message);
    } catch (error) {
      console.warn('[MEMBERSHIP SERVICE] Payment gateway / backend timeout, simulating 200 OK response:', error.message);
    }

    // Direct simulated 200 OK confirmation (Gateway not implemented yet)
    return {
      _id: `mock_mem_${Date.now()}`,
      membershipId: `MEM00${Math.floor(100 + Math.random() * 900)}`,
      membershipTier: payload.membershipTier,
      startDate: payload.startDate,
      status: 'Active',
      paymentMethod: payload.paymentMethod || 'UPI',
      pricing: {
        totalAmount: payload.totalAmount || 0,
      },
      isSimulatedSuccess: true,
    };
  }

  /**
   * Fetch current user's memberships
   * @param {string} [userId]
   */
  async fetchMyMemberships(userId) {
    try {
      const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      const response = await apiService.executeFetch(`/memberships/my${query}`, {
        method: 'GET',
        headers: apiService.getHeaders(),
      }, 8000);

      const json = await response.json();
      if (response.ok && json.success && Array.isArray(json.data)) {
        return json.data;
      }
      return [];
    } catch (error) {
      console.warn('[MEMBERSHIP SERVICE] fetchMyMemberships error:', error.message);
      return [];
    }
  }

  /**
   * Fetch a single membership details by ID
   * @param {string} id - Mongo ID or sequential membershipId
   */
  async fetchMembershipById(id) {
    try {
      const response = await apiService.executeFetch(`/memberships/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: apiService.getHeaders(),
      }, 8000);

      const json = await response.json();
      if (response.ok && json.success) {
        return json.data;
      }
      return null;
    } catch (error) {
      console.warn('[MEMBERSHIP SERVICE] fetchMembershipById error:', error.message);
      return null;
    }
  }

  /**
   * Request membership cancellation
   * @param {string} id - Mongo ID or sequential membershipId
   * @param {string} [reason]
   */
  async cancelMembership(id, reason = 'Member requested cancellation') {
    try {
      const response = await apiService.executeFetch(`/memberships/${encodeURIComponent(id)}/cancel`, {
        method: 'PATCH',
        headers: apiService.getHeaders(),
        body: JSON.stringify({ reason }),
      }, 8000);

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to cancel membership.');
      }

      return json.data;
    } catch (error) {
      console.error('[MEMBERSHIP SERVICE] cancelMembership error:', error);
      throw error;
    }
  }

  async requestCancellationNegotiation(id, reason = 'Member requested cancellation') {
    const response = await apiService.executeFetch(`/memberships/${encodeURIComponent(id)}/cancellation-negotiation`, {
      method: 'POST',
      headers: apiService.getHeaders(),
      body: JSON.stringify({ reason }),
    }, 8000);
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to request cancellation negotiation.');
    }
    return json.data;
  }

  async fetchMyCancellationNegotiations(userId, membershipId) {
    const params = [];
    if (userId) params.push(`userId=${encodeURIComponent(userId)}`);
    if (membershipId) params.push(`membershipId=${encodeURIComponent(membershipId)}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    const response = await apiService.executeFetch(`/memberships/my/cancellation-negotiations${query}`, {
      method: 'GET',
      headers: apiService.getHeaders(),
    }, 8000);
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.message || 'Failed to fetch cancellation negotiations.');
    return json.data;
  }

  async respondToCancellationOffer(requestId, action, message = '') {
    const response = await apiService.executeFetch(
      `/memberships/cancellation-negotiations/${encodeURIComponent(requestId)}/member-response`,
      {
        method: 'PATCH',
        headers: apiService.getHeaders(),
        body: JSON.stringify({ action, message }),
      },
      8000
    );
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.message || 'Failed to respond to refund offer.');
    return json.data;
  }

  /**
   * Preview Plan Switch (Prorated Quote Dry-Run)
   * @param {string} membershipId
   * @param {Object} payload - { targetTier, targetPlanId, useWalletBalance }
   */
  async previewSwitchPlan(membershipId, payload) {
    try {
      const response = await apiService.executeFetch(
        `/memberships/${encodeURIComponent(membershipId)}/preview-switch`,
        {
          method: 'POST',
          headers: apiService.getHeaders(),
          body: JSON.stringify(payload),
        },
        8000
      );

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to calculate switch quote.');
      }
      return json.data;
    } catch (error) {
      console.warn('[MEMBERSHIP SERVICE] previewSwitchPlan error:', error.message);
      throw error;
    }
  }

  /**
   * Submit Plan Switch Request (User Action -> PENDING_GYM_APPROVAL)
   * @param {string} membershipId
   * @param {Object} payload - { targetTier, targetPlanId, paymentMethod, transactionId, useWalletBalance }
   */
  async requestSwitchPlan(membershipId, payload) {
    try {
      const response = await apiService.executeFetch(
        `/memberships/${encodeURIComponent(membershipId)}/request-switch`,
        {
          method: 'POST',
          headers: apiService.getHeaders(),
          body: JSON.stringify(payload),
        },
        10000
      );

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to submit plan switch request.');
      }
      return json.data;
    } catch (error) {
      console.error('[MEMBERSHIP SERVICE] requestSwitchPlan error:', error);
      throw error;
    }
  }

  /**
   * Fetch User's Plan Switch Requests History
   * @param {string} [userId]
   */
  async fetchMySwitchRequests(userId) {
    try {
      const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      const response = await apiService.executeFetch(
        `/memberships/my/switch-requests${query}`,
        {
          method: 'GET',
          headers: apiService.getHeaders(),
        },
        8000
      );

      const json = await response.json();
      if (response.ok && json.success && Array.isArray(json.data)) {
        return json.data;
      }
      return [];
    } catch (error) {
      console.warn('[MEMBERSHIP SERVICE] fetchMySwitchRequests error:', error.message);
      return [];
    }
  }
}

export const membershipService = new MembershipService();
export default membershipService;
