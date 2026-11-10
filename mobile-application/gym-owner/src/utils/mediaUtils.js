/**
 * Safely extracts a valid image URI string from various MongoDB / backend formats:
 * - String URL / base64: "https://..." or "data:image/..."
 * - fileAttachmentSchema: { fileData: "...", fileName: "...", url: "..." }
 * - Array of images: ["https://...", { fileData: "..." }]
 * Returns a valid string URI or null so that fallbacks render safely without RCTImageView type errors.
 */
export const getSafeImageUri = (media, fallback = null) => {
  if (media == null) return fallback;

  if (typeof media === 'string') {
    const trimmed = media.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (Array.isArray(media) && media.length > 0) {
    for (let i = 0; i < media.length; i++) {
      const uri = getSafeImageUri(media[i], null);
      if (uri) return uri;
    }
    return fallback;
  }

  if (typeof media === 'object') {
    if (typeof media.fileData === 'string' && media.fileData.trim().length > 0) {
      return media.fileData.trim();
    }
    if (typeof media.url === 'string' && media.url.trim().length > 0) {
      return media.url.trim();
    }
    if (typeof media.uri === 'string' && media.uri.trim().length > 0) {
      return media.uri.trim();
    }
    if (typeof media.fileUrl === 'string' && media.fileUrl.trim().length > 0) {
      return media.fileUrl.trim();
    }
    if (typeof media.secure_url === 'string' && media.secure_url.trim().length > 0) {
      return media.secure_url.trim();
    }
    if (typeof media.avatar === 'string' && media.avatar.trim().length > 0) {
      return media.avatar.trim();
    }
    if (typeof media.profilePicture === 'string' && media.profilePicture.trim().length > 0) {
      return media.profilePicture.trim();
    }
  }

  return fallback;
};

/**
 * Safely extracts gym logo or cover photo URI
 */
export const getGymLogoUri = (gym) => {
  if (!gym) return null;
  return (
    getSafeImageUri(gym.logo) ||
    getSafeImageUri(gym.coverPhoto) ||
    getSafeImageUri(gym.image) ||
    getSafeImageUri(gym.images) ||
    getSafeImageUri(gym.galleryPhotos) ||
    null
  );
};
