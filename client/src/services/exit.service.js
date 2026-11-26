import api, { unwrap, downloadFile } from './api';

export const exitService = {
  submit: async (payload) => unwrap(await api.post('/exits', payload)),
  initiate: async (payload) => unwrap(await api.post('/exits/initiate', payload)),
  my: async (params) => unwrap(await api.get('/exits/my', { params })),
  list: async (params) => unwrap(await api.get('/exits', { params })),
  get: async (id) => unwrap(await api.get(`/exits/${id}`)),
  managerReview: async (id, payload) => unwrap(await api.patch(`/exits/${id}/manager-review`, payload)),
  hrReview: async (id, payload) => unwrap(await api.patch(`/exits/${id}/hr-review`, payload)),
  withdraw: async (id) => unwrap(await api.patch(`/exits/${id}/withdraw`)),
  clearance: async (id, payload) => unwrap(await api.patch(`/exits/${id}/clearance`, payload)),
  assetReturn: async (id, assetId, payload) => unwrap(await api.patch(`/exits/${id}/assets/${assetId}`, payload)),
  interview: async (id, payload) => unwrap(await api.patch(`/exits/${id}/interview`, payload)),
  settlementPreview: async (id) => unwrap(await api.get(`/exits/${id}/settlement/preview`)),
  saveSettlement: async (id, payload) => unwrap(await api.post(`/exits/${id}/settlement`, payload)),
  approveSettlement: async (id, payload) => unwrap(await api.patch(`/exits/${id}/settlement`, payload)),
  complete: async (id, payload) => unwrap(await api.post(`/exits/${id}/complete`, payload)),
  letter: (id, type) => downloadFile(`/exits/${id}/letters/${type}`, {}, `${type.toLowerCase()}-letter.pdf`),
  export: (params) => downloadFile('/exits/export', params, 'exit-report'),
};
