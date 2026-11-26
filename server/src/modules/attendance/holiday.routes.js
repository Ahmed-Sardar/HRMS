const express = require('express');
const { z } = require('zod');
const Holiday = require('../../models/Holiday');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { logAudit } = require('../../utils/audit');
const { ROLES } = require('../../config/constants');
const time = require('../../utils/time');

const router = express.Router();
router.use(protect);

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  date: z.coerce.date(),
  type: z.enum(['PUBLIC', 'RESTRICTED', 'COMPANY', 'OPTIONAL']).optional(),
  description: z.string().optional(),
  isOptional: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { isActive: true };
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.month) {
      const range = time.monthRange(req.query.month);
      filter.date = { $gte: range.start, $lte: range.end };
    }
    const holidays = await Holiday.find(filter).sort({ date: 1 }).lean();
    res.json({ success: true, data: holidays });
  }),
);

router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({ body: bodySchema }),
  asyncHandler(async (req, res) => {
    const existing = await Holiday.findOne({
      date: time.startOfDay(req.body.date),
      name: req.body.name,
    });
    if (existing) throw ApiError.conflict('This holiday already exists');
    const holiday = await Holiday.create(req.body);
    await logAudit({
      req,
      actor: req.user,
      action: 'HOLIDAY_CREATED',
      module: 'HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id,
      description: `Added holiday ${holiday.name} on ${time.formatDate(holiday.date)}`,
      newValue: req.body,
    });
    res.status(201).json({ success: true, message: 'Holiday added', data: holiday });
  }),
);

router.patch(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({ body: bodySchema.partial() }),
  asyncHandler(async (req, res) => {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) throw ApiError.notFound('Holiday not found');
    const previous = holiday.toObject();
    Object.assign(holiday, req.body);
    await holiday.save();
    await logAudit({
      req,
      actor: req.user,
      action: 'HOLIDAY_UPDATED',
      module: 'HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id,
      description: `Updated holiday ${holiday.name}`,
      previousValue: previous,
      newValue: req.body,
    });
    res.json({ success: true, message: 'Holiday updated', data: holiday });
  }),
);

router.delete(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  asyncHandler(async (req, res) => {
    const holiday = await Holiday.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!holiday) throw ApiError.notFound('Holiday not found');
    await logAudit({
      req,
      actor: req.user,
      action: 'HOLIDAY_REMOVED',
      module: 'HOLIDAY',
      entityType: 'Holiday',
      entityId: holiday._id,
      description: `Removed holiday ${holiday.name}`,
    });
    res.json({ success: true, message: 'Holiday removed' });
  }),
);

module.exports = router;
