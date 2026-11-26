import api, { unwrap, downloadFile } from './api';

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

export const documentService = {
  list: async (params) => unwrap(await api.get('/documents', { params })),
  expiring: async (days) => unwrap(await api.get('/documents/expiring', { params: { days } })),
  upload: async (formData) => unwrap(await api.post('/documents', formData, multipart)),
  download: (id) => downloadFile(`/documents/${id}/download`, {}, 'document'),
  verify: async (id, payload) => unwrap(await api.patch(`/documents/${id}/verify`, payload)),
  remove: async (id) => unwrap(await api.delete(`/documents/${id}`)),
};

export const assetService = {
  list: async (params) => unwrap(await api.get('/assets', { params })),
  my: async () => unwrap(await api.get('/assets/my')),
  get: async (id) => unwrap(await api.get(`/assets/${id}`)),
  create: async (payload) => unwrap(await api.post('/assets', payload)),
  update: async (id, payload) => unwrap(await api.patch(`/assets/${id}`, payload)),
  assign: async (id, payload) => unwrap(await api.post(`/assets/${id}/assign`, payload)),
  returnAsset: async (id, payload) => unwrap(await api.post(`/assets/${id}/return`, payload)),
  remove: async (id) => unwrap(await api.delete(`/assets/${id}`)),
};
