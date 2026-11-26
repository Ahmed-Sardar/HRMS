const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const baseOptions = {
  windowMs: env.rateLimit.windowMinutes * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
};

const apiLimiter = rateLimit({ ...baseOptions, max: env.rateLimit.max });

const authLimiter = rateLimit({
  ...baseOptions,
  max: env.rateLimit.authMax,
  message: { success: false, message: 'Too many authentication attempts. Try again in a few minutes.' },
});

const writeLimiter = rateLimit({ ...baseOptions, max: Math.round(env.rateLimit.max * 2) });

module.exports = { apiLimiter, authLimiter, writeLimiter };
