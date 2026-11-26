import api, { unwrap, downloadFile } from './api';

export const employeeService = {
  list: async (params) => unwrap(await api.get('/employees', { params })),
  options: async (search) => unwrap(await api.get('/employees/options', { params: { search } })),
  me: async () => unwrap(await api.get('/employees/me')),
  get: async (id) => unwrap(await api.get(`/employees/${id}`)),
  create: async (payload) => unwrap(await api.post('/employees', payload)),
  update: async (id, payload) => unwrap(await api.patch(`/employees/${id}`, payload)),
  updateMe: async (payload) => unwrap(await api.patch('/employees/me', payload)),
  setStatus: async (id, payload) => unwrap(await api.patch(`/employees/${id}/status`, payload)),
  emailHistory: async (id) => unwrap(await api.get(`/employees/${id}/email-history`)),
  requestEmailChange: async (id, payload) => unwrap(await api.post(`/employees/${id}/email-requests`, payload)),
  verifyEmailChange: async (id, requestId, otp) =>
    unwrap(await api.post(`/employees/${id}/email-requests/${requestId}/verify`, { otp })),
  offboard: async (id, payload) => unwrap(await api.post(`/employees/${id}/offboard`, payload)),
  addTask: async (id, payload) => unwrap(await api.post(`/employees/${id}/onboarding-tasks`, payload)),
  updateTask: async (id, taskId, payload) => unwrap(await api.patch(`/employees/${id}/onboarding-tasks/${taskId}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/employees/${id}`)),
  permanentDelete: async (id, payload) => unwrap(await api.post(`/employees/${id}/permanent-delete`, payload)),
};

export const departmentService = {
  list: async (params) => unwrap(await api.get('/departments', { params })),
  create: async (payload) => unwrap(await api.post('/departments', payload)),
  update: async (id, payload) => unwrap(await api.patch(`/departments/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/departments/${id}`)),
};

export const designationService = {
  list: async (params) => unwrap(await api.get('/designations', { params })),
  create: async (payload) => unwrap(await api.post('/designations', payload)),
  update: async (id, payload) => unwrap(await api.patch(`/designations/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/designations/${id}`)),
};

export const userService = {
  list: async (params) => unwrap(await api.get('/users', { params })),
  get: async (id) => unwrap(await api.get(`/users/${id}`)),
  create: async (payload) => unwrap(await api.post('/users', payload)),
  update: async (id, payload) => unwrap(await api.patch(`/users/${id}`, payload)),
  changeRole: async (id, role) => unwrap(await api.patch(`/users/${id}/role`, { role })),
  setStatus: async (id, isActive) => unwrap(await api.patch(`/users/${id}/status`, { isActive })),
  resetPassword: async (id, password) => unwrap(await api.patch(`/users/${id}/password`, { password })),
  remove: async (id) => unwrap(await api.delete(`/users/${id}`)),
};

export { downloadFile };
