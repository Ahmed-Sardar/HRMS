const User = require('../../models/User');
const Employee = require('../../models/Employee');
const RefreshToken = require('../../models/RefreshToken');
const ApiError = require('../../utils/ApiError');
const { ROLES, ROLE_VALUES } = require('../../config/constants');
const { getPagination, getSort, paginatedResponse } = require('../../utils/pagination');
const { logAudit } = require('../../utils/audit');
const {
  persistEmailChange,
  normalizeEmail,
  EMAIL_TYPES,
} = require('../../services/emailChange.service');

const buildFilter = ({ search, role, isActive }) => {
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (role && ROLE_VALUES.includes(role)) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
  return filter;
};

const listUsers = async (query) => {
  const pagination = getPagination(query);
  const filter = buildFilter(query);
  const [items, total] = await Promise.all([
    User.find(filter)
      .populate({ path: 'employee', select: 'employeeId firstName lastName department designation' })
      .sort(getSort(query, { createdAt: -1 }))
      .skip(pagination.skip)
      .limit(pagination.limit),
    User.countDocuments(filter),
  ]);
  return paginatedResponse(items.map((user) => user.toSafeJSON()), total, pagination);
};

const getUser = async (id) => {
  const user = await User.findById(id).populate({
    path: 'employee',
    select: 'employeeId firstName lastName email department designation employmentStatus',
  });
  if (!user) throw ApiError.notFound('User not found');
  return user.toSafeJSON();
};

const createUser = async ({ payload, actor, req }) => {
  const existing = await User.findOne({ email: String(payload.email).toLowerCase() });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  if (payload.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only a super admin can create another super admin');
  }

  let employee = null;
  if (payload.employee) {
    employee = await Employee.findById(payload.employee);
    if (!employee) throw ApiError.notFound('Employee not found');
    if (employee.user) throw ApiError.conflict('This employee already has a user account');
  }

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: payload.role || ROLES.EMPLOYEE,
    phone: payload.phone,
    employee: employee ? employee._id : undefined,
    isActive: payload.isActive !== undefined ? payload.isActive : true,
    mustChangePassword: payload.mustChangePassword || false,
    createdBy: actor._id,
  });

  if (employee) {
    employee.user = user._id;
    await employee.save();
  }

  await logAudit({
    req,
    actor,
    action: 'USER_CREATED',
    module: 'USER',
    entityType: 'User',
    entityId: user._id,
    description: `Created ${user.role} account for ${user.email}`,
    newValue: { email: user.email, role: user.role },
  });

  return user.toSafeJSON();
};

const updateUser = async (id, payload, actor, req) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  const previous = { name: user.name, email: user.email, role: user.role, isActive: user.isActive };
  let emailChanged = false;

  if (user.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN && (payload.role || payload.email)) {
    throw ApiError.forbidden('Only a super admin can modify a super admin account');
  }

  if (payload.role && payload.role !== user.role) {
    if (user.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('Only a super admin can modify a super admin account');
    }
    user.role = payload.role;
  }
  if (payload.name) user.name = payload.name;
  if (payload.email) {
    const email = normalizeEmail(payload.email);
    const [clash, employeeClash] = await Promise.all([
      User.findOne({ email, _id: { $ne: user._id } }),
      Employee.findOne({ email, user: { $ne: user._id }, isDeleted: false }),
    ]);
    if (clash) throw ApiError.conflict('Email is already used by another account');
    if (employeeClash) {
      throw ApiError.conflict('This email is already the official work email of another employee');
    }
    emailChanged = email !== user.email;
    user.email = email;
  }
  if (payload.phone !== undefined) user.phone = payload.phone;
  if (payload.isActive !== undefined) user.isActive = payload.isActive;

  await user.save();

  const employee = await Employee.findOne({ user: user._id, isDeleted: false });
  if (employee) {
    let employeeChanged = false;
    if (payload.firstName) {
      employee.firstName = payload.firstName;
      employeeChanged = true;
    }
    if (payload.lastName) {
      employee.lastName = payload.lastName;
      employeeChanged = true;
    }
    if (payload.phone) {
      employee.phone = payload.phone;
      employeeChanged = true;
    }
    if (emailChanged) {
      // Keep the employee's official work email in sync with the login account.
      await persistEmailChange({
        employee,
        changes: [
          {
            emailType: EMAIL_TYPES.WORK,
            previousEmail: employee.email,
            newEmail: user.email,
          },
        ],
        actor,
        req,
      });
    } else if (employeeChanged) {
      await employee.save();
    }
  }

  await logAudit({
    req,
    actor,
    action: 'USER_UPDATED',
    module: 'USER',
    entityType: 'User',
    entityId: user._id,
    description: `Updated account ${user.email}`,
    previousValue: previous,
    newValue: { name: user.name, email: user.email, role: user.role, isActive: user.isActive },
  });

  return user.toSafeJSON();
};

const changeRole = async (id, role, actor, req) => {
  if (!ROLE_VALUES.includes(role)) throw ApiError.badRequest('Invalid role');
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user._id.equals(actor._id)) throw ApiError.badRequest('You cannot change your own role');
  if (user.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only a super admin can modify a super admin account');
  }

  const previousRole = user.role;
  user.role = role;
  await user.save();

  await logAudit({
    req,
    actor,
    action: 'ROLE_CHANGED',
    module: 'USER',
    entityType: 'User',
    entityId: user._id,
    description: `Changed role of ${user.email} from ${previousRole} to ${role}`,
    previousValue: { role: previousRole },
    newValue: { role },
  });
  return user.toSafeJSON();
};

const setStatus = async (id, isActive, actor, req) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user._id.equals(actor._id)) throw ApiError.badRequest('You cannot deactivate your own account');

  user.isActive = Boolean(isActive);
  await user.save();
  if (!user.isActive) {
    await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  }

  await logAudit({
    req,
    actor,
    action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    module: 'USER',
    entityType: 'User',
    entityId: user._id,
    description: `${isActive ? 'Activated' : 'Deactivated'} account ${user.email}`,
  });
  return user.toSafeJSON();
};

const resetUserPassword = async (id, password, actor, req) => {
  const user = await User.findById(id).select('+password');
  if (!user) throw ApiError.notFound('User not found');
  user.password = password;
  user.mustChangePassword = true;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });

  await logAudit({
    req,
    actor,
    action: 'PASSWORD_RESET_BY_ADMIN',
    module: 'USER',
    entityType: 'User',
    entityId: user._id,
    description: `Administrator reset password for ${user.email}`,
  });
  return { success: true };
};

const deactivateUser = async (id, actor, req) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user._id.equals(actor._id)) throw ApiError.badRequest('You cannot delete your own account');
  user.isActive = false;
  user.email = `deleted-${Date.now()}-${user.email}`;
  await user.save({ validateBeforeSave: false });
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  await logAudit({
    req,
    actor,
    action: 'USER_DELETED',
    module: 'USER',
    entityType: 'User',
    entityId: user._id,
    description: `Soft-deleted account ${user.name}`,
  });
  return { success: true };
};

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changeRole,
  setStatus,
  resetUserPassword,
  deactivateUser,
};
