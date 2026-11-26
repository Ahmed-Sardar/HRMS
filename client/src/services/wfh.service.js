import api, { unwrap, downloadFile } from './api';

export const wfhService = {
  policy: async () => unwrap(await api.get('/wfh/policy')),
  my: async (params) => unwrap(await api.get('/wfh/my', { params })),
  list: async (params) => unwrap(await api.get('/wfh', { params })),
  summary: async () => unwrap(await api.get('/wfh/summary')),
  calendar: async (params) => unwrap(await api.get('/wfh/calendar', { params })),
  apply: async (payload) => unwrap(await api.post('/wfh', payload)),
  review: async (id, payload) => unwrap(await api.patch(`/wfh/${id}/review`, payload)),
  cancel: async (id) => unwrap(await api.patch(`/wfh/${id}/cancel`)),
  export: (params) => downloadFile('/wfh/export', params, 'wfh-report'),
};
