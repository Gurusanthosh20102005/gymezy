import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './apiService';

const BOOKMARKS_STORAGE_KEY = '@gymezy_bookmarked_gym_ids';
const BOOKMARKED_GYMS_CACHE_KEY = '@gymezy_bookmarked_gyms_cache';

class BookmarkService {
  constructor() {
    this.bookmarkedIds = new Set();
    this.cachedGyms = [];
    this.listeners = new Set();
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Rebuilds bookmarkedIds index from cachedGyms to guarantee:
   * 1. Unique gyms only are tracked in cachedGyms
   * 2. getCount() always equals the exact number of unique gyms
   * 3. bookmarkedIds contains all alias strings (mongoId, partnerId, id) for O(1) lookup
   */
  rebuildIndices() {
    const newIds = new Set();
    const uniqueGyms = [];
    const seenGymKeys = new Set();

    (this.cachedGyms || []).forEach((gym) => {
      if (!gym) return;
      const canonicalKey = String(gym._id || gym.id || gym.partnerId || '');
      if (!canonicalKey) return;

      const altKey = String(gym.partnerId || gym.id || gym._id || '');
      if (seenGymKeys.has(canonicalKey) || (altKey && seenGymKeys.has(altKey))) {
        return; // Skip duplicate gym
      }

      seenGymKeys.add(canonicalKey);
      if (altKey) seenGymKeys.add(altKey);
      if (gym._id) seenGymKeys.add(String(gym._id));
      if (gym.partnerId) seenGymKeys.add(String(gym.partnerId));
      if (gym.id) seenGymKeys.add(String(gym.id));

      uniqueGyms.push(gym);

      if (gym._id) newIds.add(String(gym._id));
      if (gym.partnerId) newIds.add(String(gym.partnerId));
      if (gym.id) newIds.add(String(gym.id));
    });

    this.cachedGyms = uniqueGyms;
    this.bookmarkedIds = newIds;
  }

  /**
   * Initialize bookmark state from persistent AsyncStorage
   */
  async init() {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const [storedIds, storedGyms] = await Promise.all([
          AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY).catch(() => null),
          AsyncStorage.getItem(BOOKMARKED_GYMS_CACHE_KEY).catch(() => null),
        ]);

        if (storedGyms) {
          const parsedGyms = JSON.parse(storedGyms);
          if (Array.isArray(parsedGyms)) {
            this.cachedGyms = parsedGyms;
          }
        }

        if (storedIds) {
          const parsed = JSON.parse(storedIds);
          if (Array.isArray(parsed)) {
            parsed.forEach((id) => this.bookmarkedIds.add(String(id)));
          }
        }

        // Re-align and sanitize indices so cachedGyms & bookmarkedIds are unified
        if (this.cachedGyms.length > 0) {
          this.rebuildIndices();
        }

        this.isInitialized = true;
        this.notifyListeners();
      } catch (err) {
        console.warn('[BOOKMARK SERVICE] Failed to load local bookmarks:', err?.message);
        this.isInitialized = true;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Subscribe to real-time bookmark state changes across screens
   */
  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this.listeners.add(callback);
    // Trigger immediately with current state
    try {
      callback(new Set(this.bookmarkedIds), this.cachedGyms, this.getCount());
    } catch {
      // Ignore initial callback error
    }

    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners() {
    const copy = new Set(this.bookmarkedIds);
    const gymsCopy = [...this.cachedGyms];
    const count = this.getCount();
    this.listeners.forEach((listener) => {
      try {
        listener(copy, gymsCopy, count);
      } catch (e) {
        console.warn('[BOOKMARK SERVICE] Listener notification error:', e?.message);
      }
    });
  }

  /**
   * Check if a gym is currently bookmarked
   */
  isBookmarked(gymOrId) {
    if (!gymOrId) return false;
    if (typeof gymOrId === 'string') {
      return this.bookmarkedIds.has(gymOrId);
    }
    const candidates = [gymOrId.id, gymOrId._id, gymOrId.partnerId, gymOrId.mongoId].filter(Boolean);
    return candidates.some((cand) => this.bookmarkedIds.has(String(cand)));
  }

  /**
   * Get total count of unique bookmarked gyms
   */
  getCount() {
    if (Array.isArray(this.cachedGyms) && this.cachedGyms.length > 0) {
      return this.cachedGyms.length;
    }
    if (this.bookmarkedIds && this.bookmarkedIds.size > 0) {
      const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
      const mongoIds = Array.from(this.bookmarkedIds).filter((id) => mongoIdRegex.test(id));
      if (mongoIds.length > 0) return mongoIds.length;
      return this.bookmarkedIds.size;
    }
    return 0;
  }

  /**
   * Get all bookmarked gym IDs as an array
   */
  getBookmarkedIds() {
    return Array.from(this.bookmarkedIds);
  }

  /**
   * Get in-memory cached gym details
   */
  getCachedGyms() {
    return this.cachedGyms;
  }

  /**
   * Toggle bookmark status with optimistic updates and real-time event dispatching
   */
  async toggleBookmark(gym) {
    if (!gym) return false;
    await this.init();

    const gymId = String(gym.id || gym._id || gym.partnerId || '');
    if (!gymId) return false;

    const mongoId = gym._id ? String(gym._id) : null;
    const partnerId = gym.partnerId ? String(gym.partnerId) : null;

    const currentlyBookmarked = this.isBookmarked(gym);
    const nextState = !currentlyBookmarked;

    // 1. Optimistic Local State Update
    if (nextState) {
      // Add to cached gyms list if not already present
      const alreadyInList = this.cachedGyms.some((g) => {
        const gGymId = String(g.id || g._id || g.partnerId || '');
        const gMongoId = g._id ? String(g._id) : null;
        const gPartnerId = g.partnerId ? String(g.partnerId) : null;
        return (
          gGymId === gymId ||
          (mongoId && gMongoId === mongoId) ||
          (partnerId && gPartnerId === partnerId)
        );
      });

      if (!alreadyInList) {
        this.cachedGyms = [
          {
            ...gym,
            id: gymId,
            _id: mongoId || gymId,
            partnerId: partnerId || (gym.partnerId ? String(gym.partnerId) : ''),
            isBookmarked: true,
          },
          ...this.cachedGyms,
        ];
      }
    } else {
      this.cachedGyms = this.cachedGyms.filter((g) => {
        const gGymId = String(g.id || g._id || g.partnerId || '');
        const gMongoId = g._id ? String(g._id) : null;
        const gPartnerId = g.partnerId ? String(g.partnerId) : null;
        const matches = (
          gGymId === gymId ||
          (mongoId && gMongoId === mongoId) ||
          (partnerId && gPartnerId === partnerId)
        );
        return !matches;
      });
    }

    // Rebuild lookup index from unique cachedGyms
    this.rebuildIndices();
    this.persistLocalState();
    this.notifyListeners();

    // 2. Sync with MongoDB Database if user is authenticated
    const token = apiService.getAuthToken();
    if (!token) {
      // In guest mode, bookmarks remain safely persisted in local storage
      return nextState;
    }

    try {
      const response = await apiService.toggleBookmark(gymId);
      if (response && Array.isArray(response.bookmarkedGymIds)) {
        // Refresh with latest canonical DB data
        await this.fetchLiveBookmarks();
      }
    } catch (err) {
      console.warn('[BOOKMARK SERVICE] Notice syncing bookmark with DB:', err?.message);
    }

    return nextState;
  }

  /**
   * Persist current IDs and Gyms to device storage
   */
  async persistLocalState() {
    try {
      const idsArray = Array.from(this.bookmarkedIds);
      await Promise.all([
        AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(idsArray)),
        AsyncStorage.setItem(BOOKMARKED_GYMS_CACHE_KEY, JSON.stringify(this.cachedGyms)),
      ]);
    } catch (err) {
      console.warn('[BOOKMARK SERVICE] Error saving to AsyncStorage:', err?.message);
    }
  }

  /**
   * Fetch live bookmarked gyms from MongoDB and reconcile
   */
  async fetchLiveBookmarks(coords = {}) {
    await this.init();
    const token = apiService.getAuthToken();
    if (!token) {
      return this.cachedGyms;
    }

    try {
      const res = await apiService.getMyBookmarkedGyms(coords);
      if (res && Array.isArray(res.gyms)) {
        const liveGyms = res.gyms.map((g) => ({ ...g, isBookmarked: true }));
        this.cachedGyms = liveGyms;
        this.rebuildIndices();
        this.persistLocalState();
        this.notifyListeners();
        return this.cachedGyms;
      }
    } catch (err) {
      console.warn('[BOOKMARK SERVICE] Notice fetching live bookmarks:', err?.message);
    }
    return this.cachedGyms;
  }

  /**
   * Sync guest bookmarks to DB when the user logs in
   */
  async syncGuestBookmarks() {
    await this.init();
    const ids = Array.from(this.bookmarkedIds);
    if (ids.length === 0) return;

    const token = apiService.getAuthToken();
    if (!token) return;

    try {
      const result = await apiService.syncBookmarks(ids);
      if (result && Array.isArray(result.bookmarkedGymIds)) {
        result.bookmarkedGymIds.forEach((id) => this.bookmarkedIds.add(String(id)));
        this.persistLocalState();
        this.notifyListeners();
      }
      // Refresh list from DB
      await this.fetchLiveBookmarks();
    } catch (err) {
      console.warn('[BOOKMARK SERVICE] Sync guest bookmarks notice:', err?.message);
    }
  }

  /**
   * Clear local bookmarks (e.g., on logout)
   */
  async clear() {
    this.bookmarkedIds.clear();
    this.cachedGyms = [];
    this.notifyListeners();
    await AsyncStorage.multiRemove([BOOKMARKS_STORAGE_KEY, BOOKMARKED_GYMS_CACHE_KEY]).catch(() => {});
  }
}

export const bookmarkService = new BookmarkService();
export default bookmarkService;

