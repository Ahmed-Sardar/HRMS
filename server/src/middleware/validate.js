const ApiError = require('../utils/ApiError');

/**
 * Validates and coerces request input with Zod.
 * schema: { body?, query?, params? }
 */
const validate = (schema) => (req, res, next) => {
  try {
    if (schema.body) req.body = schema.body.parse(req.body);
    if (schema.query) req.validatedQuery = schema.query.parse(req.query);
    if (schema.params) req.params = schema.params.parse(req.params);
    return next();
  } catch (error) {
    if (error && error.issues) {
      const details = error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    return next(error);
  }
};

module.exports = validate;
