import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import type {
  NotificationClientConfig,
  SendNotificationRequest,
  BatchNotificationRequest,
  ScheduleNotificationRequest,
  NotificationQueryFilters,
  StatsQueryFilters,
  NotificationResponse,
  BatchNotificationResponse,
  ScheduledNotificationResponse,
  NotificationListResponse,
  NotificationDetail,
  NotificationHistoryResponse,
  NotificationStatsResponse,
  HealthCheckResponse,
  ClientResponse,
  RateLimitInfo,
  ApiErrorResponse
} from './types';
import {
  NotificationServiceError,
  NetworkError,
  TimeoutError,
  ConfigurationError,
  createErrorFromResponse
} from './errors';

/**
 * Notification Service API Client
 */
export class NotificationClient {
  private readonly axios: AxiosInstance;
  private readonly config: Required<NotificationClientConfig>;

  constructor(config: NotificationClientConfig) {
    // Validate configuration
    this.validateConfig(config);

    // Set defaults
    this.config = {
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      jwt: config.jwt,
      timeout: config.timeout || 30000,
      retry: {
        attempts: config.retry?.attempts || 3,
        delay: config.retry?.delay || 1000,
        retryOnRateLimit: config.retry?.retryOnRateLimit ?? true,
        ...config.retry
      },
      headers: config.headers || {}
    };

    // Create axios instance
    this.axios = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': '@notification-service/client@1.0.0',
        ...this.config.headers
      }
    });

    // Setup request interceptor for authentication
    this.axios.interceptors.request.use((config) => {
      if (this.config.jwt) {
        config.headers.Authorization = `Bearer ${this.config.jwt}`;
      } else if (this.config.apiKey) {
        config.headers.Authorization = `ApiKey ${this.config.apiKey}`;
      }

      // Add request ID for tracing
      config.headers['X-Request-ID'] = this.generateRequestId();

      return config;
    });

    // Setup response interceptor for error handling
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => this.handleResponseError(error)
    );
  }

  /**
   * Validate client configuration
   */
  private validateConfig(config: NotificationClientConfig): void {
    if (!config.baseURL) {
      throw new ConfigurationError('baseURL is required');
    }

    if (!config.baseURL.startsWith('http')) {
      throw new ConfigurationError('baseURL must be a valid HTTP(S) URL');
    }

    if (!config.apiKey && !config.jwt) {
      throw new ConfigurationError('Either apiKey or jwt must be provided');
    }

    if (config.timeout && config.timeout <= 0) {
      throw new ConfigurationError('timeout must be greater than 0');
    }

    if (config.retry?.attempts && config.retry.attempts < 0) {
      throw new ConfigurationError('retry.attempts must be 0 or greater');
    }

    if (config.retry?.delay && config.retry.delay < 0) {
      throw new ConfigurationError('retry.delay must be 0 or greater');
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `sdk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract rate limit information from response headers
   */
  private extractRateLimit(headers: Record<string, any>): RateLimitInfo | undefined {
    const limit = headers['ratelimit-limit'];
    const remaining = headers['ratelimit-remaining'];
    const reset = headers['ratelimit-reset'];

    if (limit && remaining && reset) {
      return {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        resetTime: reset
      };
    }

    return undefined;
  }

  /**
   * Handle axios response errors
   */
  private async handleResponseError(error: AxiosError): Promise<never> {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new TimeoutError('Request timed out', error);
    }

    if (!error.response) {
      throw new NetworkError('Network error occurred', error);
    }

    const { status, data, headers } = error.response;
    const rateLimit = this.extractRateLimit(headers);

    throw createErrorFromResponse(status, data, rateLimit);
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    params?: any
  ): Promise<ClientResponse<T>> {
    let lastError: Error;
    let attempt = 0;

    while (attempt <= this.config.retry.attempts) {
      try {
        const response: AxiosResponse<T> = await this.axios.request({
          method,
          url: endpoint,
          data,
          params
        });

        return {
          data: response.data,
          rateLimit: this.extractRateLimit(response.headers),
          headers: response.headers,
          status: response.status
        };

      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Don't retry on final attempt
        if (attempt > this.config.retry.attempts) {
          break;
        }

        // Check if we should retry
        const shouldRetry = this.shouldRetry(error as Error, attempt);
        if (!shouldRetry) {
          break;
        }

        // Wait before retrying
        await this.delay(this.config.retry.delay * attempt);
      }
    }

    throw lastError!;
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: Error, attempt: number): boolean {
    // Don't retry if we've exhausted attempts
    if (attempt >= this.config.retry.attempts) {
      return false;
    }

    // Retry on network errors
    if (error instanceof NetworkError || error instanceof TimeoutError) {
      return true;
    }

    // Retry on rate limit errors if configured
    if (error instanceof RateLimitError && this.config.retry.retryOnRateLimit) {
      return true;
    }

    // Retry on server errors (5xx)
    if (error instanceof ServerError && error.statusCode >= 500) {
      return true;
    }

    return false;
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update authentication credentials
   */
  public setAuthentication(auth: { apiKey?: string; jwt?: string }): void {
    if (auth.apiKey) {
      this.config.apiKey = auth.apiKey;
      this.config.jwt = undefined;
    } else if (auth.jwt) {
      this.config.jwt = auth.jwt;
      this.config.apiKey = undefined;
    }
  }

  /**
   * Check service health
   */
  public async health(): Promise<ClientResponse<HealthCheckResponse>> {
    return this.makeRequest<HealthCheckResponse>('GET', '/health');
  }

  /**
   * Send a single notification
   */
  public async sendNotification(
    request: SendNotificationRequest
  ): Promise<ClientResponse<NotificationResponse>> {
    return this.makeRequest<NotificationResponse>('POST', '/notifications', request);
  }

  /**
   * Send batch notifications
   */
  public async sendBatchNotifications(
    request: BatchNotificationRequest
  ): Promise<ClientResponse<BatchNotificationResponse>> {
    return this.makeRequest<BatchNotificationResponse>('POST', '/notifications/batch', request);
  }

  /**
   * Schedule a notification for future delivery
   */
  public async scheduleNotification(
    request: ScheduleNotificationRequest
  ): Promise<ClientResponse<ScheduledNotificationResponse>> {
    return this.makeRequest<ScheduledNotificationResponse>('POST', '/notifications/schedule', request);
  }

  /**
   * Get notifications list with optional filtering
   */
  public async getNotifications(
    filters?: NotificationQueryFilters
  ): Promise<ClientResponse<NotificationListResponse>> {
    const params = filters ? this.prepareQueryParams(filters) : undefined;
    return this.makeRequest<NotificationListResponse>('GET', '/notifications', undefined, params);
  }

  /**
   * Get specific notification details
   */
  public async getNotification(id: string): Promise<ClientResponse<NotificationDetail>> {
    return this.makeRequest<NotificationDetail>('GET', `/notifications/${id}`);
  }

  /**
   * Get notification delivery history
   */
  public async getNotificationHistory(id: string): Promise<ClientResponse<NotificationHistoryResponse>> {
    return this.makeRequest<NotificationHistoryResponse>('GET', `/notifications/${id}/history`);
  }

  /**
   * Cancel a notification
   */
  public async cancelNotification(id: string): Promise<ClientResponse<{ id: string; status: string; message: string }>> {
    return this.makeRequest('DELETE', `/notifications/${id}`);
  }

  /**
   * Get notification statistics
   */
  public async getStats(
    filters?: StatsQueryFilters
  ): Promise<ClientResponse<NotificationStatsResponse>> {
    const params = filters ? this.prepareQueryParams(filters) : undefined;
    return this.makeRequest<NotificationStatsResponse>('GET', '/notifications/stats', undefined, params);
  }

  /**
   * Prepare query parameters for API requests
   */
  private prepareQueryParams(params: Record<string, any>): Record<string, string> {
    const prepared: Record<string, string> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        if (value instanceof Date) {
          prepared[key] = value.toISOString();
        } else {
          prepared[key] = String(value);
        }
      }
    }

    return prepared;
  }

  /**
   * Get current configuration (without sensitive data)
   */
  public getConfig(): Omit<NotificationClientConfig, 'apiKey' | 'jwt'> {
    return {
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      retry: { ...this.config.retry },
      headers: { ...this.config.headers }
    };
  }
}