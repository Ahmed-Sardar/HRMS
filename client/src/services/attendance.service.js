import api, { unwrap, downloadFile } from './api';

export const attendanceService = {
  today: async () => unwrap(await api.get('/attendance/today')),
  checkIn: async () => unwrap(await api.post('/attendance/check-in')),
  startBreak: async (type = 'LUNCH') => unwrap(await api.post('/attendance/break/start', { type })),
  endBreak: async () => unwrap(await api.post('/attendance/break/end')),
  checkOut: async () => unwrap(await api.post('/attendance/check-out')),
  my: async (params) => unwrap(await api.get('/attendance/my', { params })),
  calendar: async (params) => unwrap(await api.get('/attendance/calendar', { params })),
  list: async (params) => unwrap(await api.get('/attendance', { params })),
  summary: async (params) => unwrap(await api.get('/attendance/summary', { params })),
  correct: async (id, payload) => unwrap(await api.patch(`/attendance/${id}`, payload)),
  requestCorrection: async (payload) => unwrap(await api.post('/attendance/corrections', payload)),
  corrections: async (params) => unwrap(await api.get('/attendance/corrections', { params })),
  reviewCorrection: async (id, payload) => unwrap(await api.patch(`/attendance/corrections/${id}/review`, payload)),
  export: (params) => downloadFile('/attendance/export', params, 'attendance-report'),
};

export const shiftService = {
  list: async () => unwrap(await api.get('/shifts')),
  create: async (payload) => unwrap(await api.post('/shifts', payload)),
  update: async (id, payload) => unwrap(await api.patch(`/shifts/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/shifts/${id}`)),
};

export const holidayService = {
  list: async (params) => unwrap(await api.get('/holidays', { params })),
  create: async (payload) => unwrap(await api.post('/holidays', payload)),
  update: async (id, payload) => unwrap(await api.patch(`/holidays/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/holidays/${id}`)),
};
