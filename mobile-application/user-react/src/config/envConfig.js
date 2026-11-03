/**
 * Mobile Environment Configuration for User React Native App
 */
export const ENV_TARGETS = {
  DEV: 'development',
  PROD: 'production',
};

// Current target for release builds
// Changed automatically via `npm run build:dev` or `npm run build:prod`
export const ACTIVE_ENV = ENV_TARGETS.DEV;

export const API_URLS = {
  [ENV_TARGETS.DEV]: 'http://192.168.0.107:5001/api/v1',
  [ENV_TARGETS.PROD]: 'https://api.gymezy.com/api/v1',
};

export const getCloudApiUrl = () => {
  return API_URLS[ACTIVE_ENV] || API_URLS[ENV_TARGETS.PROD];
};
