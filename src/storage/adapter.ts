import { Client, Notification, Template, DeliveryLog, ApiKeyData } from '../types';

// Base interfaces for storage operations
export interface StorageFilter {
  [key: string]: any;
}

export interface StorageOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface StorageResult<T> {
  data: T[];
  total: number;
}

// Storage adapter interface that both PostgreSQL and in-memory implementations will follow
export abstract class StorageAdapter {
  abstract readonly type: 'postgresql' | 'memory';
  abstract readonly isConnected: boolean;

  // Client operations
  abstract createClient(data: {
    name: string;
    email?: string;
    rateLimit?: number;
  }): Promise<Client>;

  abstract findClientById(id: string): Promise<Client | null>;
  abstract findClientByEmail(email: string): Promise<Client | null>;
  abstract updateClient(id: string, data: Partial<Client>): Promise<Client | null>;
  abstract deactivateClient(id: string): Promise<boolean>;

  // API Key operations
  abstract createApiKey(data: {
    clientId: string;
    keyHash: string;
    keyPrefix: string;
    name?: string;
    expiresAt?: Date;
  }): Promise<ApiKeyData>;

  abstract findApiKeyByPrefix(prefix: string): Promise<ApiKeyData | null>;
  abstract findApiKeysByClientId(clientId: string): Promise<ApiKeyData[]>;
  abstract updateApiKeyLastUsed(id: string): Promise<void>;
  abstract deactivateApiKey(id: string): Promise<boolean>;

  // Template operations
  abstract createTemplate(data: {
    clientId: string;
    name: string;
    channel: string;
    subject?: string;
    content: string;
    variables?: string[];
  }): Promise<Template>;

  abstract findTemplateById(id: string): Promise<Template | null>;
  abstract findTemplateByClientAndName(clientId: string, name: string, channel: string): Promise<Template | null>;
  abstract findTemplatesByClient(clientId: string): Promise<Template[]>;
  abstract updateTemplate(id: string, data: Partial<Template>): Promise<Template | null>;
  abstract deactivateTemplate(id: string): Promise<boolean>;

  // Notification operations
  abstract createNotification(data: {
    clientId: string;
    channel: string;
    recipient: string;
    subject?: string;
    message?: string;
    templateId?: string;
    templateData?: Record<string, any>;
    priority?: 'high' | 'medium' | 'low';
    scheduledAt?: Date;
    metadata?: Record<string, any>;
  }): Promise<Notification>;

  abstract findNotificationById(id: string): Promise<Notification | null>;
  abstract findPendingNotifications(limit?: number): Promise<Notification[]>;
  abstract findNotificationsByClient(clientId: string, options?: StorageOptions): Promise<StorageResult<Notification>>;
  abstract updateNotificationStatus(
    id: string,
    status: Notification['status'],
    errorMessage?: string,
    externalId?: string
  ): Promise<Notification | null>;
  abstract incrementNotificationRetryCount(id: string): Promise<Notification | null>;
  abstract getNotificationStats(clientId?: string, fromDate?: Date, toDate?: Date): Promise<any[]>;

  // Delivery log operations
  abstract createDeliveryLog(data: {
    notificationId: string;
    attempt: number;
    status: 'success' | 'failed' | 'retry' | 'timeout';
    responseData?: Record<string, any>;
    errorMessage?: string;
    processingTimeMs?: number;
  }): Promise<DeliveryLog>;

  abstract findDeliveryLogsByNotificationId(notificationId: string): Promise<DeliveryLog[]>;

  // Connection management
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isHealthy(): Promise<boolean>;

  // Memory management (for in-memory adapter)
  abstract cleanup?(): Promise<void>;
  abstract getStorageStats?(): Promise<{
    notifications: number;
    clients: number;
    templates: number;
    deliveryLogs: number;
    memoryUsage?: number;
  }>;
}