const ApiError = require('../utils/ApiError');
const { hasPermission } = require('../config/permissions');

/** Restricts a route to one or more roles. Always used after `protect`. */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  const allowed = roles.flat();
  if (!allowed.includes(req.user.role)) {
    return next(ApiError.forbidden('Your role is not permitted to access this resource'));
  }
  return next();
};

/** Restricts a route to users whose role grants the given permission. */
const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  const permitted = permissions.flat().some((permission) => hasPermission(req.user.role, permission));
  if (!permitted) {
    return next(ApiError.forbidden('You do not have permission to perform this action'));
  }
  return next();
};

/** Ensures the authenticated user owns the employee record or is staff. */
const assertSelfOrStaff = (req, employeeId) => {
  const staffRoles = ['SUPER_ADMIN', 'ADMIN', 'HR'];
  if (staffRoles.includes(req.user.role)) return true;
  return req.employee && String(req.employee._id) === String(employeeId);
};

module.exports = { authorize, requirePermission, assertSelfOrStaff };
