const express = require('express');
const { z } = require('zod');
const controller = require('./attendance.controller');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { ROLES, ATTENDANCE_STATUS } = require('../../config/constants');

const router = express.Router();
router.use(protect);

const listQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  employee: z.string().optional(),
  department: z.string().optional(),
  status: z.enum(Object.values(ATTENDANCE_STATUS)).optional(),
  date: z.string().optional(),
  month: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// ---- Employee self-service ----
router.get('/today', controller.today);
router.post('/check-in', controller.checkIn);
router.post('/break/start', validate({ body: z.object({ type: z.enum(['SHORT', 'LUNCH', 'PERSONAL', 'OTHER']).optional() }) }), controller.startBreak);
router.post('/break/end', controller.endBreak);
router.post('/check-out', controller.checkOut);
router.get('/my', validate({ query: listQuery }), controller.myAttendance);
router.get('/calendar', validate({ query: z.object({ month: z.string().optional(), employee: z.string().optional() }) }), controller.calendar);

router.post(
  '/corrections',
  validate({
    body: z.object({
      date: z.coerce.date(),
      requestedCheckIn: z.coerce.date().optional(),
      requestedCheckOut: z.coerce.date().optional(),
      requestedStatus: z.enum(['PRESENT', 'HALF_DAY', 'LATE', 'EARLY_DEPARTURE', 'ON_LEAVE']).optional(),
      reason: z.string().min(5).max(1000),
    }),
  }),
  controller.requestCorrection,
);
router.get('/corrections', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE), controller.corrections);

// ---- HR / Admin ----
router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE), validate({ query: listQuery }), controller.list);
router.get('/summary', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR), controller.orgSummary);
router.get('/export', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE), controller.exportReport);
router.patch(
  '/corrections/:id/review',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({
    body: z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
      reviewComment: z.string().max(1000).optional(),
    }),
  }),
  controller.reviewCorrection,
);
router.patch(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({
    body: z.object({
      checkIn: z.coerce.date().nullable().optional(),
      checkOut: z.coerce.date().nullable().optional(),
      status: z.enum(Object.values(ATTENDANCE_STATUS)).optional(),
      notes: z.string().max(1000).optional(),
    }),
  }),
  controller.correctAttendance,
);

module.exports = router;
