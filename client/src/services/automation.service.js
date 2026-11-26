import api, { unwrap } from './api';

export const automationService = {
  status: async () => unwrap(await api.get('/automation/status')),
  runReminders: async () => unwrap(await api.post('/automation/reminders/run')),
  initializeLeave: async (payload = {}) => unwrap(await api.post('/automation/leave/initialize', payload)),
  autoAbsent: async (payload = {}) => unwrap(await api.post('/automation/attendance/auto-absent', payload)),
  runAll: async () => unwrap(await api.post('/automation/run-all')),
};
