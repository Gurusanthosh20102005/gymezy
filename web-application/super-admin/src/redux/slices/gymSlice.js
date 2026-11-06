import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '../../services/apiClient';

export const fetchGyms = createAsyncThunk(
  'gyms/fetchGyms',
  async (params, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/gyms/admin/fleet', { params });
      const data = response.data?.data;
      if (data && Array.isArray(data.gyms)) {
        return {
          gyms: data.gyms,
          pagination: data.pagination || {},
          counts: data.counts || {},
        };
      }
      return Array.isArray(data) ? { gyms: data, pagination: {}, counts: {} } : { gyms: [], pagination: {}, counts: {} };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || err.message || 'Failed to fetch gyms fleet'
      );
    }
  },
  {
    condition: (params, { getState }) => {
      const { loading } = getState().gyms || {};
      // If a fetch is already in flight, skip duplicate parallel triggers unless forced
      if (loading && !params?.force) {
        return false;
      }
    },
  }
);

export const updateGymStatusApi = createAsyncThunk(
  'gyms/updateGymStatusApi',
  async ({ id, status, approvalStatus, remark, notes, rejectionReason }, { rejectWithValue, dispatch }) => {
    try {
      const payload = {};
      if (status) payload.status = status;
      if (approvalStatus) payload.approvalStatus = approvalStatus;
      const finalRemark = remark !== undefined ? remark : (notes !== undefined ? notes : rejectionReason);
      if (finalRemark !== undefined) {
        payload.remark = finalRemark;
        payload.notes = finalRemark;
        payload.rejectionReason = finalRemark;
      }
      const response = await apiClient.patch(`/gyms/${id}/status`, payload);
      const updatedGym = response.data?.data;
      dispatch(fetchGyms({ force: true }));
      return updatedGym;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || err.message || 'Failed to update gym status'
      );
    }
  }
);

// Clean up any legacy mock data from localStorage
try {
  localStorage.removeItem('gymezy_gyms_fleet');
} catch {
  // Ignore in non-browser environments
}

const initialState = {
  gyms: [],
  pagination: {
    total: 0,
    page: 1,
    limit: 10,
    pages: 1,
    didYouMean: null,
  },
  counts: {
    approved: 0,
    pending: 0,
    on_hold: 0,
    rejected: 0,
    total: 0,
  },
  selectedGym: null,
  filterStatus: 'All',
  filterSubscription: 'All',
  searchQuery: '',
  loading: false,
  error: null,
};

export const gymSlice = createSlice({
  name: 'gyms',
  initialState,
  reducers: {
    setGyms: (state, action) => {
      state.gyms = action.payload || [];
    },

    addGym: (state, action) => {
      const newGym = {
        rating: 0,
        reviewsCount: 0,
        membersCount: 0,
        monthlyRevenue: 0,
        changesCount: 0,
        status: action.payload.status || 'Active',
        approvalStatus: action.payload.approvalStatus || 'Approved',
        subscriptionStatus: 'Active',
        createdAt: new Date().toISOString(),
        ...action.payload,
      };
      state.gyms.unshift(newGym);
    },

    updateGym: (state, action) => {
      const { id, ...updates } = action.payload;
      const index = state.gyms.findIndex((g) => g.id === id || g._id === id);
      if (index !== -1) {
        state.gyms[index] = {
          ...state.gyms[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      }
    },

    deleteGym: (state, action) => {
      state.gyms = state.gyms.filter((g) => (g.id || g._id) !== action.payload);
    },

    approveGym: (state, action) => {
      const index = state.gyms.findIndex((g) => (g.id || g._id) === action.payload);
      if (index !== -1) {
        state.gyms[index].approvalStatus = 'Approved';
        state.gyms[index].status = 'Active';
        state.gyms[index].changesCount = 0;
      }
    },

    rejectGym: (state, action) => {
      const { id, reason } = action.payload;
      const index = state.gyms.findIndex((g) => (g.id || g._id) === id);
      if (index !== -1) {
        state.gyms[index].approvalStatus = 'Rejected';
        state.gyms[index].rejectionReason = reason;
      }
    },

    setGymStatus: (state, action) => {
      const { id, status, approvalStatus } = action.payload;
      const index = state.gyms.findIndex((g) => (g.id || g._id) === id);
      if (index !== -1) {
        if (status) state.gyms[index].status = status;
        if (approvalStatus) state.gyms[index].approvalStatus = approvalStatus;
      }
    },

    setSelectedGym: (state, action) => {
      state.selectedGym = action.payload;
    },

    resetGymsFleet: (state) => {
      state.gyms = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGyms.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGyms.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload)) {
          state.gyms = Array.isArray(action.payload.gyms) ? action.payload.gyms : [];
          if (action.payload.pagination) {
            state.pagination = action.payload.pagination;
          }
          if (action.payload.counts) {
            state.counts = action.payload.counts;
          }
        } else if (Array.isArray(action.payload)) {
          state.gyms = action.payload;
        }
      })
      .addCase(fetchGyms.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateGymStatusApi.fulfilled, (state, action) => {
        if (action.payload) {
          const updated = action.payload;
          const index = state.gyms.findIndex(
            (g) => (g.id || g._id) === (updated.id || updated._id) || (g.partnerId && g.partnerId === updated.partnerId)
          );
          if (index !== -1) {
            state.gyms[index] = { ...state.gyms[index], ...updated };
          }
          if (
            state.selectedGym &&
            ((state.selectedGym.id || state.selectedGym._id) === (updated.id || updated._id) ||
              (state.selectedGym.partnerId && state.selectedGym.partnerId === updated.partnerId))
          ) {
            state.selectedGym = { ...state.selectedGym, ...updated };
          }
        }
      });
  },
});

export const {
  setGyms,
  addGym,
  updateGym,
  deleteGym,
  approveGym,
  rejectGym,
  setGymStatus,
  setSelectedGym,
  resetGymsFleet,
} = gymSlice.actions;

export default gymSlice.reducer;
