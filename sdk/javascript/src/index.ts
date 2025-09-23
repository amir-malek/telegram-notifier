/**
 * Notification Service JavaScript/TypeScript Client SDK
 *
 * @example Basic usage with API key
 * ```typescript
 * import { NotificationClient } from '@notification-service/client';
 *
 * const client = new NotificationClient({
 *   baseURL: 'https://api.notification.example.com/api',
 *   apiKey: 'nf_your_api_key_here'
 * });
 *
 * // Send a simple notification
 * await client.sendNotification({
 *   channel: 'telegram',
 *   recipient: '@username',
 *   message: 'Hello from the SDK!',
 *   priority: 'high'
 * });
 * ```
 *
 * @example Using with JWT authentication
 * ```typescript
 * const client = new NotificationClient({
 *   baseURL: 'https://api.notification.example.com/api',
 *   jwt: 'your_jwt_token_here'
 * });
 * ```
 *
 * @example Sending with template
 * ```typescript
 * await client.sendNotification({
 *   channel: 'telegram',
 *   recipient: '@username',
 *   template: 'job-alert-template-id',
 *   data: {
 *     title: 'Software Engineer',
 *     company: 'TechCorp',
 *     location: 'Remote'
 *   },
 *   priority: 'medium'
 * });
 * ```
 *
 * @example Batch notifications
 * ```typescript
 * await client.sendBatchNotifications({
 *   channel: 'telegram',
 *   template: 'job-alert-template-id',
 *   notifications: [
 *     {
 *       recipient: '@user1',
 *       data: { title: 'Backend Developer', company: 'StartupXYZ' }
 *     },
 *     {
 *       recipient: '@user2',
 *       data: { title: 'Frontend Developer', company: 'BigTech' }
 *     }
 *   ],
 *   options: {
 *     batchSize: 10,
 *     delayBetween: 2000
 *   }
 * });
 * ```
 *
 * @example Error handling
 * ```typescript
 * import {
 *   NotificationClient,
 *   isRateLimitError,
 *   isValidationError
 * } from '@notification-service/client';
 *
 * try {
 *   await client.sendNotification({
 *     channel: 'telegram',
 *     recipient: '@username',
 *     message: 'Hello!'
 *   });
 * } catch (error) {
 *   if (isRateLimitError(error)) {
 *     console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
 *   } else if (isValidationError(error)) {
 *     console.log('Validation errors:', error.validationErrors);
 *   } else {
 *     console.error('Unexpected error:', error.message);
 *   }
 * }
 * ```
 */

// Main client class
export { NotificationClient } from './client';

// Type definitions
export type {
  // Configuration
  NotificationClientConfig,

  // Core types
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,

  // Request types
  SendNotificationRequest,
  BatchNotificationRequest,
  BatchNotificationItem,
  BatchNotificationOptions,
  ScheduleNotificationRequest,
  NotificationQueryFilters,
  StatsQueryFilters,

  // Response types
  NotificationResponse,
  BatchNotificationResponse,
  BatchNotificationResultItem,
  ScheduledNotificationResponse,
  NotificationListResponse,
  NotificationDetail,
  NotificationHistoryResponse,
  NotificationStatsResponse,
  HealthCheckResponse,

  // Utility types
  Notification,
  DeliveryLog,
  Pagination,
  ChannelStats,
  ClientResponse,
  RateLimitInfo,
  ApiErrorResponse
} from './types';

// Error classes
export {
  // Base error
  NotificationServiceError,

  // Specific errors
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ServerError,
  NetworkError,
  TimeoutError,
  ConfigurationError,

  // Error utilities
  createErrorFromResponse,

  // Type guards
  isNotificationServiceError,
  isValidationError,
  isAuthenticationError,
  isAuthorizationError,
  isNotFoundError,
  isRateLimitError,
  isServerError,
  isNetworkError,
  isTimeoutError,
  isConfigurationError
} from './errors';

// Default export for convenience
export default NotificationClient;