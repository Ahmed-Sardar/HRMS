const express = require('express');
const { z } = require('zod');
const Notification = require('../../models/Notification');
const Announcement = require('../../models/Announcement');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { logAudit } = require('../../utils/audit');
const { getPagination, paginatedResponse } = require('../../utils/pagination');
const { ROLES, ROLE_VALUES } = require('../../config/constants');
const { notifyRoles } = require('../../services/notification.service');

const router = express.Router();
router.use(protect);

router.get('/', asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = { user: req.user._id };
  if (req.query.isRead === 'true') filter.isRead = true;
  if (req.query.isRead === 'false') filter.isRead = false;
  if (req.query.type) filter.type = req.query.type;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  res.json({ success: true, data: { ...paginatedResponse(items, total, pagination), unread } });
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
  res.json({ success: true, data: { unread: count } });
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() },
  );
  res.json({ success: true, message: 'All notifications marked as read', data: { updated: result.modifiedCount } });
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true },
  );
  if (!notification) throw ApiError.notFound('Notification not found');
  res.json({ success: true, message: 'Notification marked as read', data: notification });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!notification) throw ApiError.notFound('Notification not found');
  res.json({ success: true, message: 'Notification deleted' });
}));

// ---------------- Announcements ----------------
const announcementRouter = express.Router();
announcementRouter.use(protect);

announcementRouter.get('/', asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const now = new Date();
  const filter = {
    isActive: true,
    roles: req.user.role,
    publishedAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
  if (req.query.category) filter.category = req.query.category;
  const [items, total] = await Promise.all([
    Announcement.find(filter)
      .populate('createdBy', 'name role')
      .sort({ isPinned: -1, publishedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Announcement.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, pagination) });
}));

announcementRouter.get('/manage', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR), asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = {};
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  const [items, total] = await Promise.all([
    Announcement.find(filter)
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Announcement.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, pagination) });
}));

const announcementBody = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(5).max(8000),
  category: z.enum(['GENERAL', 'HR', 'POLICY', 'EVENT', 'FINANCE', 'SYSTEM']).optional(),
  roles: z.array(z.enum(ROLE_VALUES)).optional(),
  departments: z.array(z.string()).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  publishedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  isPinned: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

announcementRouter.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({ body: announcementBody }),
  asyncHandler(async (req, res) => {
    const announcement = await Announcement.create({ ...req.body, createdBy: req.user._id });
    await notifyRoles(req.body.roles && req.body.roles.length ? req.body.roles : ROLE_VALUES, {
      title: 'New announcement',
      message: announcement.title,
      type: 'ANNOUNCEMENT',
      priority: announcement.priority === 'URGENT' ? 'HIGH' : 'NORMAL',
      link: '/announcements',
    });
    await logAudit({
      req,
      actor: req.user,
      action: 'ANNOUNCEMENT_CREATED',
      module: 'ANNOUNCEMENT',
      entityType: 'Announcement',
      entityId: announcement._id,
      description: `Published announcement '${announcement.title}'`,
      newValue: { roles: announcement.roles, priority: announcement.priority },
    });
    res.status(201).json({ success: true, message: 'Announcement published', data: announcement });
  }),
);

announcementRouter.patch(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({ body: announcementBody.partial() }),
  asyncHandler(async (req, res) => {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) throw ApiError.notFound('Announcement not found');
    Object.assign(announcement, req.body);
    await announcement.save();
    await logAudit({
      req,
      actor: req.user,
      action: 'ANNOUNCEMENT_UPDATED',
      module: 'ANNOUNCEMENT',
      entityType: 'Announcement',
      entityId: announcement._id,
      description: `Updated announcement '${announcement.title}'`,
    });
    res.json({ success: true, message: 'Announcement updated', data: announcement });
  }),
);

announcementRouter.delete(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  asyncHandler(async (req, res) => {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!announcement) throw ApiError.notFound('Announcement not found');
    await logAudit({
      req,
      actor: req.user,
      action: 'ANNOUNCEMENT_ARCHIVED',
      module: 'ANNOUNCEMENT',
      entityType: 'Announcement',
      entityId: announcement._id,
      description: `Archived announcement '${announcement.title}'`,
    });
    res.json({ success: true, message: 'Announcement archived' });
  }),
);

module.exports = { notificationRouter: router, announcementRouter };
