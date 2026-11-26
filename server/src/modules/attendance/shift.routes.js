const express = require('express');
const { z } = require('zod');
const Shift = require('../../models/Shift');
const Employee = require('../../models/Employee');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { logAudit } = require('../../utils/audit');
const { ROLES } = require('../../config/constants');

const router = express.Router();
router.use(protect);

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const bodySchema = z.object({
  name: z.string().min(2).max(80),
  code: z.string().min(2).max(20),
  startTime: z.string().regex(timeRegex, 'Use HH:mm'),
  endTime: z.string().regex(timeRegex, 'Use HH:mm'),
  graceMinutes: z.coerce.number().min(0).max(180).optional(),
  breakMinutes: z.coerce.number().min(0).max(300).optional(),
  weeklyOffs: z.array(z.coerce.number().min(0).max(6)).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const shifts = await Shift.find({}).sort({ isDefault: -1, name: 1 }).lean();
    res.json({ success: true, data: shifts });
  }),
);

router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate({ body: bodySchema }),
  asyncHandler(async (req, res) => {
    const payload = { ...req.body, code: req.body.code.toUpperCase() };
    const exists = await Shift.findOne({ $or: [{ name: payload.name }, { code: payload.code }] });
    if (exists) throw ApiError.conflict('A shift with this name or code already exists');
    if (payload.isDefault) await Shift.updateMany({}, { isDefault: false });
    const shift = await Shift.create(payload);
    await logAudit({
      req,
      actor: req.user,
      action: 'SHIFT_CREATED',
      module: 'SHIFT',
      entityType: 'Shift',
      entityId: shift._id,
      description: `Created shift ${shift.name} (${shift.startTime}-${shift.endTime})`,
      newValue: payload,
    });
    res.status(201).json({ success: true, message: 'Shift created', data: shift });
  }),
);

router.patch(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate({ body: bodySchema.partial() }),
  asyncHandler(async (req, res) => {
    const shift = await Shift.findById(req.params.id);
    if (!shift) throw ApiError.notFound('Shift not found');
    const previous = shift.toObject();
    Object.assign(shift, req.body);
    if (req.body.code) shift.code = req.body.code.toUpperCase();
    if (req.body.isDefault) await Shift.updateMany({ _id: { $ne: shift._id } }, { isDefault: false });
    await shift.save();
    await logAudit({
      req,
      actor: req.user,
      action: 'SHIFT_UPDATED',
      module: 'SHIFT',
      entityType: 'Shift',
      entityId: shift._id,
      description: `Updated shift ${shift.name}`,
      previousValue: previous,
      newValue: req.body,
    });
    res.json({ success: true, message: 'Shift updated', data: shift });
  }),
);

router.delete(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const shift = await Shift.findById(req.params.id);
    if (!shift) throw ApiError.notFound('Shift not found');
    const assigned = await Employee.countDocuments({ shift: shift._id, isDeleted: false });
    if (assigned > 0) throw ApiError.badRequest('Reassign employees before removing this shift');
    shift.isActive = false;
    shift.isDefault = false;
    await shift.save();
    await logAudit({
      req,
      actor: req.user,
      action: 'SHIFT_DEACTIVATED',
      module: 'SHIFT',
      entityType: 'Shift',
      entityId: shift._id,
      description: `Deactivated shift ${shift.name}`,
    });
    res.json({ success: true, message: 'Shift deactivated' });
  }),
);

module.exports = router;
