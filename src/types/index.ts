import { Request } from 'express';

export interface Client {
  id: string;
  name: string;
  apiKeyHash: string;
  rateLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  clientId: string;
  channel: string;
  recipient: string;
  message?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled';
  scheduledAt?: Date;
  sentAt?: Date | null;
  failedAt?: Date | null;
  errorMessage?: string | null;
  retryCount?: number;
  maxRetries?: number;
  externalId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Template {
  id: string;
  clientId: string;
  name: string;
  channel: string;
  content: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Channel {
  id: string;
  clientId: string;
  type: ChannelType;
  config: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ChannelType = 'telegram' | 'slack' | 'discord' | 'email' | 'sms' | 'webhook';

export interface DeliveryLog {
  id: string;
  notificationId: string;
  attempt: number;
  status: 'success' | 'failed' | 'retry' | 'timeout';
  errorMessage?: string;
  responseData?: Record<string, any>;
  timestamp: Date;
}

export interface RateLimit {
  clientId: string;
  windowStart: Date;
  requests: number;
  lastReset: Date;
}

export interface NotificationRequest {
  channel: string;
  recipient: string;
  subject?: string;
  message?: string;
  template?: string;
  data?: Record<string, any>;
  priority?: 'high' | 'medium' | 'low';
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

export interface BatchNotificationRequest {
  channel: string;
  template?: string;
  notifications: {
    recipient: string;
    subject?: string;
    message?: string;
    data?: Record<string, any>;
    metadata?: Record<string, any>;
  }[];
  options?: {
    deduplicate?: boolean;
    batchSize?: number;
    delayBetween?: number;
  };
}

export interface TemplateRequest {
  name: string;
  channel: string;
  content: string;
  variables?: string[];
}

export interface ChannelRequest {
  type: ChannelType;
  config: Record<string, any>;
}

export interface AuthTokenPayload {
  clientId: string;
  name: string;
  iat: number;
  exp: number;
}

export interface RegisterClientRequest {
  name: string;
  email?: string;
  rateLimit?: number;
}

export interface ClientResponse {
  id: string;
  name: string;
  apiKey: string;
  rateLimit: number;
  createdAt: Date;
}

export interface NotificationResponse {
  id: string;
  status: string;
  message?: string;
  scheduledAt?: Date;
  createdAt: Date;
}

export interface NotificationStats {
  totalSent: number;
  totalFailed: number;
  successRate: number;
  averageDeliveryTime: number;
  channelStats: Record<string, {
    sent: number;
    failed: number;
    successRate: number;
  }>;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  version: string;
  timestamp: Date;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    queue: 'up' | 'down';
  };
  metrics: {
    pendingJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
  };
}

export interface QueueJob {
  id: string;
  type: string;
  data: any;
  opts: {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: string | number;
  };
}

export interface WebhookPayload {
  notificationId: string;
  status: 'sent' | 'failed';
  timestamp: Date;
  metadata?: Record<string, any>;
  error?: string;
}

export interface TelegramConfig {
  botToken: string;
  webhookUrl?: string;
}

export interface SlackConfig {
  botToken: string;
  signingSecret: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface SMSConfig {
  provider: 'twilio' | 'aws-sns';
  config: Record<string, any>;
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT' | 'PATCH';
}

// API Key data structure
export interface ApiKeyData {
  keyId: string;
  clientId: string;
  hashedKey: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  isActive: boolean;
}

// Authenticated request with client attached
export interface AuthenticatedRequest extends Request {
  client?: Client | null;
}