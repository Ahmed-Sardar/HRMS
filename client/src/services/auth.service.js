import api, { unwrap, tokenStore } from './api';

export const authService = {
  async login(credentials) {
    const data = unwrap(await api.post('/auth/login', credentials));
    if (data?.accessToken) tokenStore.set(data.accessToken);
    return data;
  },
  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      tokenStore.clear();
    }
  },
  me: async () => unwrap(await api.get('/auth/me')),
  forgotPassword: async (email) => unwrap(await api.post('/auth/forgot-password', { email })),
  resetPassword: async (token, password) => unwrap(await api.post(`/auth/reset-password/${token}`, { password })),
  changePassword: async (payload) => unwrap(await api.post('/auth/change-password', payload)),
  loginHistory: async () => unwrap(await api.get('/auth/login-history')),
  sessions: async () => unwrap(await api.get('/auth/sessions')),
  revokeSessions: async () => unwrap(await api.delete('/auth/sessions')),
};
