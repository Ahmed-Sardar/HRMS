import api, { unwrap } from './api';

export const settingsService = {
  get: async () => unwrap(await api.get('/settings')),
  update: async (payload) => unwrap(await api.patch('/settings', payload)),
  roles: async () => unwrap(await api.get('/settings/roles')),
  auditLogs: async (params) => unwrap(await api.get('/settings/audit', { params })),
  myActivity: async (params) => unwrap(await api.get('/settings/activity/my', { params })),
};

export const dashboardService = {
  summary: async () => unwrap(await api.get('/dashboard')),
};
