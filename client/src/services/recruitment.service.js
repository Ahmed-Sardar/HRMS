import api, { unwrap } from './api';

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

export const recruitmentService = {
  jobs: async (params) => unwrap(await api.get('/recruitment/jobs', { params })),
  createJob: async (payload) => unwrap(await api.post('/recruitment/jobs', payload)),
  updateJob: async (id, payload) => unwrap(await api.patch(`/recruitment/jobs/${id}`, payload)),
  removeJob: async (id) => unwrap(await api.delete(`/recruitment/jobs/${id}`)),
  candidates: async (params) => unwrap(await api.get('/recruitment/candidates', { params })),
  createCandidate: async (formData) => unwrap(await api.post('/recruitment/candidates', formData, multipart)),
  updateCandidate: async (id, payload) => unwrap(await api.patch(`/recruitment/candidates/${id}`, payload)),
  moveCandidate: async (id, payload) => unwrap(await api.patch(`/recruitment/candidates/${id}/stage`, payload)),
  hireCandidate: async (id, payload) => unwrap(await api.post(`/recruitment/candidates/${id}/hire`, payload)),
  removeCandidate: async (id) => unwrap(await api.delete(`/recruitment/candidates/${id}`)),
  interviews: async (params) => unwrap(await api.get('/recruitment/interviews', { params })),
  scheduleInterview: async (payload) => unwrap(await api.post('/recruitment/interviews', payload)),
  submitFeedback: async (id, payload) => unwrap(await api.patch(`/recruitment/interviews/${id}/feedback`, payload)),
};
