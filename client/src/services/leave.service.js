import api, { unwrap, downloadFile } from './api';

export const leaveService = {
  types: async () => unwrap(await api.get('/leaves/types')),
  myBalance: async () => unwrap(await api.get('/leaves/balance/my')),
  employeeBalance: async (employeeId, year) =>
    unwrap(await api.get(`/leaves/balance/${employeeId}`, { params: { year } })),
  myLeaves: async (params) => unwrap(await api.get('/leaves/my', { params })),
  list: async (params) => unwrap(await api.get('/leaves', { params })),
  apply: async (payload) => unwrap(await api.post('/leaves', payload)),
  review: async (id, payload) => unwrap(await api.patch(`/leaves/${id}/review`, payload)),
  cancel: async (id) => unwrap(await api.patch(`/leaves/${id}/cancel`)),
  calendar: async (params) => unwrap(await api.get('/leaves/calendar', { params })),
  export: (params) => downloadFile('/leaves/export', params, 'leave-report'),
};
