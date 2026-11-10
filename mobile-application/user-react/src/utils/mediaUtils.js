/**
 * Single Source of Truth (SSOT) Media & Image URI Utility
 *
 * Safely extracts and sanitizes valid image URI strings from any MongoDB / backend schema format:
 * - Direct string URL: "https://..." or "data:image/..."
 * - fileAttachmentSchema: { fileData: "...", fileName: "...", url: "...", uri: "...", fileUrl: "...", secure_url: "..." }
 * - Array of images/attachments: ["https://...", { fileData: "..." }]
 * - Nested objects
 *
 * GUARANTEES: Returns a valid non-empty string or fallback. Never returns a Map/Object.
 * Prevents native crash: "Value for uri cannot be cast from ReadableNativeMap to String" (RCTImageView error).
 */

export const DEFAULT_GYM_COVER =
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop';

export const DEFAULT_TRAINER_AVATAR =
  'https://images.unsplash.com/photo-1567013127542-490d757e51fc?q=80&w=400&auto=format&fit=crop';

export const DEFAULT_USER_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop';

/**
 * Safely resolves any media value to a guaranteed string URI or fallback
 * @param {*} media 
 * @param {string|null} fallback 
 * @returns {string|null}
 */
export const getSafeImageUri = (media, fallback = null) => {
  if (media == null) return fallback;

  // Direct string
  if (typeof media === 'string') {
    const trimmed = media.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  // Array of candidates: check each sequentially
  if (Array.isArray(media)) {
    for (let i = 0; i < media.length; i++) {
      const uri = getSafeImageUri(media[i], null);
      if (uri) return uri;
    }
    return fallback;
  }

  // Object / Subdocument / Attachment
  if (typeof media === 'object') {
    // 1. fileData (Base64 data URI)
    if (typeof media.fileData === 'string' && media.fileData.trim().length > 0) {
      return media.fileData.trim();
    }
    // 2. Direct string url / uri fields
    if (typeof media.uri === 'string' && media.uri.trim().length > 0) {
      return media.uri.trim();
    }
    if (typeof media.url === 'string' && media.url.trim().length > 0) {
      return media.url.trim();
    }
    if (typeof media.fileUrl === 'string' && media.fileUrl.trim().length > 0) {
      return media.fileUrl.trim();
    }
    if (typeof media.secure_url === 'string' && media.secure_url.trim().length > 0) {
      return media.secure_url.trim();
    }
    if (typeof media.coverPhotoUrl === 'string' && media.coverPhotoUrl.trim().length > 0) {
      return media.coverPhotoUrl.trim();
    }
    if (typeof media.logoUrl === 'string' && media.logoUrl.trim().length > 0) {
      return media.logoUrl.trim();
    }
    if (typeof media.imageUrl === 'string' && media.imageUrl.trim().length > 0) {
      return media.imageUrl.trim();
    }
    if (typeof media.thumbnailImage === 'string' && media.thumbnailImage.trim().length > 0) {
      return media.thumbnailImage.trim();
    }
    if (typeof media.profilePicture === 'string' && media.profilePicture.trim().length > 0) {
      return media.profilePicture.trim();
    }
    if (typeof media.avatar === 'string' && media.avatar.trim().length > 0) {
      return media.avatar.trim();
    }
    if (typeof media.image === 'string' && media.image.trim().length > 0) {
      return media.image.trim();
    }

    // Nested object checks (e.g. gym.coverPhoto, gym.logo)
    if (media.coverPhoto && typeof media.coverPhoto === 'object') {
      const coverRes = getSafeImageUri(media.coverPhoto, null);
      if (coverRes) return coverRes;
    }
    if (media.logo && typeof media.logo === 'object') {
      const logoRes = getSafeImageUri(media.logo, null);
      if (logoRes) return logoRes;
    }
    if (media.image && typeof media.image === 'object') {
      const imgRes = getSafeImageUri(media.image, null);
      if (imgRes) return imgRes;
    }
  }

  return fallback;
};

/**
 * Extracts a guaranteed valid string cover image for a gym card / details screen
 * @param {object} gym 
 * @returns {string}
 */
export const getGymCoverImage = (gym) => {
  if (!gym) return DEFAULT_GYM_COVER;

  return (
    getSafeImageUri(gym.coverPhotoUrl) ||
    getSafeImageUri(gym.coverPhoto) ||
    getSafeImageUri(gym.imageUrl) ||
    getSafeImageUri(gym.thumbnailImage) ||
    getSafeImageUri(gym.image) ||
    getSafeImageUri(gym.images) ||
    getSafeImageUri(gym.galleryPhotos) ||
    getSafeImageUri(gym.logoUrl) ||
    getSafeImageUri(gym.logo) ||
    DEFAULT_GYM_COVER
  );
};

/**
 * Extracts a guaranteed valid gym logo string URI or null
 * @param {object} gym 
 * @returns {string|null}
 */
export const getGymLogoUri = (gym) => {
  if (!gym) return null;

  return (
    getSafeImageUri(gym.logo) ||
    getSafeImageUri(gym.logoUrl) ||
    getSafeImageUri(gym.coverPhotoUrl) ||
    getSafeImageUri(gym.coverPhoto) ||
    getSafeImageUri(gym.image) ||
    getSafeImageUri(gym.imageUrl) ||
    getSafeImageUri(gym.images) ||
    null
  );
};

export default {
  DEFAULT_GYM_COVER,
  DEFAULT_TRAINER_AVATAR,
  DEFAULT_USER_AVATAR,
  getSafeImageUri,
  getGymCoverImage,
  getGymLogoUri,
};
