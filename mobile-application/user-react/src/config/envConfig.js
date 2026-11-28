/**
 * Mobile Environment Configuration for User React Native App
 */
export const ENV_TARGETS = {
  LOCAL: 'local',
  DEV: 'development',
  PROD: 'production',
};

// Current target for release builds
// Changed automatically via `npm run build:dev` or `npm run build:prod`
export const ACTIVE_ENV = ENV_TARGETS.LOCAL;

export const API_URLS = {
  [ENV_TARGETS.LOCAL]: 'http://localhost:5001/api/v1',
  [ENV_TARGETS.DEV]: 'https://dev.api.gymezy.com/api/v1',
  [ENV_TARGETS.PROD]: 'https://api.gymezy.com/api/v1',
};

export const getCloudApiUrl = () => {
  return API_URLS[ACTIVE_ENV] || API_URLS[ENV_TARGETS.DEV];
};
