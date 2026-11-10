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

        if (storedIds) {
          const parsed = JSON.parse(storedIds);
          if (Array.isArray(parsed)) {
            this.bookmarkedIds = new Set(parsed.map(String));
          }
        }

        if (storedGyms) {
          const parsedGyms = JSON.parse(storedGyms);
          if (Array.isArray(parsedGyms)) {
            this.cachedGyms = parsedGyms;
          }
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
      callback(new Set(this.bookmarkedIds), this.cachedGyms);
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
    this.listeners.forEach((listener) => {
      try {
        listener(copy, gymsCopy);
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
    const id = typeof gymOrId === 'string' ? gymOrId : (gymOrId.id || gymOrId._id || gymOrId.partnerId);
    if (!id) return false;
    const strId = String(id);
    return this.bookmarkedIds.has(strId);
  }

  /**
   * Get total count of bookmarked gyms
   */
  getCount() {
    return this.bookmarkedIds.size;
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

    const currentlyBookmarked = this.bookmarkedIds.has(gymId) ||
      (mongoId && this.bookmarkedIds.has(mongoId)) ||
      (partnerId && this.bookmarkedIds.has(partnerId));

    const nextState = !currentlyBookmarked;

    // 1. Optimistic Local State Update
    if (nextState) {
      this.bookmarkedIds.add(gymId);
      if (mongoId) this.bookmarkedIds.add(mongoId);
      if (partnerId) this.bookmarkedIds.add(partnerId);

      // Add to cached gyms list if not already present
      const alreadyInList = this.cachedGyms.some(
        (g) => String(g.id || g._id) === gymId || (mongoId && String(g._id) === mongoId)
      );
      if (!alreadyInList) {
        this.cachedGyms = [
          {
            ...gym,
            id: gymId,
            _id: mongoId || gymId,
            isBookmarked: true,
          },
          ...this.cachedGyms,
        ];
      }
    } else {
      this.bookmarkedIds.delete(gymId);
      if (mongoId) this.bookmarkedIds.delete(mongoId);
      if (partnerId) this.bookmarkedIds.delete(partnerId);

      this.cachedGyms = this.cachedGyms.filter(
        (g) => String(g.id || g._id) !== gymId && (!mongoId || String(g._id) !== mongoId)
      );
    }

    // Persist to AsyncStorage immediately
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
        // Reconcile server bookmarked IDs
        response.bookmarkedGymIds.forEach((bId) => this.bookmarkedIds.add(String(bId)));
        this.persistLocalState();
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

        // Update ID set
        const newIds = new Set();
        liveGyms.forEach((g) => {
          if (g._id) newIds.add(String(g._id));
          if (g.partnerId) newIds.add(String(g.partnerId));
          if (g.id) newIds.add(String(g.id));
        });

        // Also merge any offline guest bookmarks
        this.bookmarkedIds.forEach((id) => newIds.add(id));
        this.bookmarkedIds = newIds;

        this.persistLocalState();
        this.notifyListeners();
        return liveGyms;
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

