import api, { unwrap, downloadFile } from './api';

export const payrollService = {
  structures: async (params) => unwrap(await api.get('/payroll/salary-structures', { params })),
  createStructure: async (payload) => unwrap(await api.post('/payroll/salary-structures', payload)),
  updateStructure: async (id, payload) => unwrap(await api.patch(`/payroll/salary-structures/${id}`, payload)),
  deleteStructure: async (id) => unwrap(await api.delete(`/payroll/salary-structures/${id}`)),
  run: async (payload) => unwrap(await api.post('/payroll/run', payload)),
  list: async (params) => unwrap(await api.get('/payroll', { params })),
  get: async (id) => unwrap(await api.get(`/payroll/${id}`)),
  approve: async (id) => unwrap(await api.patch(`/payroll/${id}/approve`)),
  approveMonth: async (month) => unwrap(await api.post('/payroll/approve-month', { month })),
  markPaid: async (id, payload) => unwrap(await api.patch(`/payroll/${id}/pay`, payload)),
  payslip: (id) => downloadFile(`/payroll/${id}/payslip`, {}, 'payslip.pdf'),
  myPayslips: async (params) => unwrap(await api.get('/payroll/my/payslips', { params })),
  export: (params) => downloadFile('/payroll/export', params, 'payroll'),
  myReimbursements: async (params) => unwrap(await api.get('/payroll/my/reimbursements', { params })),
  createReimbursement: async (formData) =>
    unwrap(await api.post('/payroll/my/reimbursements', formData, { headers: { 'Content-Type': 'multipart/form-data' } })),
  cancelReimbursement: async (id) => unwrap(await api.delete(`/payroll/my/reimbursements/${id}`)),
};
