/**
 * Configuration options for the Notification Client
 */
export interface NotificationClientConfig {
  /** Base URL of the notification service */
  baseURL: string;
  /** API key for authentication */
  apiKey?: string;
  /** JWT token for authentication */
  jwt?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    /** Number of retry attempts (default: 3) */
    attempts?: number;
    /** Delay between retries in ms (default: 1000) */
    delay?: number;
    /** Whether to retry on rate limit errors (default: true) */
    retryOnRateLimit?: boolean;
  };
  /** Custom headers to include with requests */
  headers?: Record<string, string>;
}

/**
 * Supported notification channels
 */
export type NotificationChannel =
  | 'telegram'
  | 'slack'
  | 'discord'
  | 'email'
  | 'sms'
  | 'webhook';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'high' | 'medium' | 'low';

/**
 * Notification status
 */
export type NotificationStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'cancelled';

/**
 * Single notification request
 */
export interface SendNotificationRequest {
  /** Notification channel */
  channel: NotificationChannel;
  /** Recipient identifier (username, email, phone, etc.) */
  recipient: string;
  /** Subject line (for email notifications) */
  subject?: string;
  /** Message content (required if no template) */
  message?: string;
  /** Template ID (required if no message) */
  template?: string;
  /** Template variables (when using templates) */
  data?: Record<string, any>;
  /** Notification priority */
  priority?: NotificationPriority;
  /** Schedule notification for future delivery */
  scheduledAt?: Date | string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Batch notification options
 */
export interface BatchNotificationOptions {
  /** Remove duplicate notifications */
  deduplicate?: boolean;
  /** Number of notifications to process at once */
  batchSize?: number;
  /** Delay between batches in milliseconds */
  delayBetween?: number;
}

/**
 * Individual notification in a batch
 */
export interface BatchNotificationItem {
  /** Recipient identifier */
  recipient: string;
  /** Subject line */
  subject?: string;
  /** Message content */
  message?: string;
  /** Template variables */
  data?: Record<string, any>;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Batch notification request
 */
export interface BatchNotificationRequest {
  /** Notification channel */
  channel: NotificationChannel;
  /** Template to use for all notifications */
  template?: string;
  /** Array of notifications */
  notifications: BatchNotificationItem[];
  /** Batch processing options */
  options?: BatchNotificationOptions;
}

/**
 * Schedule notification request
 */
export interface ScheduleNotificationRequest extends SendNotificationRequest {
  /** Future date and time for delivery */
  scheduledAt: Date | string;
}

/**
 * Notification query filters
 */
export interface NotificationQueryFilters {
  /** Filter by notification status */
  status?: NotificationStatus;
  /** Filter by notification channel */
  channel?: NotificationChannel;
  /** Filter by priority */
  priority?: NotificationPriority;
  /** Filter notifications created after this date */
  from?: Date | string;
  /** Filter notifications created before this date */
  to?: Date | string;
  /** Maximum number of notifications to return */
  limit?: number;
  /** Number of notifications to skip */
  offset?: number;
}

/**
 * Statistics query filters
 */
export interface StatsQueryFilters {
  /** Start date for statistics */
  from?: Date | string;
  /** End date for statistics */
  to?: Date | string;
}

/**
 * Notification response
 */
export interface NotificationResponse {
  /** Unique notification ID */
  id: string;
  /** Current notification status */
  status: NotificationStatus;
  /** Notification channel */
  channel: NotificationChannel;
  /** Recipient identifier */
  recipient: string;
  /** Notification priority */
  priority: NotificationPriority;
  /** Scheduled delivery time (if scheduled) */
  scheduledAt?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Success message */
  message: string;
}

/**
 * Batch notification result item
 */
export interface BatchNotificationResultItem {
  /** Recipient identifier */
  recipient: string;
  /** Notification ID (if successful) */
  id?: string;
  /** Result status */
  status: 'queued' | 'error';
  /** Error message (if failed) */
  error?: string;
}

/**
 * Batch notification response
 */
export interface BatchNotificationResponse {
  /** Status message */
  message: string;
  /** Summary statistics */
  summary: {
    /** Total notifications in batch */
    total: number;
    /** Successfully queued notifications */
    successful: number;
    /** Failed notifications */
    failed: number;
  };
  /** Individual results */
  results: BatchNotificationResultItem[];
}

/**
 * Scheduled notification response
 */
export interface ScheduledNotificationResponse {
  /** Notification ID */
  id: string;
  /** Status */
  status: 'scheduled';
  /** Scheduled delivery time */
  scheduledAt: string;
  /** Success message */
  message: string;
}

/**
 * Delivery log entry
 */
export interface DeliveryLog {
  /** Log entry ID */
  id: string;
  /** Notification ID */
  notificationId: string;
  /** Delivery attempt number */
  attempt: number;
  /** Delivery status */
  status: 'success' | 'failed' | 'retry' | 'timeout';
  /** Error message (if failed) */
  errorMessage?: string;
  /** Response data from channel */
  responseData?: Record<string, any>;
  /** Timestamp */
  timestamp: string;
}

/**
 * Complete notification details
 */
export interface Notification {
  /** Notification ID */
  id: string;
  /** Client ID */
  clientId: string;
  /** Notification channel */
  channel: NotificationChannel;
  /** Recipient identifier */
  recipient: string;
  /** Message content */
  message?: string;
  /** Template ID */
  templateId?: string;
  /** Template data */
  templateData?: Record<string, any>;
  /** Priority */
  priority: NotificationPriority;
  /** Status */
  status: NotificationStatus;
  /** Scheduled delivery time */
  scheduledAt?: string;
  /** Sent timestamp */
  sentAt?: string;
  /** Failed timestamp */
  failedAt?: string;
  /** Error message */
  errorMessage?: string;
  /** Metadata */
  metadata?: Record<string, any>;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Notification with delivery logs
 */
export interface NotificationDetail extends Notification {
  /** Delivery attempt logs */
  deliveryLogs: DeliveryLog[];
}

/**
 * Pagination info
 */
export interface Pagination {
  /** Items per page */
  limit: number;
  /** Number of items skipped */
  offset: number;
  /** Total number of items */
  total: number;
}

/**
 * Notification list response
 */
export interface NotificationListResponse {
  /** Array of notifications */
  notifications: Notification[];
  /** Pagination information */
  pagination: Pagination;
}

/**
 * Notification history response
 */
export interface NotificationHistoryResponse {
  /** Notification ID */
  notificationId: string;
  /** Current status */
  status: NotificationStatus;
  /** Number of delivery attempts */
  attempts: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Delivery history */
  history: Array<{
    /** Attempt number */
    attempt: number;
    /** Attempt status */
    status: 'success' | 'failed' | 'retry' | 'timeout';
    /** Timestamp */
    timestamp: string;
    /** Error message */
    errorMessage?: string;
    /** Response data */
    responseData?: Record<string, any>;
  }>;
}

/**
 * Channel statistics
 */
export interface ChannelStats {
  /** Total notifications */
  total: number;
  /** Successfully sent */
  sent: number;
  /** Failed deliveries */
  failed: number;
  /** Pending/queued */
  pending: number;
}

/**
 * Notification statistics response
 */
export interface NotificationStatsResponse {
  /** Overall summary */
  summary: {
    /** Total notifications */
    total: number;
    /** Successfully sent notifications */
    sent: number;
    /** Failed notifications */
    failed: number;
    /** Pending/queued notifications */
    pending: number;
    /** Success rate percentage */
    successRate: number;
  };
  /** Statistics by channel */
  byChannel: Record<NotificationChannel, ChannelStats>;
  /** Statistics by status */
  byStatus: Record<NotificationStatus, number>;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  /** Error message */
  error: string;
  /** Error code */
  code: string;
  /** Timestamp */
  timestamp: string;
  /** Request path */
  path: string;
  /** HTTP method */
  method: string;
  /** Request ID */
  requestId?: string;
  /** Validation errors (for validation failures) */
  validationErrors?: Array<{
    /** Field name */
    field: string;
    /** Error message */
    message: string;
    /** Invalid value */
    value?: string;
  }>;
  /** Retry after seconds (for rate limit errors) */
  retryAfter?: number;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  /** Request limit per window */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Window reset time */
  resetTime: string;
}

/**
 * Client response with rate limit info
 */
export interface ClientResponse<T> {
  /** Response data */
  data: T;
  /** Rate limit information */
  rateLimit?: RateLimitInfo;
  /** Response headers */
  headers: Record<string, string>;
  /** HTTP status code */
  status: number;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  /** Service status */
  status: 'ok' | 'error';
  /** Timestamp */
  timestamp: string;
  /** Service name */
  service: string;
  /** Service version */
  version: string;
}