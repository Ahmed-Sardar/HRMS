class ApiError extends Error {
  constructor(statusCode, message, details = null, code = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details = null) {
    return new ApiError(400, message, details, 'BAD_REQUEST');
  }

  static unauthorized(message = 'Authentication required', details = null) {
    return new ApiError(401, message, details, 'UNAUTHORIZED');
  }

  static forbidden(message = 'You do not have permission to perform this action', details = null) {
    return new ApiError(403, message, details, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found', details = null) {
    return new ApiError(404, message, details, 'NOT_FOUND');
  }

  static conflict(message = 'Conflict', details = null) {
    return new ApiError(409, message, details, 'CONFLICT');
  }

  static tooManyRequests(message = 'Too many requests', details = null) {
    return new ApiError(429, message, details, 'RATE_LIMITED');
  }

  static internal(message = 'Internal server error', details = null) {
    return new ApiError(500, message, details, 'INTERNAL_ERROR');
  }
}

module.exports = ApiError;
