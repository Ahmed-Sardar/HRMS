const express = require('express');
const { z } = require('zod');
const controller = require('./employee.controller');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { ROLES, EMPLOYMENT_TYPE, EMPLOYMENT_STATUS, ROLE_VALUES } = require('../../config/constants');
const { passwordSchema } = require('../auth/auth.validation');

const router = express.Router();
router.use(protect);

const addressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
});

const emergencySchema = z.object({
  name: z.string().optional(),
  relation: z.string().optional(),
  phone: z.string().optional(),
});

const bankSchema = z.object({
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  bankName: z.string().optional(),
  ifscCode: z.string().optional(),
  branch: z.string().optional(),
  panNumber: z.string().optional(),
  taxId: z.string().optional(),
});

const createBody = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  personalEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(6).max(20).optional(),
  employeeId: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']).optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  reportingManager: z.string().optional(),
  dateOfJoining: z.coerce.date(),
  employmentType: z.enum(Object.values(EMPLOYMENT_TYPE)).optional(),
  workLocation: z.string().optional(),
  employmentStatus: z.enum(Object.values(EMPLOYMENT_STATUS)).optional(),
  shift: z.string().optional(),
  address: addressSchema.optional(),
  emergencyContact: emergencySchema.optional(),
  bankDetails: bankSchema.optional(),
  skills: z.array(z.string()).optional(),
  about: z.string().optional(),
  role: z.enum(ROLE_VALUES).optional(),
  password: passwordSchema.optional(),
  sendWelcomeEmail: z.boolean().optional(),
  onboardingTasks: z.array(z.object({ title: z.string(), owner: z.enum(['HR', 'EMPLOYEE', 'ADMIN', 'MANAGER']).optional(), description: z.string().optional() })).optional(),
});

const updateBody = createBody.partial().omit({ password: true, role: true }).extend({
  confirmationDate: z.coerce.date().optional(),
});

const selfBody = z.object({
  phone: z.string().optional(),
  altPhone: z.string().optional(),
  personalEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
  address: addressSchema.optional(),
  emergencyContact: emergencySchema.optional(),
  bankDetails: bankSchema.optional(),
  profilePhoto: z.string().optional(),
  about: z.string().max(2000).optional(),
  skills: z.array(z.string()).optional(),
  dateOfBirth: z.coerce.date().optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'OTHER']).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']).optional(),
});

const emailRequestSchema = z.object({
  emailType: z.enum(['WORK', 'PERSONAL']),
  newEmail: z.string().email('Enter a valid email'),
  reason: z.string().max(300).optional(),
});

const listQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  status: z.string().optional(),
  employmentType: z.string().optional(),
  reportingManager: z.string().optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
  sortBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// Self-service endpoints must be declared before the generic /:id route.
router.get('/me', controller.me);
router.patch('/me', validate({ body: selfBody }), controller.updateMe);
router.get('/options', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE), controller.options);

// Email change requests and history: access is enforced per-employee in the service
// (SUPER_ADMIN/ADMIN/HR for anyone, EMPLOYEE only for their own record).
router.get('/:id/email-history', controller.emailHistory);
router.post(
  '/:id/email-requests',
  validate({ body: emailRequestSchema }),
  controller.requestEmailChange,
);
router.post(
  '/:id/email-requests/:requestId/verify',
  validate({ body: z.object({ otp: z.string().regex(/^\d{6}$/, 'Enter the 6 digit verification code') }) }),
  controller.verifyEmailChange,
);

router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE), validate({ query: listQuery }), controller.list);
router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({ body: createBody }),
  controller.create,
);

router.get('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.FINANCE), controller.getOne);
router.patch('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR), validate({ body: updateBody }), controller.update);
router.patch(
  '/:id/status',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({
    body: z.object({
      employmentStatus: z.enum(Object.values(EMPLOYMENT_STATUS)),
      dateOfExit: z.coerce.date().optional(),
      reason: z.string().optional(),
    }),
  }),
  controller.setStatus,
);
router.post(
  '/:id/onboarding-tasks',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({ body: z.object({ title: z.string().min(2), description: z.string().optional(), owner: z.enum(['HR', 'EMPLOYEE', 'ADMIN', 'MANAGER']).optional(), dueDate: z.coerce.date().optional() }) }),
  controller.addTask,
);
router.patch(
  '/:id/onboarding-tasks/:taskId',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({ body: z.object({ title: z.string().optional(), description: z.string().optional(), owner: z.enum(['HR', 'EMPLOYEE', 'ADMIN', 'MANAGER']).optional(), dueDate: z.coerce.date().optional(), completed: z.boolean().optional() }) }),
  controller.updateTask,
);
router.post(
  '/:id/offboard',
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  validate({
    body: z.object({
      lastWorkingDay: z.coerce.date(),
      reason: z.string().min(3),
      exitInterviewDone: z.boolean().optional(),
      assetsReturned: z.boolean().optional(),
    }),
  }),
  controller.offboard,
);
// Irreversible erasure: SUPER_ADMIN only, with typed-ID, reason and password confirmation.
router.post(
  '/:id/permanent-delete',
  authorize(ROLES.SUPER_ADMIN),
  validate({
    body: z.object({
      employeeId: z.string().min(1, 'Employee ID confirmation is required'),
      reason: z.string().trim().min(10, 'Provide a deletion reason of at least 10 characters').max(500),
      password: z.string().min(1, 'Password confirmation is required'),
      acknowledged: z.boolean().refine((value) => value === true, {
        message: 'You must confirm that you understand permanent deletion',
      }),
    }),
  }),
  controller.permanentDelete,
);
router.delete('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), controller.remove);

module.exports = router;
