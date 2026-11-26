import api, { unwrap } from './api';

export const notificationService = {
  list: async (params) => unwrap(await api.get('/notifications', { params })),
  unreadCount: async () => unwrap(await api.get('/notifications/unread-count')),
  markRead: async (id) => unwrap(await api.patch(`/notifications/${id}/read`)),
  markAllRead: async () => unwrap(await api.patch('/notifications/read-all')),
  remove: async (id) => unwrap(await api.delete(`/notifications/${id}`)),
};

export const announcementService = {
  list: async (params) => unwrap(await api.get('/announcements', { params })),
  manage: async (params) => unwrap(await api.get('/announcements/manage', { params })),
  create: async (payload) => unwrap(await api.post('/announcements', payload)),
  update: async (id, payload) => unwrap(await api.patch(`/announcements/${id}`, payload)),
  remove: async (id) => unwrap(await api.delete(`/announcements/${id}`)),
};
