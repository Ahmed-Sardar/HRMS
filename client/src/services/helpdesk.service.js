import api, { unwrap, downloadFile } from './api';

export const helpdeskService = {
  create: async (payload) => unwrap(await api.post('/helpdesk', payload)),
  my: async (params) => unwrap(await api.get('/helpdesk/my', { params })),
  list: async (params) => unwrap(await api.get('/helpdesk', { params })),
  stats: async () => unwrap(await api.get('/helpdesk/stats')),
  get: async (id) => unwrap(await api.get(`/helpdesk/${id}`)),
  assign: async (id, payload) => unwrap(await api.patch(`/helpdesk/${id}/assign`, payload)),
  setStatus: async (id, payload) => unwrap(await api.patch(`/helpdesk/${id}/status`, payload)),
  comment: async (id, payload) => unwrap(await api.post(`/helpdesk/${id}/comments`, payload)),
  export: (params) => downloadFile('/helpdesk/export', params, 'helpdesk-tickets'),
};
