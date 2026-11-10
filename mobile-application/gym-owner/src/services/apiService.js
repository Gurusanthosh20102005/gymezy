import { NativeModules } from 'react-native';
import { getCloudApiUrl, ACTIVE_ENV, ENV_TARGETS } from '../config/envConfig';

const BACKEND_PORT = 5001;
const CURRENT_MAC_IP = '192.168.0.104';
const LOCAL_WIFI_IP = '192.168.0.104';

const getMetroHost = () => {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match?.[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
  } catch {
    // ignore
  }
  return null;
};


async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.toLowerCase().includes('aborted')) {
      throw new Error(
        `Server connection timed out (${Math.round(timeoutMs / 1000)}s) at ${url}.`
      );
    }
    if (
      error.message?.toLowerCase().includes('network request failed') ||
      error.message?.toLowerCase().includes('failed to fetch') ||
      error.message?.toLowerCase().includes('err_failed')
    ) {
      throw new Error(
        `Unable to reach backend server at ${url.split('/api/v1')[0]}. Ensure server is running on port ${BACKEND_PORT}.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

class ApiService {
  constructor() {
    this.baseUrl = `http://localhost:${BACKEND_PORT}/api/v1`;
    this.verifiedBase = null;
    this.token = null;
    this.unauthorizedHandler = null;
  }

  setUnauthorizedHandler(handler) {
    this.unauthorizedHandler = handler;
  }

  setBaseUrl(url) {
    this.baseUrl = url;
    this.verifiedBase = url;
  }

  getBaseUrl() {
    return this.verifiedBase || this.baseUrl;
  }

  setAuthToken(token) {
    this.token = token;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  async executeFetch(endpoint, options = {}, timeoutMs = 4000) {
    const metroHost = getMetroHost();
    const cloudUrl = getCloudApiUrl();

    // Priority candidates: In development mode (__DEV__ === true), prioritize localhost, Metro host, and LAN IP.
    // In production/release builds, connect directly to the targeted cloud API.
    // Priority candidates: In development mode (__DEV__ === true), prioritize working candidate, Metro host, and LAN IP.
    // Notice: Over wireless debugging, LOCAL_WIFI_IP must precede loopbacks (localhost/127.0.0.1) which require USB adb reverse.
    const isDev = (typeof __DEV__ !== 'undefined' && __DEV__) || ACTIVE_ENV === ENV_TARGETS.DEV;
    const candidateBases = isDev
      ? [
          this.verifiedBase,
          `http://${LOCAL_WIFI_IP}:${BACKEND_PORT}/api/v1`,
          metroHost ? `http://${metroHost}:${BACKEND_PORT}/api/v1` : null,
          `http://${CURRENT_MAC_IP}:${BACKEND_PORT}/api/v1`,
          `http://localhost:${BACKEND_PORT}/api/v1`,
          `http://127.0.0.1:${BACKEND_PORT}/api/v1`,
          `http://10.0.2.2:${BACKEND_PORT}/api/v1`,
          cloudUrl,
        ]
      : [cloudUrl];

    // Filter unique candidates preserving order
    const uniqueBases = Array.from(new Set(candidateBases.filter(Boolean)));

    let lastError = null;
    for (let i = 0; i < uniqueBases.length; i++) {
      const currentBase = uniqueBases[i];
      const targetUrl = `${currentBase}${endpoint}`;
      try {
        const attemptTimeout = i === 0 && this.verifiedBase ? timeoutMs : 4000;
        const response = await fetchWithTimeout(targetUrl, options, attemptTimeout);

        // Safely extract response text to inspect before treating as valid JSON
        const rawText = await response.text();
        const trimmed = (rawText || '').trim();

        // Reject HTML error pages, captive portals, ISP redirection pages, or Cloudflare challenges
        const isHtml =
          trimmed.startsWith('<') ||
          trimmed.toLowerCase().includes('<!doctype') ||
          trimmed.toLowerCase().includes('<html') ||
          trimmed.toLowerCase().includes('<head');

        if (isHtml) {
          throw new Error(
            `Server at ${currentBase} returned HTML instead of JSON (${response.status} ${response.statusText}): ${trimmed.slice(0, 100)}`
          );
        }

        // Validate JSON payload
        let parsedData = null;
        if (trimmed) {
          try {
            parsedData = JSON.parse(rawText);
          } catch (jsonErr) {
            throw new Error(
              `Server at ${currentBase} returned invalid JSON format: ${jsonErr.message}. Content: ${trimmed.slice(0, 80)}`
            );
          }
        }

        // Cache the parsed JSON and raw text on response so existing callers of await response.json() succeed without re-reading stream
        response.json = async () => parsedData;
        response.text = async () => rawText;
        response._parsedData = parsedData;

        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          if (typeof this.unauthorizedHandler === 'function') {
            this.unauthorizedHandler();
          }
        }

        this.verifiedBase = currentBase; // Lock in the verified working base URL
        this.baseUrl = currentBase;
        return response;
      } catch (err) {
        if (this.verifiedBase === currentBase) {
          this.verifiedBase = null; // Clear invalidated base if it failed
        }
        lastError = err;
      }
    }

    throw new Error(
      lastError?.message ||
      `Unable to connect to backend server on port ${BACKEND_PORT}. If using a physical phone, please connect to the same Wi-Fi (${LOCAL_WIFI_IP}) or verify backend is running.`
    );
  }

  async login({ identifier, password }) {
    const cleanIdentifier = (identifier || '').trim();
    const cleanPassword = (password || '').trim();

    if (!cleanIdentifier || !cleanPassword) {
      throw new Error('Email or phone number and password are required.');
    }

    const response = await this.executeFetch('/auth/login', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        identifier: cleanIdentifier,
        password: cleanPassword,
        portal: 'gym-owner',
        expectedRole: 'GYM_OWNER',
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      const errorMessage =
        result.message ||
        (result.errors && result.errors[0]?.msg) ||
        'Authentication failed. Please verify your credentials.';
      throw new Error(errorMessage);
    }

    const data = result.data || {};
    if (data.token) {
      this.setAuthToken(data.token);
    }

    return {
      user: {
        id: data.id,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        role: data.role,
        gymId: data.gymId,
      },
      gym: data.gym || null,
      token: data.token || null,
      message: result.message,
    };
  }

  async logout() {
    try {
      await this.executeFetch('/auth/logout', {
        method: 'POST',
        headers: this.getHeaders(),
      }, 4000);
    } catch {
      // Ignore network errors during logout
    } finally {
      this.token = null;
    }
  }

  async getCurrentUser() {
    const response = await this.executeFetch('/auth/me', {
      method: 'GET',
      headers: this.getHeaders(),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to fetch current user session.');
    }
    return result.data;
  }

  async createWalkInMembership(gymId, payload) {
    if (!gymId) throw new Error('Gym ID is required.');
    const response = await this.executeFetch(`/memberships/gym/${gymId}/walk-in`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      const errMsg =
        Array.isArray(result.errors) && result.errors.length > 0
          ? result.errors.join(', ')
          : result.message || 'Failed to create walk-in membership.';
      throw new Error(errMsg);
    }
    return result.data;
  }


  async getGym(gymId) {
    if (!gymId) throw new Error('Gym ID is required to fetch gym profile.');
    const response = await this.executeFetch(`/gyms/${gymId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to fetch gym profile.');
    }
    return result.data;
  }

  async updateGym(gymId, payload) {
    if (!gymId) throw new Error('Gym ID is required to update details.');
    const response = await this.executeFetch(`/gyms/${gymId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update gym details.');
    }
    return {
      data: result.data,
      message: result.message || 'Gym changes submitted successfully. Pending Super Admin approval.',
    };
  }

  async resubmitGym(gymId, notes = '') {
    if (!gymId) throw new Error('Gym ID is required to resubmit application.');
    const response = await this.executeFetch(`/gyms/${gymId}/resubmit`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ notes }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to resubmit application.');
    }
    return result.data;
  }

  // Employee & Trainer Management Endpoints
  async getEmployees(params = {}) {
    const queryParts = [];
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
      }
    });
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

    const response = await this.executeFetch(`/employees${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to fetch employees list.');
    }
    return result.data;
  }

  async getEmployeeById(id) {
    if (!id) throw new Error('Employee ID is required.');
    const response = await this.executeFetch(`/employees/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to fetch employee details.');
    }
    return result.data;
  }

  async createEmployee(payload) {
    const response = await this.executeFetch('/employees', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to create employee.');
    }
    return {
      data: result.data,
      message: result.message || 'Employee created successfully.',
    };
  }

  async updateEmployee(id, payload) {
    if (!id) throw new Error('Employee ID is required to update details.');
    const response = await this.executeFetch(`/employees/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update employee.');
    }
    return {
      data: result.data,
      message: result.message || 'Employee updated successfully.',
    };
  }

  async deleteEmployee(id) {
    if (!id) throw new Error('Employee ID is required to deactivate.');
    const response = await this.executeFetch(`/employees/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to deactivate employee.');
    }
    return {
      data: result.data,
      message: result.message || 'Employee deactivated successfully.',
    };
  }

  async reviewEmployeeApproval(id, action, rejectionReason = '') {
    if (!id) throw new Error('Employee ID is required.');
    const decision = action === 'approve' || action === 'Approved' ? 'Approved' : 'Rejected';
    const payload = {
      decision,
      action,
      adminRemarks: rejectionReason,
      rejectionReason,
    };
    const response = await this.executeFetch(`/employees/${id}/approval`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || `Failed to ${action} employee.`);
    }
    return result;
  }

  // --- ATTENDANCE METHODS ---
  async checkInMember(payload) {
    const response = await this.executeFetch('/attendance/check-in', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Check-in failed. Please verify the code/OTP.');
    }
    return result.data;
  }

  async checkOutMember(payload) {
    const response = await this.executeFetch('/attendance/check-out', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Check-out failed.');
    }
    return result.data;
  }

  async getTodayAttendance(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/attendance/today?${query}` : '/attendance/today';
    const response = await this.executeFetch(endpoint, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to retrieve today's attendance logs.");
    }
    return result.data;
  }

  async searchAttendanceMembers(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/attendance/members?${query}` : '/attendance/members';
    const response = await this.executeFetch(endpoint, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to search members.');
    }
    return result.data;
  }

  async checkEmail(email) {
    const response = await this.executeFetch(`/auth/check-email?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return await response.json();
  }

  async checkPhone(phone) {
    const response = await this.executeFetch(`/auth/check-phone?phone=${encodeURIComponent(phone)}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return await response.json();
  }

  async registerGym(payload) {
    const response = await this.executeFetch('/gyms/register', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    }, 15000);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Gym registration failed.');
    }
    return result;
  }

  // --- MEMBERSHIP & SWITCH REQUEST METHODS ---
  async getMemberships(gymId, params = {}) {
    if (!gymId) throw new Error('Gym ID is required.');
    const queryParts = [];
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
      }
    });
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const response = await this.executeFetch(`/memberships/gym/${gymId}${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to fetch gym memberships.');
    }
    return result.data;
  }

  async getSwitchRequests(gymId) {
    if (!gymId) throw new Error('Gym ID is required.');
    const response = await this.executeFetch(`/memberships/gym/${gymId}/switch-requests`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to fetch switch requests.');
    }
    return result.data;
  }

  async respondToSwitchRequest(requestId, payload) {
    if (!requestId) throw new Error('Request ID is required.');
    const cleanPayload = {
      action: payload.action,
      remarks: payload.remarks || payload.rejectionReason || '',
    };
    const response = await this.executeFetch(`/memberships/switch-requests/${requestId}/gym-action`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(cleanPayload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update switch request.');
    }
    return result.data;
  }

  async getCancellationNegotiations(gymId) {
    if (!gymId) throw new Error('Gym ID is required.');
    const response = await this.executeFetch(`/memberships/gym/${gymId}/cancellation-negotiations`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to fetch cancellation requests.');
    }
    return result.data;
  }

  async quoteCancellationRefund(requestId, maximumRefundAmount, refundAmount, message = '') {
    const response = await this.executeFetch(`/memberships/cancellation-negotiations/${requestId}/gym-offer`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        deductionAmount: Math.max(0, Number(maximumRefundAmount) - Number(refundAmount)),
        message,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to send refund quote.');
    }
    return result.data;
  }

  async acceptCancellation(requestId, maximumRefundAmount, refundAmount, message = '') {
    const response = await this.executeFetch(`/memberships/cancellation-negotiations/${requestId}/gym-accept`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({
        deductionAmount: Math.max(0, Number(maximumRefundAmount) - Number(refundAmount)),
        message,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to accept cancellation.');
    }
    return result.data;
  }

  async rejectCancellation(requestId) {
    if (!requestId) throw new Error('Request ID is required.');
    const response = await this.executeFetch(`/memberships/cancellation-negotiations/${requestId}/gym-reject`, {
      method: 'PATCH',
      headers: this.getHeaders(),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to reject cancellation.');
    }
    return result.data;
  }

  async cancelMembership(membershipId, payload = {}) {
    if (!membershipId) throw new Error('Membership ID is required.');
    const response = await this.executeFetch(`/memberships/${membershipId}/cancel`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to cancel membership.');
    }
    return result.data;
  }

  async requestCancellation(membershipId, reason = 'Cancelled by gym owner') {
    if (!membershipId) throw new Error('Membership ID is required.');
    const response = await this.executeFetch(`/memberships/${membershipId}/cancellation-negotiation`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to request cancellation.');
    }
    return result.data;
  }

  async updateTrainerPricing(gymId, payload) {
    if (!gymId) throw new Error('Gym ID is required.');
    const response = await this.executeFetch(`/gyms/${gymId}/trainer-pricing`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update trainer pricing.');
    }
    return result.data;
  }

  // --- SECTIONS & PROGRAMS METHODS (Industry Standard) ---
  async getSections(params = {}) {
    const queryParts = [];
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
      }
    });
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const response = await this.executeFetch(`/sections${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to fetch sections.');
    }
    if (result.meta && Array.isArray(result.data)) {
      result.data.pagination = result.meta;
      result.data.total = result.meta.total;
      result.data.totalPages = result.meta.totalPages;
    }
    return result.data;
  }

  async getAvailableTrainers(params = {}) {
    const queryParts = [];
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        if (Array.isArray(val)) {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val.join(','))}`);
        } else {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
        }
      }
    });
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const response = await this.executeFetch(`/sections/available-trainers${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to evaluate trainer availability.');
    }
    return result.data || { availableTrainers: [], allTrainers: [] };
  }

  async createSection(payload) {
    const response = await this.executeFetch('/sections', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to create section.');
    }
    return result.data;
  }

  async updateSection(sectionId, payload) {
    if (!sectionId) throw new Error('Section ID is required.');
    const response = await this.executeFetch(`/sections/${sectionId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update section.');
    }
    return result.data;
  }

  async toggleSectionStatus(sectionId, isActive) {
    if (!sectionId) throw new Error('Section ID is required.');
    const response = await this.executeFetch(`/sections/${sectionId}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ isActive }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update section status.');
    }
    return result.data;
  }

  async deleteSection(sectionId) {
    if (!sectionId) throw new Error('Section ID is required.');
    const response = await this.executeFetch(`/sections/${sectionId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to delete section.');
    }
    return result.data;
  }

  async getSectionEnrollments(sectionId) {
    if (!sectionId) throw new Error('Section ID is required.');
    const response = await this.executeFetch(`/bookings/section/${sectionId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to fetch section enrollments.');
    }
    return result.data;
  }

  // --- WALK-IN & BOOKINGS MANAGEMENT METHODS (Industry Standard) ---
  async getGymBookings(gymId, params = {}) {
    if (!gymId) throw new Error('Gym ID is required.');
    const queryParts = [];
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
      }
    });
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

    const response = await this.executeFetch(`/bookings/gym/${gymId}${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to fetch gym bookings.');
    }
    if (result.meta && Array.isArray(result.data)) {
      result.data.pagination = result.meta;
      result.data.total = result.meta.total;
      result.data.totalPages = result.meta.totalPages;
    }
    return result.data;
  }

  async createWalkInBooking(gymId, payload) {
    if (!gymId) throw new Error('Gym ID is required.');
    const response = await this.executeFetch(`/bookings/gym/${gymId}/walk-in`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      const errMsg =
        Array.isArray(result.errors) && result.errors.length > 0
          ? result.errors.join(', ')
          : result.message || 'Failed to create walk-in booking.';
      throw new Error(errMsg);
    }
    return result.data;
  }
  async reviewBookingCancellation(bookingId, payload) {
    if (!bookingId) throw new Error('Booking ID is required.');
    const response = await this.executeFetch(`/bookings/${bookingId}/cancellation-review`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to review cancellation request.');
    }
    return result.data;
  }

  async cancelBooking(bookingId, payload = {}) {
    if (!bookingId) throw new Error('Booking ID is required.');
    const response = await this.executeFetch(`/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to cancel booking.');
    }
    return result.data;
  }

}

export const apiService = new ApiService();
export default apiService;
