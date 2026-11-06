import { NativeModules } from 'react-native';
import { getCloudApiUrl } from '../config/envConfig';

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
    // Ignore error
  }
  return null;
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (
      error.name === 'AbortError' ||
      error.message?.toLowerCase().includes('aborted') ||
      error.message?.toLowerCase().includes('canceled') ||
      error.message?.toLowerCase().includes('cancelled')
    ) {
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
        `Unable to reach GYMEZY backend at ${url.split('/api/v1')[0]}. Ensure server is running on port ${BACKEND_PORT}.`
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

  getAuthToken() {
    return this.token;
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

  async executeFetch(endpoint, options = {}, timeoutMs = 15000) {
    const metroHost = getMetroHost();
    const cloudUrl = getCloudApiUrl();

    // Priority candidates: In development mode (__DEV__ === true), prioritize localhost, Metro host, and LAN IP.
    // In production/release builds, connect directly to the targeted cloud API.
    // Priority candidates: In development mode (__DEV__ === true), prioritize working candidate, Metro host, and LAN IP.
    // Notice: Over wireless debugging, LOCAL_WIFI_IP must precede loopbacks (localhost/127.0.0.1) which require USB adb reverse.
    const candidateBases = __DEV__
      ? [
          this.verifiedBase,
          metroHost ? `http://${metroHost}:${BACKEND_PORT}/api/v1` : null,
          `http://${LOCAL_WIFI_IP}:${BACKEND_PORT}/api/v1`,
          `http://${CURRENT_MAC_IP}:${BACKEND_PORT}/api/v1`,
          `http://localhost:${BACKEND_PORT}/api/v1`,
          `http://127.0.0.1:${BACKEND_PORT}/api/v1`,
          `http://10.0.2.2:${BACKEND_PORT}/api/v1`,
          cloudUrl,
        ]
      : [cloudUrl];

    const uniqueBases = Array.from(new Set(candidateBases.filter(Boolean)));
    let lastError = null;

    for (let i = 0; i < uniqueBases.length; i++) {
      const currentBase = uniqueBases[i];
      const targetUrl = `${currentBase}${endpoint}`;
      try {
        const attemptTimeout = this.verifiedBase === currentBase ? timeoutMs : 5000;
        const response = await fetchWithTimeout(
          targetUrl,
          options,
          attemptTimeout
        );

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

        // Handle 401 Unauthorized globally
        if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
          console.warn('[API SERVICE] 401 Unauthorized received at', endpoint);
          if (typeof this.unauthorizedHandler === 'function') {
            this.unauthorizedHandler('Session expired. Please log in again.');
          }
        }

        this.verifiedBase = currentBase;
        this.baseUrl = currentBase;
        return response;
      } catch (err) {
        if (this.verifiedBase === currentBase) {
          this.verifiedBase = null;
        }
        lastError = err;
        console.warn(`[API SERVICE] Failed ${targetUrl}:`, err.message);
      }
    }

    throw new Error(
      lastError?.message || `Unable to connect to GYMEZY backend on port ${BACKEND_PORT}. Check Wi-Fi or adb reverse port forwarding.`
    );
  }

  /**
   * User / Customer Login
   */
  async login({ identifier, password }) {
    const cleanIdentifier = (identifier || '').trim();
    const cleanPassword = password || '';

    if (!cleanIdentifier || !cleanPassword) {
      throw new Error('Please provide both email/phone and password.');
    }

    const response = await this.executeFetch('/auth/login', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        identifier: cleanIdentifier,
        password: cleanPassword,
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Login failed. Please verify your credentials.');
    }

    const payload = json.data || {};
    const authToken = payload.token || null;
    if (authToken) {
      this.setAuthToken(authToken);
    }

    return {
      user: payload,
      token: authToken,
      message: json.message || 'Login successful',
    };
  }

  /**
   * Customer Self Registration
   */
  async register({ fullName, email, phone, password, gender, fitnessGoal }) {
    const response = await this.executeFetch('/auth/register', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        fullName: (fullName || '').trim(),
        email: (email || '').trim().toLowerCase(),
        phone: (phone || '').trim(),
        password,
        gender: gender || 'PREFER_NOT_TO_SAY',
        fitnessGoal: fitnessGoal || 'GENERAL_FITNESS',
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Registration failed.');
    }

    const payload = json.data || {};
    const authToken = payload.token || null;
    if (authToken) {
      this.setAuthToken(authToken);
    }

    return {
      user: payload,
      token: authToken,
      message: json.message || 'Account created successfully',
    };
  }

  /**
   * Fetch Authenticated User Profile
   */
  async getCurrentUser() {
    const response = await this.executeFetch('/auth/me', {
      method: 'GET',
      headers: this.getHeaders(),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to fetch user profile.');
    }

    return json.data;
  }

  async getMe() {
    return this.getCurrentUser();
  }

  /**
   * Update Member Profile (Avatar, Full Name, Phone, etc.)
   */
  async updateProfile(profileData) {
    const response = await this.executeFetch('/auth/profile', {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(profileData),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to update profile.');
    }

    return json.data;
  }

  /**
   * Log Out User
   */
  async logout() {
    try {
      await this.executeFetch('/auth/logout', {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch {
      // Clear token regardless of server response
    } finally {
      this.setAuthToken(null);
    }
  }

  /**
   * Check Email Availability
   */
  async checkEmail(email) {
    const response = await this.executeFetch(`/auth/check-email?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const json = await response.json();
    return json.data;
  }

  /**
   * Fetch Single Gym Details by ID or Partner ID
   */
  async getGymDetails(gymId) {
    const response = await this.executeFetch(`/gyms/${gymId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to fetch gym details.');
    }
    return json.data;
  }

  /**
   * Fetch Reviews for a specific Gym
   */
  async getGymReviews(gymId) {
    const response = await this.executeFetch(`/gyms/${gymId}/reviews`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to fetch gym reviews.');
    }
    return json.data;
  }

  /**
   * Fetch Active Approved Trainers for a specific Gym
   */
  async getGymTrainers(gymId) {
    try {
      const response = await this.executeFetch(`/gyms/${gymId}/trainers`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const json = await response.json();
      if (response.ok && json.success && Array.isArray(json.data)) {
        return json.data;
      }
      return [];
    } catch (error) {
      console.warn('[API SERVICE] getGymTrainers error:', error?.message);
      return [];
    }
  }

  /**
   * Fetch Reviews for a specific Trainer
   */
  async getTrainerReviews(gymId, trainerIdentifier) {
    const encoded = encodeURIComponent(trainerIdentifier);
    const response = await this.executeFetch(`/gyms/${gymId}/trainers/${encoded}/reviews`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to fetch trainer reviews.');
    }
    return json.data;
  }

  /**
   * Submit a Member Review for a Gym
   */
  async submitGymReview(gymId, reviewData) {
    const response = await this.executeFetch(`/gyms/${gymId}/reviews`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(reviewData),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to submit gym review.');
    }
    return json.data;
  }

  /**
   * Submit a Member Review for a Trainer
   */
  async submitTrainerReview(gymId, trainerIdentifier, reviewData) {
    const encoded = encodeURIComponent(trainerIdentifier);
    const response = await this.executeFetch(`/gyms/${gymId}/trainers/${encoded}/reviews`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(reviewData),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to submit trainer review.');
    }
    return json.data;
  }
  /**
   * Fetch Ratings & Reviews for a specific Gym
   */
  async getGymRatings(gymId) {
    const response = await this.executeFetch(`/gyms/${gymId}/ratings`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to fetch gym ratings.');
    }
    return json.data;
  }

  /**
   * Fetch Ratings for a specific Trainer
   */
  async getTrainerRatings(gymId, trainerIdentifier) {
    const encoded = encodeURIComponent(trainerIdentifier);
    const response = await this.executeFetch(`/gyms/${gymId}/trainers/${encoded}/ratings`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to fetch trainer ratings.');
    }
    return json.data;
  }

  /**
   * Submit a Member Rating for a Gym
   */
  async submitGymRating(gymId, ratingData) {
    const response = await this.executeFetch(`/gyms/${gymId}/ratings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(ratingData),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to submit gym rating.');
    }
    return json.data;
  }

  /**
   * Submit a Member Rating for a Trainer
   */
  async submitTrainerRating(gymId, trainerIdentifier, ratingData) {
    const encoded = encodeURIComponent(trainerIdentifier);
    const response = await this.executeFetch(`/gyms/${gymId}/trainers/${encoded}/ratings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(ratingData),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to submit trainer rating.');
    }
    return json.data;
  }

  /**
   * Fetch Active Workout Sections / Group Classes for a Gym
   */
  async getGymSections(gymId, params = {}) {
    let url = `/sections?gymId=${gymId}&isActive=true`;
    if (params.category && params.category !== 'all') {
      url += `&category=${encodeURIComponent(params.category)}`;
    }
    if (params.search) {
      url += `&search=${encodeURIComponent(params.search)}`;
    }
    const response = await this.executeFetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to fetch gym sections.');
    }
    return json.data || [];
  }

  /**
   * Create a new Section / Group Class / Session Booking
   */
  async createBooking(bookingData) {
    const response = await this.executeFetch('/bookings', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(bookingData),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to complete booking.');
    }
    return json.data;
  }

  /**
   * Get all Bookings for the Logged-In User
   */
  async getMyBookings() {
    const response = await this.executeFetch('/bookings/my', {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to fetch bookings.');
    }
    return json.data || [];
  }

  /**
   * Get Single Booking Details by ID
   */
  async getBookingById(bookingId) {
    const response = await this.executeFetch(`/bookings/${bookingId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to fetch booking details.');
    }
    return json.data;
  }

  /**
   * Get cancellation and refund quote preview
   */
  async getBookingCancellationQuote(bookingId) {
    const response = await this.executeFetch(`/bookings/${bookingId}/cancellation-quote`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to fetch cancellation quote.');
    }
    return json.data;
  }

  /**
   * Cancel an active Booking
   */
  async cancelBooking(bookingId, reason = 'Cancelled by member') {
    const response = await this.executeFetch(`/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to cancel booking.');
    }
    return json.data;
  }

  /**
   * Request to reschedule a session in custom dates booking
   */
  async requestBookingReschedule(bookingId, { sessionIndex, sessionDate, requestedDate, reason }) {
    const response = await this.executeFetch(`/bookings/${bookingId}/request-reschedule`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ sessionIndex, sessionDate, requestedDate, reason }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to submit reschedule request.');
    }
    return json.data;
  }

  /**
   * Gym owner review reschedule (Approve, Propose date, or Reject)
   */
  async reviewBookingReschedule(bookingId, { sessionIndex, sessionDate, action, proposedDate, ownerNotes }) {
    const response = await this.executeFetch(`/bookings/${bookingId}/review-reschedule`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ sessionIndex, sessionDate, action, proposedDate, ownerNotes }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to review reschedule request.');
    }
    return json.data;
  }

  /**
   * Member responds to gym owner's proposed date (Accept or Decline)
   */
  async respondRescheduleProposal(bookingId, { sessionIndex, sessionDate, decision }) {
    const response = await this.executeFetch(`/bookings/${bookingId}/respond-proposal`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ sessionIndex, sessionDate, decision }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to respond to proposal.');
    }
    return json.data;
  }

  /**
   * Fetch location-aware & priority-sorted promotional banners
   */
  async getPromotionalBanners(lat, lng) {
    try {
      let query = '';
      if (lat != null && lng != null) {
        query = `?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
      }
      const response = await this.executeFetch(`/banners${query}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const json = await response.json();
      if (response.ok && json.success && Array.isArray(json.data)) {
        return json.data;
      }
      return [];
    } catch (error) {
      console.warn('[API SERVICE] getPromotionalBanners warning:', error?.message);
      return [];
    }
  }
}

export const apiService = new ApiService();
export default apiService;
