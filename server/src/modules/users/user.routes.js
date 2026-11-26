const express = require('express');
const { z } = require('zod');
const controller = require('./user.controller');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/authorize');
const { ROLES, ROLE_VALUES } = require('../../config/constants');
const { passwordSchema } = require('../auth/auth.validation');

const router = express.Router();

router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

const listQuery = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  role: z.enum(ROLE_VALUES).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sortBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const createBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema,
  role: z.enum(ROLE_VALUES),
  phone: z.string().optional(),
  employee: z.string().optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
});

const updateBody = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(ROLE_VALUES).optional(),
  isActive: z.boolean().optional(),
});

router.get('/', validate({ query: listQuery }), controller.list);
router.post('/', authorize(ROLES.SUPER_ADMIN), validate({ body: createBody }), controller.create);
router.get('/:id', controller.getOne);
router.patch('/:id', validate({ body: updateBody }), controller.update);
router.patch('/:id/role', authorize(ROLES.SUPER_ADMIN), validate({ body: z.object({ role: z.enum(ROLE_VALUES) }) }), controller.changeRole);
router.patch('/:id/status', validate({ body: z.object({ isActive: z.boolean() }) }), controller.setStatus);
router.patch('/:id/password', validate({ body: z.object({ password: passwordSchema }) }), controller.resetPassword);
router.delete('/:id', controller.remove);

module.exports = router;
