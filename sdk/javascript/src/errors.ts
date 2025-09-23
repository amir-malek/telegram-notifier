import type { ApiErrorResponse, RateLimitInfo } from './types';

/**
 * Base error class for all Notification Service client errors
 */
export class NotificationServiceError extends Error {
  public readonly name = 'NotificationServiceError';

  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.stack = cause?.stack || this.stack;
  }
}

/**
 * Error thrown when API request validation fails
 */
export class ValidationError extends NotificationServiceError {
  public readonly name = 'ValidationError';

  constructor(
    message: string,
    public readonly validationErrors: Array<{
      field: string;
      message: string;
      value?: string;
    }> = [],
    cause?: Error
  ) {
    super(message, cause);
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends NotificationServiceError {
  public readonly name = 'AuthenticationError';

  constructor(message: string = 'Authentication failed', cause?: Error) {
    super(message, cause);
  }
}

/**
 * Error thrown when access is forbidden
 */
export class AuthorizationError extends NotificationServiceError {
  public readonly name = 'AuthorizationError';

  constructor(message: string = 'Access forbidden', cause?: Error) {
    super(message, cause);
  }
}

/**
 * Error thrown when resource is not found
 */
export class NotFoundError extends NotificationServiceError {
  public readonly name = 'NotFoundError';

  constructor(message: string = 'Resource not found', cause?: Error) {
    super(message, cause);
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends NotificationServiceError {
  public readonly name = 'RateLimitError';

  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number,
    public readonly rateLimit?: RateLimitInfo,
    cause?: Error
  ) {
    super(message, cause);
  }
}

/**
 * Error thrown when server encounters an internal error
 */
export class ServerError extends NotificationServiceError {
  public readonly name = 'ServerError';

  constructor(
    message: string = 'Internal server error',
    public readonly statusCode: number = 500,
    cause?: Error
  ) {
    super(message, cause);
  }
}

/**
 * Error thrown when network request fails
 */
export class NetworkError extends NotificationServiceError {
  public readonly name = 'NetworkError';

  constructor(message: string = 'Network request failed', cause?: Error) {
    super(message, cause);
  }
}

/**
 * Error thrown when request times out
 */
export class TimeoutError extends NotificationServiceError {
  public readonly name = 'TimeoutError';

  constructor(message: string = 'Request timed out', cause?: Error) {
    super(message, cause);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends NotificationServiceError {
  public readonly name = 'ConfigurationError';

  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

/**
 * Create appropriate error from API response
 */
export function createErrorFromResponse(
  statusCode: number,
  responseData: ApiErrorResponse | string,
  rateLimit?: RateLimitInfo
): NotificationServiceError {
  const isApiError = typeof responseData === 'object' && 'error' in responseData;
  const message = isApiError ? responseData.error : String(responseData);

  switch (statusCode) {
    case 400:
      if (isApiError && responseData.validationErrors) {
        return new ValidationError(message, responseData.validationErrors);
      }
      return new ValidationError(message);

    case 401:
      return new AuthenticationError(message);

    case 403:
      return new AuthorizationError(message);

    case 404:
      return new NotFoundError(message);

    case 429:
      const retryAfter = isApiError ? responseData.retryAfter : undefined;
      return new RateLimitError(message, retryAfter, rateLimit);

    case 500:
    case 502:
    case 503:
    case 504:
      return new ServerError(message, statusCode);

    default:
      return new NotificationServiceError(
        `HTTP ${statusCode}: ${message}`
      );
  }
}

/**
 * Type guard to check if error is a NotificationServiceError
 */
export function isNotificationServiceError(
  error: unknown
): error is NotificationServiceError {
  return error instanceof NotificationServiceError;
}

/**
 * Type guard to check if error is a specific error type
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isServerError(error: unknown): error is ServerError {
  return error instanceof ServerError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}