import api, { unwrap, downloadFile } from './api';

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

export const performanceService = {
  myReports: async (params) => unwrap(await api.get('/performance/reports/my', { params })),
  get: async (id) => unwrap(await api.get(`/performance/reports/${id}`)),
  preview: async (id) => unwrap(await api.get(`/performance/reports/${id}/preview`)),
  create: async (payload) => unwrap(await api.post('/performance/reports', payload)),
  update: async (id, payload) => unwrap(await api.patch(`/performance/reports/${id}`, payload)),
  submit: async (id, comments) => unwrap(await api.post(`/performance/reports/${id}/submit`, { comments })),
  remove: async (id) => unwrap(await api.delete(`/performance/reports/${id}`)),
  uploadAttachment: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return unwrap(await api.post(`/performance/reports/${id}/attachments`, formData, multipart));
  },
  deleteAttachment: async (id, attachmentId) =>
    unwrap(await api.delete(`/performance/reports/${id}/attachments/${attachmentId}`)),
  downloadAttachment: (id, attachmentId) =>
    downloadFile(`/performance/reports/${id}/attachments/${attachmentId}`, {}, 'attachment'),
  export: (id, format) => downloadFile(`/performance/reports/${id}/export`, { format }, `performance-report.${format}`),
  goals: async (params) => unwrap(await api.get('/performance/goals', { params })),
  createGoal: async (payload) => unwrap(await api.post('/performance/goals', payload)),
  updateGoal: async (id, payload) => unwrap(await api.patch(`/performance/goals/${id}`, payload)),
  deleteGoal: async (id) => unwrap(await api.delete(`/performance/goals/${id}`)),
};

export const financeService = {
  reports: async (params) => unwrap(await api.get('/finance/reports', { params })),
  getReport: async (id) => unwrap(await api.get(`/finance/reports/${id}`)),
  preview: async (id) => unwrap(await api.get(`/finance/reports/${id}/preview`)),
  export: (id, format) => downloadFile(`/finance/reports/${id}/export`, { format }, `report.${format}`),
  review: async (id, payload) => unwrap(await api.patch(`/finance/reports/${id}/review`, payload)),
  downloadAttachment: (id, attachmentId) =>
    downloadFile(`/finance/reports/${id}/attachment/${attachmentId}`, {}, 'attachment'),
  dashboard: async (params) => unwrap(await api.get('/finance/dashboard', { params })),
  reimbursements: async (params) => unwrap(await api.get('/finance/reimbursements', { params })),
  reviewReimbursement: async (id, payload) => unwrap(await api.patch(`/finance/reimbursements/${id}/review`, payload)),
  exportSummary: (params) => downloadFile('/finance/summary/export', params, 'financial-summary'),
};

export const hrService = {
  reports: async (params) => unwrap(await api.get('/hr/reports', { params })),
  getReport: async (id) => unwrap(await api.get(`/hr/reports/${id}`)),
  preview: async (id) => unwrap(await api.get(`/hr/reports/${id}/preview`)),
  export: (id, format) => downloadFile(`/hr/reports/${id}/export`, { format }, `report.${format}`),
  review: async (id, payload) => unwrap(await api.patch(`/hr/reports/${id}/review`, payload)),
  managerFeedback: async (id, payload) => unwrap(await api.patch(`/hr/reports/${id}/manager-feedback`, payload)),
  dashboard: async () => unwrap(await api.get('/hr/dashboard')),
};
