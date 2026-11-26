const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { ROLES, PAYROLL_STATUS, REIMBURSEMENT_STATUS } = require('../../config/constants');
const service = require('./payroll.service');
const { uploadDocument } = require('../../middleware/upload');

const router = express.Router();
router.use(protect);

const componentSchema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().min(0),
  type: z.enum(['FIXED', 'PERCENTAGE']).optional(),
  taxable: z.boolean().optional(),
});

const structureBody = z.object({
  employee: z.string().min(1),
  effectiveFrom: z.coerce.date(),
  basic: z.coerce.number().min(0),
  hra: z.coerce.number().min(0).optional(),
  allowances: z.array(componentSchema).optional(),
  deductions: z.array(componentSchema).optional(),
  employerContributions: z.array(componentSchema).optional(),
  overtimeEligible: z.boolean().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

// ---- Employee self-service ----
router.get('/my/payslips', asyncHandler(async (req, res) => {
  const data = await service.getMyPayslips({ user: req.user, query: req.query });
  res.json({ success: true, data });
}));

router.get('/my/reimbursements', asyncHandler(async (req, res) => {
  const data = await service.listMyReimbursements({ user: req.user, query: req.query });
  res.json({ success: true, data });
}));

router.post(
  '/my/reimbursements',
  uploadDocument.single('receipt'),
  validate({
    body: z.object({
      title: z.string().min(3).max(200),
      category: z.enum(['TRAVEL', 'MEALS', 'MEDICAL', 'INTERNET', 'EQUIPMENT', 'TRAINING', 'OTHER']).optional(),
      amount: z.coerce.number().positive(),
      expenseDate: z.coerce.date(),
      description: z.string().max(2000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.createReimbursement({ user: req.user, employee: req.employee, payload: req.body, file: req.file, req });
    res.status(201).json({ success: true, message: 'Reimbursement request submitted', data });
  }),
);

router.delete('/my/reimbursements/:id', asyncHandler(async (req, res) => {
  const data = await service.cancelReimbursement({ id: req.params.id, user: req.user, req });
  res.json({ success: true, message: 'Reimbursement cancelled', data });
}));

// ---- Finance / Admin ----
router.get(
  '/salary-structures',
  authorize(ROLES.FINANCE, ROLES.SUPER_ADMIN, ROLES.HR),
  asyncHandler(async (req, res) => {
    const data = await service.listStructures(req.query);
    res.json({ success: true, data });
  }),
);

router.post(
  '/salary-structures',
  authorize(ROLES.FINANCE, ROLES.SUPER_ADMIN),
  validate({ body: structureBody }),
  asyncHandler(async (req, res) => {
    const data = await service.createStructure({ payload: req.body, user: req.user, req });
    res.status(201).json({ success: true, message: 'Salary structure created', data });
  }),
);

router.patch(
  '/salary-structures/:id',
  authorize(ROLES.FINANCE, ROLES.SUPER_ADMIN),
  validate({ body: structureBody.partial().omit({ employee: true }) }),
  asyncHandler(async (req, res) => {
    const data = await service.updateStructure({ id: req.params.id, payload: req.body, user: req.user, req });
    res.json({ success: true, message: 'Salary structure updated', data });
  }),
);

router.delete(
  '/salary-structures/:id',
  authorize(ROLES.FINANCE, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const data = await service.deleteStructure({ id: req.params.id, user: req.user, req });
    res.json({ success: true, message: 'Salary structure deactivated', data });
  }),
);

router.post(
  '/run',
  authorize(ROLES.FINANCE, ROLES.SUPER_ADMIN),
  validate({
    body: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      department: z.string().optional(),
      employeeIds: z.array(z.string()).optional(),
      bonus: z.coerce.number().min(0).optional(),
      notes: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await service.runPayroll({ payload: req.body, user: req.user, req });
    res.json({ success: true, message: `Payroll processed for ${data.month}`, data });
  }),
);

router.post(
  '/approve-month',
  authorize(ROLES.FINANCE, ROLES.SUPER_ADMIN),
  validate({ body: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }) }),
  asyncHandler(async (req, res) => {
    const data = await service.approvePayrollMonth({ month: req.body.month, user: req.user, req });
    res.json({ success: true, message: `${data.approved} payroll record(s) approved`, data });
  }),
);

router.get(
  '/export',
  authorize(ROLES.FINANCE, ROLES.SUPER_ADMIN, ROLES.HR),
  asyncHandler(async (req, res) => {
    await service.exportPayroll({ query: req.query, res, user: req.user, req });
  }),
);

router.get(
  '/',
  authorize(ROLES.FINANCE, ROLES.SUPER_ADMIN, ROLES.HR, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const data = await service.listPayroll(req.query);
    res.json({ success: true, data });
  }),
);

router.get('/:id', asyncHandler(async (req, res) => {
  const data = await service.getPayroll({ id: req.params.id, user: req.user });
  res.json({ success: true, data });
}));

router.get('/:id/payslip', asyncHandler(async (req, res) => {
  await service.payslipPdf({ id: req.params.id, user: req.user, res, req });
}));

router.patch(
  '/:id/approve',
  authorize(ROLES.FINANCE, ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const data = await service.approvePayroll({ id: req.params.id, user: req.user, req });
    res.json({ success: true, message: 'Payroll approved and payslip generated', data });
  }),
);

router.patch(
  '/:id/pay',
  authorize(ROLES.FINANCE, ROLES.SUPER_ADMIN),
  validate({ body: z.object({ paymentReference: z.string().max(120).optional() }) }),
  asyncHandler(async (req, res) => {
    const data = await service.markPaid({ id: req.params.id, user: req.user, payload: req.body, req });
    res.json({ success: true, message: 'Payroll marked as paid', data });
  }),
);

module.exports = router;
