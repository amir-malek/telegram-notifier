import { Request, Response, NextFunction } from 'express';
import { logger, logError } from '../../monitoring/logger';

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class NotificationError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'NotificationError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends NotificationError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends NotificationError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends NotificationError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends NotificationError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends NotificationError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends NotificationError {
  constructor(service: string, message: string, originalError?: Error) {
    super(`${service} error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', {
      service,
      originalError: originalError?.message
    });
    this.name = 'ExternalServiceError';
  }
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logError('Request error', error, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Set default error values
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';

  // Prepare error response
  const errorResponse: any = {
    error: error.message || 'Internal Server Error',
    code,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };

  // Add details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    if (error.details) {
      errorResponse.details = error.details;
    }
  }

  // Add request ID if available
  if (req.headers['x-request-id']) {
    errorResponse.requestId = req.headers['x-request-id'];
  }

  // Handle specific error types
  if (error.name === 'ValidationError' && error.details) {
    errorResponse.validationErrors = error.details;
  }

  // Handle Joi validation errors
  if (error.name === 'ValidationError' && (error as any).isJoi) {
    const joiError = error as any;
    errorResponse.validationErrors = joiError.details.map((detail: any) => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    errorResponse.error = 'Invalid token';
    errorResponse.code = 'INVALID_TOKEN';
    res.status(401).json(errorResponse);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    errorResponse.error = 'Token expired';
    errorResponse.code = 'TOKEN_EXPIRED';
    res.status(401).json(errorResponse);
    return;
  }

  // Handle MongoDB/PostgreSQL errors
  if (error.name === 'MongoError' || error.name === 'PostgresError') {
    if (process.env.NODE_ENV === 'production') {
      errorResponse.error = 'Database error';
      errorResponse.code = 'DATABASE_ERROR';
    }
  }

  // Handle syntax errors (malformed JSON)
  if (error instanceof SyntaxError && 'body' in error) {
    errorResponse.error = 'Invalid JSON format';
    errorResponse.code = 'INVALID_JSON';
    res.status(400).json(errorResponse);
    return;
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};