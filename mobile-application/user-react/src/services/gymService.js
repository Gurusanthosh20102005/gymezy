
import { apiService } from './apiService';

// Fallback preset zones if backend is temporarily unreachable
export const DEFAULT_FALLBACK_ZONES = [
  { name: 'Anna Nagar, Chennai', area: 'Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', lat: 13.085, lon: 80.2101, gymCount: 1, isPopular: true },
  { name: 'T. Nagar, Chennai', area: 'T. Nagar', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0418, lon: 80.2341, gymCount: 1, isPopular: true },
  { name: 'Adyar, Chennai', area: 'Adyar', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0012, lon: 80.2565, gymCount: 1, isPopular: true },
  { name: 'Velachery, Chennai', area: 'Velachery', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9815, lon: 80.218, gymCount: 1, isPopular: true },
  { name: 'Nungambakkam, Chennai', area: 'Nungambakkam', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0569, lon: 80.2425, gymCount: 1, isPopular: true },
  { name: 'Porur, Chennai', area: 'Porur', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0382, lon: 80.1585, gymCount: 1, isPopular: true },
  { name: 'OMR, Chennai', area: 'OMR', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9698, lon: 80.2376, gymCount: 1, isPopular: true },
  { name: 'Besant Nagar, Chennai', area: 'Besant Nagar', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9996, lon: 80.2678, gymCount: 1, isPopular: true },
  { name: 'Guindy, Chennai', area: 'Guindy', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0067, lon: 80.203, gymCount: 1, isPopular: true },
];

// In-memory response cache and inflight request deduplication for ultra-fast instant UI rendering
const gymsCache = new Map();
const gymsDetailCache = new Map();
const inflightRequests = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

class GymService {
  /**
   * Fetch Popular City & Zone Chips directly from Backend
   */
  async fetchPopularZones() {
    try {
      const response = await apiService.executeFetch('/gyms/zones', {
        method: 'GET',
        headers: apiService.getHeaders(),
      }, 3500);

      const json = await response.json();
      if (response.ok && json.success && Array.isArray(json.data?.zones)) {
        return json.data.zones;
      }
      return DEFAULT_FALLBACK_ZONES;
    } catch (err) {
      console.warn('[GYM SERVICE] fetchPopularZones using fallback:', err.message);
      return DEFAULT_FALLBACK_ZONES;
    }
  }

  /**
   * Synchronously retrieve cached gym response if fresh
   */
  getCachedGyms(params = {}) {
    const latKey = typeof params.lat === 'number' ? params.lat.toFixed(2) : (params.lat || '');
    const lngKey = typeof params.lng === 'number' ? params.lng.toFixed(2) : (params.lng || '');
    const cacheKey = `${latKey}_${lngKey}_${params.city || ''}_${params.area || ''}_${params.category || ''}_${params.type || ''}_${params.facility || ''}_${params.workout || ''}_${params.search || ''}_${params.page || 1}_${params.limit || 15}`;
    const cached = gymsCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }
    // Also check if any recent cached query exists as fallback
    for (const entry of gymsCache.values()) {
      if (entry?.data?.gyms?.length > 0 && (now - entry.timestamp < CACHE_TTL_MS)) {
        return entry.data;
      }
    }
    return null;
  }

  /**
   * Fetch Gyms from Backend with Geospatial Proximity, Category, and Advanced Filters
   * Features in-memory caching and request deduplication for sub-10ms instant returns
   */
  async fetchGyms({
    lat,
    lng,
    city,
    area,
    category,
    type,
    facility,
    workout,
    search,
    sortBy = 'nearest',
    page = 1,
    limit = 15,
  } = {}) {
    const latKey = typeof lat === 'number' ? lat.toFixed(2) : (lat || '');
    const lngKey = typeof lng === 'number' ? lng.toFixed(2) : (lng || '');
    const cacheKey = `${latKey}_${lngKey}_${city || ''}_${area || ''}_${category || ''}_${type || ''}_${facility || ''}_${workout || ''}_${search || ''}_${page}_${limit}`;

    // 1. Check in-memory fresh cache for instant loading
    const cached = gymsCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }

    // 2. Request deduplication: if identical query is already inflight, reuse existing Promise
    if (inflightRequests.has(cacheKey)) {
      return inflightRequests.get(cacheKey);
    }

    const params = new URLSearchParams();
    if (lat !== undefined && lat !== null) params.append('lat', String(lat));
    if (lng !== undefined && lng !== null) params.append('lng', String(lng));
    if (city && city !== 'All') params.append('city', city);
    if (area && area !== 'All') params.append('area', area);
    if (category && category !== 'All') params.append('category', category);
    if (type && type !== 'All Gyms') params.append('type', type);
    if (facility && facility !== 'All Facilities') params.append('facility', facility);
    if (workout && workout !== 'All') params.append('workout', workout);
    if (search && search.trim().length > 0) params.append('search', search.trim());
    if (sortBy) params.append('sortBy', sortBy);
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));

    const queryString = params.toString() ? `?${params.toString()}` : '';

    const fetchPromise = (async () => {
      try {
        const response = await apiService.executeFetch(`/gyms${queryString}`, {
          method: 'GET',
          headers: apiService.getHeaders(),
        }, 15000);

        const json = await response.json();
        if (response.ok && json.success && Array.isArray(json.data?.gyms)) {
          const result = {
            gyms: json.data.gyms,
            pagination: json.data.pagination || { total: json.data.gyms.length, page: 1, pages: 1 },
            isBackend: true,
          };
          gymsCache.set(cacheKey, { timestamp: Date.now(), data: result });
          return result;
        }
        throw new Error(json.message || 'Failed to fetch gyms from server');
      } catch (err) {
        console.warn('[GYM SERVICE] fetchGyms error:', err.message);
        if (cached) return cached.data;
        return {
          gyms: [],
          pagination: { total: 0, page: 1, pages: 1 },
          isBackend: true,
        };
      } finally {
        inflightRequests.delete(cacheKey);
      }
    })();

    inflightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Fetch Single Gym Profile & Details from Backend with caching
   */
  async fetchGymById(gymId) {
    if (!gymId) return null;
    const cached = gymsDetailCache.get(gymId);
    if (cached && (Date.now() - cached.timestamp < 120000)) {
      return cached.data;
    }
    try {
      const response = await apiService.executeFetch(`/gyms/${gymId}`, {
        method: 'GET',
        headers: apiService.getHeaders(),
      });
      const json = await response.json();
      if (response.ok && json.success && json.data) {
        gymsDetailCache.set(gymId, { timestamp: Date.now(), data: json.data });
        return json.data;
      }
      return null;
    } catch (err) {
      console.warn('[GYM SERVICE] fetchGymById error:', err.message);
      return cached?.data || null;
    }
  }

  /**
   * Clear all caches when needed (e.g. on pull-to-refresh)
   */
  clearCache() {
    gymsCache.clear();
    gymsDetailCache.clear();
  }
}

export const gymService = new GymService();
export default gymService;

