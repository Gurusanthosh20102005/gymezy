import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../services/apiClient';

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ identifier, password }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/auth/login', {
        identifier: identifier.trim(),
        password,
        portal: 'gym-owner',
        expectedRole: 'GYM_OWNER',
      });

      const responseData = response.data?.data || response.data || {};
      const userRole = responseData.role || 'GYM_OWNER';

      if (userRole !== 'GYM_OWNER' && userRole !== 'SUPER_ADMIN' && userRole !== 'MANAGER') {
        localStorage.removeItem('gymezy_auth_token');
        localStorage.removeItem('gymezy_user');
        return rejectWithValue('Access denied: This portal is reserved for Gym Owners and Managers.');
      }

      const token = responseData.token;
      const user = {
        id: responseData.id || responseData._id,
        name: responseData.fullName || responseData.name,
        fullName: responseData.fullName || responseData.name,
        email: responseData.email,
        phone: responseData.phone,
        role: userRole,
        isManager: userRole === 'MANAGER',
        gymId: responseData.gym?.id || responseData.gymId,
        gymName: responseData.gym?.name || responseData.gymName || 'My Gym',
        branch: responseData.gym?.city || responseData.gym?.area || '',
        gym: responseData.gym || null,
      };

      if (token) {
        localStorage.setItem('gymezy_auth_token', token);
      }
      localStorage.setItem('gymezy_user', JSON.stringify(user));

      return { user, token };
    } catch (err) {
      localStorage.removeItem('gymezy_auth_token');
      localStorage.removeItem('gymezy_user');
      return rejectWithValue(
        err.response?.data?.message || err.message || 'Invalid email/phone or password'
      );
    }
  }
);

export const refreshCurrentUser = createAsyncThunk(
  'auth/refreshCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/auth/me');
      const responseData = response.data?.data || response.data || {};
      const userRole = responseData.role || 'GYM_OWNER';

      if (userRole !== 'GYM_OWNER' && userRole !== 'SUPER_ADMIN' && userRole !== 'MANAGER') {
        return rejectWithValue('Access denied: Invalid role for this portal.');
      }

      const user = {
        id: responseData.id || responseData._id,
        name: responseData.fullName || responseData.name,
        fullName: responseData.fullName || responseData.name,
        email: responseData.email,
        phone: responseData.phone,
        role: userRole,
        isManager: userRole === 'MANAGER',
        gymId: responseData.gym?.id || responseData.gymId,
        gymName: responseData.gym?.name || responseData.gymName || 'My Gym',
        branch: responseData.gym?.city || responseData.gym?.area || '',
        gym: responseData.gym || null,
      };

      localStorage.setItem('gymezy_user', JSON.stringify(user));
      return user;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || err.message || 'Failed to refresh account status.'
      );
    }
  }
);

const getInitialUser = () => {
  try {
    const raw = localStorage.getItem('gymezy_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const token = localStorage.getItem('gymezy_auth_token');
const initialUser = getInitialUser();

const initialState = {
  isAuthenticated: Boolean(token && initialUser),
  user: initialUser,
  token: token || null,
  loading: false,
  error: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload.user || action.payload;
      state.token = action.payload.token || state.token;
      state.error = null;
      if (action.payload.token) {
        localStorage.setItem('gymezy_auth_token', action.payload.token);
      }
      localStorage.setItem('gymezy_user', JSON.stringify(state.user));
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.error = null;
      localStorage.removeItem('gymezy_auth_token');
      localStorage.removeItem('gymezy_user');
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(refreshCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      });
  },
});

export const { loginSuccess, logout, clearError } = authSlice.actions;
export default authSlice.reducer;
