const express = require('express');
const controller = require('./auth.controller');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimit');
const schemas = require('./auth.validation');

const router = express.Router();

router.post('/login', authLimiter, validate(schemas.loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/forgot-password', authLimiter, validate(schemas.forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password/:token', authLimiter, validate(schemas.resetPasswordSchema), controller.resetPassword);

router.use(protect);
router.get('/me', controller.me);
router.post('/logout', controller.logout);
router.post('/change-password', validate(schemas.changePasswordSchema), controller.changePassword);
router.get('/login-history', controller.loginHistory);
router.get('/sessions', controller.listSessions);
router.delete('/sessions', controller.revokeSessions);

module.exports = router;
