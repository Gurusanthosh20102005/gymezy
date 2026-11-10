import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { hostname, protocol } = window.location;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith('.local')
    ) {
      return `${protocol}//${hostname}:5001/api/v1`;
    }
    if (hostname.includes('dev')) {
      return 'https://dev.api.gymezy.com/api/v1';
    }
  }
  return 'https://api.gymezy.com/api/v1';
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl();
    const token = localStorage.getItem('gymezy_auth_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const statusCode = error.response?.status;
    if (statusCode === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('gymezy_auth_token');
      localStorage.removeItem('gymezy_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    const responseData = error.response?.data;
    const formattedError = new Error(
      responseData?.message ||
      responseData?.error ||
      error.message ||
      'An unexpected network error occurred.'
    );
    formattedError.statusCode = statusCode || 500;
    formattedError.response = error.response;
    return Promise.reject(formattedError);
  }
);

export default apiClient;
