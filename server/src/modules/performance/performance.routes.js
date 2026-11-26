const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { ROLES, REPORT_STATUS, REPORT_PERIOD_TYPES } = require('../../config/constants');
const service = require('./performance.service');
const { uploadReportAttachment } = require('../../middleware/upload');

const router = express.Router();
router.use(protect);

const goalSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  weight: z.coerce.number().min(0).max(100).optional(),
  target: z.string().optional(),
  achievement: z.string().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'AT_RISK']).optional(),
});

const taskSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  completionDate: z.coerce.date().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

const kpiSchema = z.object({
  name: z.string().min(1).max(120),
  target: z.string().optional(),
  achieved: z.string().optional(),
  unit: z.string().optional(),
  score: z.coerce.number().min(0).max(100).optional(),
});

const reportBody = z.object({
  title: z.string().min(3).max(200),
  periodType: z.enum(REPORT_PERIOD_TYPES),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  selfAssessment: z.string().max(8000).optional(),
  goals: z.array(goalSchema).optional(),
  tasksCompleted: z.array(taskSchema).optional(),
  kpis: z.array(kpiSchema).optional(),
  achievements: z.string().max(4000).optional(),
  projectContributions: z.string().max(4000).optional(),
  challenges: z.string().max(4000).optional(),
  skillsDevelopment: z.string().max(4000).optional(),
  employeeComments: z.string().max(4000).optional(),
  overallRating: z.coerce.number().min(0).max(5).optional(),
});

const listQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(Object.values(REPORT_STATUS)).optional(),
  periodType: z.enum(REPORT_PERIOD_TYPES).optional(),
  search: z.string().optional(),
});

router.get(
  '/reports/my',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const data = await service.listMyReports({ user: req.user, query: req.validatedQuery || req.query });
    res.json({ success: true, data });
  }),
);

router.get('/goals', asyncHandler(async (req, res) => {
  const data = await service.listGoals({ user: req.user, query: req.query });
  res.json({ success: true, data });
}));

router.post(
  '/goals',
  validate({
    body: z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      category: z.enum(['BUSINESS', 'TECHNICAL', 'BEHAVIOURAL', 'LEARNING', 'DELIVERY']).optional(),
      weight: z.coerce.number().min(0).max(100).optional(),
      targetDate: z.coerce.date().optional(),
      periodStart: z.coerce.date().optional(),
      periodEnd: z.coerce.date().optional(),
      employee: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.createGoal({ user: req.user, payload: req.body });
    res.status(201).json({ success: true, message: 'Goal created', data });
  }),
);

router.patch(
  '/goals/:id',
  validate({
    body: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      progress: z.coerce.number().min(0).max(100).optional(),
      status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'PARTIALLY_ACHIEVED', 'MISSED']).optional(),
      managerComment: z.string().optional(),
      weight: z.coerce.number().optional(),
      targetDate: z.coerce.date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.updateGoal({ id: req.params.id, user: req.user, payload: req.body });
    res.json({ success: true, message: 'Goal updated', data });
  }),
);

router.delete('/goals/:id', asyncHandler(async (req, res) => {
  const data = await service.deleteGoal({ id: req.params.id, user: req.user });
  res.json({ success: true, message: 'Goal deleted', data });
}));

router.post(
  '/reports',
  validate({ body: reportBody }),
  asyncHandler(async (req, res) => {
    const data = await service.createReport({ user: req.user, employee: req.employee, payload: req.body, req });
    res.status(201).json({ success: true, message: 'Performance report created', data });
  }),
);

router.get('/reports/:id', asyncHandler(async (req, res) => {
  const data = await service.getReport({ id: req.params.id, user: req.user });
  res.json({ success: true, data });
}));

router.get('/reports/:id/preview', asyncHandler(async (req, res) => {
  const data = await service.previewReport({ id: req.params.id, user: req.user });
  res.json({ success: true, data });
}));

router.get('/reports/:id/export', asyncHandler(async (req, res) => {
  await service.exportReport({ id: req.params.id, user: req.user, format: req.query.format, res, req });
}));

router.patch(
  '/reports/:id',
  validate({ body: reportBody.partial() }),
  asyncHandler(async (req, res) => {
    const data = await service.updateReport({ id: req.params.id, user: req.user, payload: req.body, req });
    res.json({ success: true, message: 'Report updated', data });
  }),
);

router.post('/reports/:id/submit', asyncHandler(async (req, res) => {
  const data = await service.submitReport({ id: req.params.id, user: req.user, req, comments: req.body?.comments });
  res.json({ success: true, message: 'Report submitted for finance verification', data });
}));

router.post(
  '/reports/:id/attachments',
  uploadReportAttachment.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw require('../../utils/ApiError').badRequest('A file is required');
    const data = await service.attachFile({ id: req.params.id, user: req.user, file: req.file, req });
    res.status(201).json({ success: true, message: 'Attachment uploaded', data });
  }),
);

router.get('/reports/:id/attachments/:attachmentId', asyncHandler(async (req, res) => {
  await service.downloadAttachment({
    id: req.params.id,
    attachmentId: req.params.attachmentId,
    user: req.user,
    res,
    req,
  });
}));

router.delete('/reports/:id/attachments/:attachmentId', asyncHandler(async (req, res) => {
  const data = await service.removeAttachment({
    id: req.params.id,
    attachmentId: req.params.attachmentId,
    user: req.user,
    req,
  });
  res.json({ success: true, message: 'Attachment removed', data });
}));

router.delete('/reports/:id', asyncHandler(async (req, res) => {
  const data = await service.deleteDraft({ id: req.params.id, user: req.user, req });
  res.json({ success: true, message: 'Draft deleted', data });
}));

module.exports = router;
