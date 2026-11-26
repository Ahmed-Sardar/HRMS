const mongoose = require('mongoose');
const env = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  if (err instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid value for field '${err.path}'`);
  } else if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
    error = ApiError.badRequest('Database validation failed', details);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = ApiError.conflict(`${field} already exists`, [{ field, message: 'Must be unique' }]);
  } else if (err.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Malformed JSON payload');
  } else if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large' : `File upload error: ${err.message}`;
    error = ApiError.badRequest(message);
  } else if (!(err instanceof ApiError)) {
    error = ApiError.internal(env.isProduction ? 'Something went wrong' : err.message);
  }

  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`, {
      stack: env.isProduction ? undefined : err.stack,
    });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${statusCode}: ${error.message}`);
  }

  const payload = {
    success: false,
    message: error.message,
    code: error.code,
  };
  if (error.details) payload.errors = error.details;
  if (!env.isProduction && statusCode >= 500) payload.stack = err.stack;

  res.status(statusCode).json(payload);
};

module.exports = { notFound, errorHandler };
