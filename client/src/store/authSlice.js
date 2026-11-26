import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authService } from '../services/auth.service';
import { tokenStore } from '../services/api';

export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    return await authService.login(credentials);
  } catch (error) {
    return rejectWithValue(error?.response?.data?.message || 'Unable to sign in');
  }
});

export const bootstrapSession = createAsyncThunk('auth/bootstrap', async (_, { rejectWithValue }) => {
  if (!tokenStore.get()) return rejectWithValue('no-token');
  try {
    return await authService.me();
  } catch (error) {
    tokenStore.clear();
    return rejectWithValue('invalid-session');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await authService.logout();
  return true;
});

const initialState = {
  user: null,
  permissions: [],
  employeeProfile: null,
  status: 'idle',
  initialized: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionUpdated: (state, action) => {
      state.user = action.payload;
      state.permissions = action.payload?.permissions || state.permissions;
      state.employeeProfile = action.payload?.employeeProfile ?? state.employeeProfile;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.initialized = true;
        state.user = action.payload.user;
        state.permissions = action.payload.user?.permissions || [];
        state.employeeProfile = action.payload.user?.employeeProfile || null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload || 'Unable to sign in';
      })
      .addCase(bootstrapSession.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.initialized = true;
        state.user = action.payload;
        state.permissions = action.payload?.permissions || [];
        state.employeeProfile = action.payload?.employeeProfile || null;
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.status = 'anonymous';
        state.initialized = true;
        state.user = null;
        state.permissions = [];
        state.employeeProfile = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.permissions = [];
        state.employeeProfile = null;
        state.status = 'anonymous';
        state.initialized = true;
      })
      .addCase(logoutUser.rejected, (state) => {
        state.user = null;
        state.permissions = [];
        state.employeeProfile = null;
        state.status = 'anonymous';
        state.initialized = true;
      });
  },
});

export const { sessionUpdated, clearError } = authSlice.actions;
export default authSlice.reducer;
