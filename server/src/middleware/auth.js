const User = require('../models/User');
const Employee = require('../models/Employee');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/token');

const extractToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies.accessToken) return req.cookies.accessToken;
  return null;
};

const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication token is missing');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    throw ApiError.unauthorized(
      error.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Invalid authentication token',
    );
  }

  const user = await User.findById(payload.sub).select('+password');
  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');

  req.user = user;
  req.token = token;
  if (user.employee) {
    req.employee = await Employee.findOne({ _id: user.employee, isDeleted: false });
  }
  next();
});

/** Populates req.user/req.employee when a token is present, but never blocks. */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.isActive) {
      req.user = user;
      if (user.employee) req.employee = await Employee.findOne({ _id: user.employee, isDeleted: false });
    }
  } catch (error) {
    // ignore invalid tokens for public/optional endpoints
  }
  return next();
});

module.exports = { protect, optionalAuth };
