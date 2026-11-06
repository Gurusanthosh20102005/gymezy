import apiClient from './apiClient';

export const bannerService = {
  getAllBanners: async (params = {}) => {
    const res = await apiClient.get('/banners/admin/all', { params });
    return res.data;
  },
  createBanner: async (data) => {
    const res = await apiClient.post('/banners/admin', data);
    return res.data;
  },
  updateBanner: async (id, data) => {
    const res = await apiClient.put(`/banners/admin/${id}`, data);
    return res.data;
  },
  togglePriority: async (id) => {
    const res = await apiClient.patch(`/banners/admin/${id}/priority`);
    return res.data;
  },
  deleteBanner: async (id) => {
    const res = await apiClient.delete(`/banners/admin/${id}`);
    return res.data;
  },
};

export default bannerService;
