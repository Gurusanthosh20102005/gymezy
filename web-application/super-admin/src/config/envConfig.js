export const ENV_MODES = {
  LOCAL: 'local',
  DEV: 'development',
  STAGING: 'staging',
  PROD: 'production',
};

export const API_BASE_URLS = {
  [ENV_MODES.LOCAL]: 'http://localhost:5001/api/v1',
  [ENV_MODES.DEV]: 'http://localhost:5001/api/v1',
  [ENV_MODES.STAGING]: 'https://dev.api.gymezy.com/api/v1',
  [ENV_MODES.PROD]: 'https://api.gymezy.com/api/v1',
};

/**
 * Detects the current running environment mode
 * @returns {'local' | 'development' | 'staging' | 'production'}
 */
export const detectEnvironment = () => {
  // 1. Browser hostname check (highest priority for local development)
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { hostname } = window.location;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.')
    ) {
      return ENV_MODES.LOCAL;
    }
    if (hostname.includes('dev') || hostname.includes('staging') || hostname.includes('preview')) {
      return ENV_MODES.STAGING;
    }
  }

  // 2. Explicit environment variable check
  const envVar = import.meta.env.VITE_APP_ENV;
  if (envVar && Object.values(ENV_MODES).includes(envVar)) {
    return envVar;
  }

  // 3. Vite development mode check
  if (import.meta.env.DEV) {
    return ENV_MODES.LOCAL;
  }

  return ENV_MODES.PROD;
};

/**
 * Resolves the active API Base URL based on environment detection
 * @returns {string} Fully qualified API Base URL
 */
export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const currentEnv = detectEnvironment();

  // If local / on localhost / LAN IP, target local middleware backend dynamically
  if (currentEnv === ENV_MODES.LOCAL) {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const { hostname, protocol } = window.location;
      return `${protocol}//${hostname}:5001/api/v1`;
    }
    return API_BASE_URLS[ENV_MODES.LOCAL];
  }

  return API_BASE_URLS[currentEnv] || API_BASE_URLS[ENV_MODES.PROD];
};

export const CURRENT_ENV = detectEnvironment();
export const API_BASE_URL = getApiBaseUrl();
export const IS_DEBUG_MODE = CURRENT_ENV === ENV_MODES.LOCAL || import.meta.env.DEV;
