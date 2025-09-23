import { v4 as uuidv4 } from 'uuid';
import { StorageAdapter, StorageOptions, StorageResult } from './adapter';
import { Client, Notification, Template, DeliveryLog, ApiKeyData } from '../types';
import { logger } from '../monitoring/logger';

interface InMemoryRecord {
  id: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export class InMemoryStorageAdapter extends StorageAdapter {
  readonly type = 'memory' as const;
  readonly isConnected = true;

  private clients = new Map<string, InMemoryRecord>();
  private apiKeys = new Map<string, InMemoryRecord>();
  private templates = new Map<string, InMemoryRecord>();
  private notifications = new Map<string, InMemoryRecord>();
  private deliveryLogs = new Map<string, InMemoryRecord>();

  private maxRecords: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: { maxRecords?: number; cleanupIntervalMs?: number } = {}) {
    super();
    this.maxRecords = options.maxRecords || parseInt(process.env.MEMORY_STORAGE_LIMIT || '1000');

    // Start cleanup interval
    const cleanupMs = options.cleanupIntervalMs || 300000; // 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, cleanupMs);

    logger.info(`In-memory storage adapter initialized with max ${this.maxRecords} records per collection`);
  }

  // Client operations
  async createClient(data: {
    name: string;
    email?: string;
    rateLimit?: number;
  }): Promise<Client> {
    const id = uuidv4();
    const now = new Date();

    const client: Client = {
      id,
      name: data.name,
      apiKeyHash: '',
      rateLimit: data.rateLimit || 100,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    this.clients.set(id, {
      id,
      data: { ...client, email: data.email },
      createdAt: now,
      updatedAt: now
    });

    this.enforceLimit(this.clients);
    return client;
  }

  async findClientById(id: string): Promise<Client | null> {
    const record = this.clients.get(id);
    if (!record || !record.data.isActive) return null;
    return this.mapClientRecord(record);
  }

  async findClientByEmail(email: string): Promise<Client | null> {
    for (const record of this.clients.values()) {
      if (record.data.email === email && record.data.isActive) {
        return this.mapClientRecord(record);
      }
    }
    return null;
  }

  async updateClient(id: string, data: Partial<Client>): Promise<Client | null> {
    const record = this.clients.get(id);
    if (!record) return null;

    record.data = { ...record.data, ...data };
    record.updatedAt = new Date();

    return this.mapClientRecord(record);
  }

  async deactivateClient(id: string): Promise<boolean> {
    const record = this.clients.get(id);
    if (!record) return false;

    record.data.isActive = false;
    record.updatedAt = new Date();
    return true;
  }

  // API Key operations
  async createApiKey(data: {
    clientId: string;
    keyHash: string;
    keyPrefix: string;
    name?: string;
    expiresAt?: Date;
  }): Promise<ApiKeyData> {
    const id = uuidv4();
    const now = new Date();

    const apiKey: ApiKeyData = {
      keyId: id,
      clientId: data.clientId,
      hashedKey: data.keyHash,
      prefix: data.keyPrefix,
      createdAt: now,
      lastUsedAt: null,
      isActive: true
    };

    this.apiKeys.set(id, {
      id,
      data: { ...apiKey, name: data.name },
      createdAt: now,
      updatedAt: now,
      expiresAt: data.expiresAt
    });

    this.enforceLimit(this.apiKeys);
    return apiKey;
  }

  async findApiKeyByPrefix(prefix: string): Promise<ApiKeyData | null> {
    for (const record of this.apiKeys.values()) {
      if (record.data.prefix === prefix && record.data.isActive && this.isNotExpired(record)) {
        return record.data;
      }
    }
    return null;
  }

  async findApiKeysByClientId(clientId: string): Promise<ApiKeyData[]> {
    const results: ApiKeyData[] = [];
    for (const record of this.apiKeys.values()) {
      if (record.data.clientId === clientId && record.data.isActive) {
        results.push(record.data);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    const record = this.apiKeys.get(id);
    if (record) {
      record.data.lastUsedAt = new Date();
      record.updatedAt = new Date();
    }
  }

  async deactivateApiKey(id: string): Promise<boolean> {
    const record = this.apiKeys.get(id);
    if (!record) return false;

    record.data.isActive = false;
    record.updatedAt = new Date();
    return true;
  }

  // Template operations
  async createTemplate(data: {
    clientId: string;
    name: string;
    channel: string;
    subject?: string;
    content: string;
    variables?: string[];
  }): Promise<Template> {
    const id = uuidv4();
    const now = new Date();

    const template: Template = {
      id,
      clientId: data.clientId,
      name: data.name,
      channel: data.channel,
      content: data.content,
      variables: data.variables || [],
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    this.templates.set(id, {
      id,
      data: { ...template, subject: data.subject },
      createdAt: now,
      updatedAt: now
    });

    this.enforceLimit(this.templates);
    return template;
  }

  async findTemplateById(id: string): Promise<Template | null> {
    const record = this.templates.get(id);
    if (!record || !record.data.isActive) return null;
    return record.data;
  }

  async findTemplateByClientAndName(clientId: string, name: string, channel: string): Promise<Template | null> {
    for (const record of this.templates.values()) {
      if (record.data.clientId === clientId &&
          record.data.name === name &&
          record.data.channel === channel &&
          record.data.isActive) {
        return record.data;
      }
    }
    return null;
  }

  async findTemplatesByClient(clientId: string): Promise<Template[]> {
    const results: Template[] = [];
    for (const record of this.templates.values()) {
      if (record.data.clientId === clientId && record.data.isActive) {
        results.push(record.data);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateTemplate(id: string, data: Partial<Template>): Promise<Template | null> {
    const record = this.templates.get(id);
    if (!record) return null;

    record.data = { ...record.data, ...data };
    record.updatedAt = new Date();

    return record.data;
  }

  async deactivateTemplate(id: string): Promise<boolean> {
    const record = this.templates.get(id);
    if (!record) return false;

    record.data.isActive = false;
    record.updatedAt = new Date();
    return true;
  }

  // Notification operations
  async createNotification(data: {
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
  }): Promise<Notification> {
    const id = uuidv4();
    const now = new Date();

    const notification: Notification = {
      id,
      clientId: data.clientId,
      channel: data.channel,
      recipient: data.recipient,
      message: data.message,
      templateId: data.templateId,
      templateData: data.templateData,
      priority: data.priority || 'medium',
      status: 'pending',
      scheduledAt: data.scheduledAt,
      sentAt: null,
      failedAt: null,
      errorMessage: null,
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now
    };

    this.notifications.set(id, {
      id,
      data: { ...notification, subject: data.subject },
      createdAt: now,
      updatedAt: now
    });

    this.enforceLimit(this.notifications);
    return notification;
  }

  async findNotificationById(id: string): Promise<Notification | null> {
    const record = this.notifications.get(id);
    if (!record) return null;
    return record.data;
  }

  async findPendingNotifications(limit: number = 100): Promise<Notification[]> {
    const results: Notification[] = [];
    const now = new Date();

    for (const record of this.notifications.values()) {
      const notification = record.data;
      if (['pending', 'queued'].includes(notification.status) &&
          (!notification.scheduledAt || notification.scheduledAt <= now)) {
        results.push(notification);
      }
    }

    // Sort by priority and creation date
    results.sort((a, b) => {
      const priorityOrder = { high: 1, medium: 5, low: 10 };
      const aPriority = priorityOrder[a.priority] || 5;
      const bPriority = priorityOrder[b.priority] || 5;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return results.slice(0, limit);
  }

  async findNotificationsByClient(clientId: string, options: StorageOptions = {}): Promise<StorageResult<Notification>> {
    const { limit = 50, offset = 0 } = options;
    const results: Notification[] = [];

    for (const record of this.notifications.values()) {
      if (record.data.clientId === clientId) {
        results.push(record.data);
      }
    }

    // Sort by creation date (newest first)
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = results.length;
    const data = results.slice(offset, offset + limit);

    return { data, total };
  }

  async updateNotificationStatus(
    id: string,
    status: Notification['status'],
    errorMessage?: string,
    externalId?: string
  ): Promise<Notification | null> {
    const record = this.notifications.get(id);
    if (!record) return null;

    record.data.status = status;
    record.updatedAt = new Date();

    if (status === 'sent') {
      record.data.sentAt = new Date();
    } else if (status === 'failed') {
      record.data.failedAt = new Date();
      if (errorMessage) {
        record.data.errorMessage = errorMessage;
      }
    }

    if (externalId) {
      record.data.externalId = externalId;
    }

    return record.data;
  }

  async incrementNotificationRetryCount(id: string): Promise<Notification | null> {
    const record = this.notifications.get(id);
    if (!record) return null;

    record.data.retryCount = (record.data.retryCount || 0) + 1;
    record.updatedAt = new Date();

    return record.data;
  }

  async getNotificationStats(clientId?: string, fromDate?: Date, toDate?: Date): Promise<any[]> {
    const stats = new Map<string, any>();

    for (const record of this.notifications.values()) {
      const notification = record.data;

      // Apply filters
      if (clientId && notification.clientId !== clientId) continue;
      if (fromDate && notification.createdAt < fromDate) continue;
      if (toDate && notification.createdAt > toDate) continue;

      const key = `${notification.status}:${notification.channel}`;
      if (!stats.has(key)) {
        stats.set(key, {
          status: notification.status,
          channel: notification.channel,
          count: 0,
          avg_processing_time: 0
        });
      }

      const stat = stats.get(key);
      stat.count++;

      // Calculate processing time if completed
      if (notification.sentAt || notification.failedAt) {
        const endTime = notification.sentAt || notification.failedAt;
        const processingTime = (endTime!.getTime() - notification.createdAt.getTime()) / 1000;
        stat.avg_processing_time = (stat.avg_processing_time * (stat.count - 1) + processingTime) / stat.count;
      }
    }

    return Array.from(stats.values());
  }

  // Delivery log operations
  async createDeliveryLog(data: {
    notificationId: string;
    attempt: number;
    status: 'success' | 'failed' | 'retry' | 'timeout';
    responseData?: Record<string, any>;
    errorMessage?: string;
    processingTimeMs?: number;
  }): Promise<DeliveryLog> {
    const id = uuidv4();
    const now = new Date();

    const deliveryLog: DeliveryLog = {
      id,
      notificationId: data.notificationId,
      attempt: data.attempt,
      status: data.status,
      errorMessage: data.errorMessage,
      responseData: data.responseData,
      timestamp: now
    };

    this.deliveryLogs.set(id, {
      id,
      data: { ...deliveryLog, processingTimeMs: data.processingTimeMs },
      createdAt: now,
      updatedAt: now
    });

    this.enforceLimit(this.deliveryLogs);
    return deliveryLog;
  }

  async findDeliveryLogsByNotificationId(notificationId: string): Promise<DeliveryLog[]> {
    const results: DeliveryLog[] = [];

    for (const record of this.deliveryLogs.values()) {
      if (record.data.notificationId === notificationId) {
        results.push(record.data);
      }
    }

    return results.sort((a, b) => a.attempt - b.attempt);
  }

  // Connection management
  async connect(): Promise<void> {
    // Nothing to do for in-memory storage
    logger.info('In-memory storage adapter connected');
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all data
    this.clients.clear();
    this.apiKeys.clear();
    this.templates.clear();
    this.notifications.clear();
    this.deliveryLogs.clear();

    logger.info('In-memory storage adapter disconnected');
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async cleanup(): Promise<void> {
    this.performCleanup();
  }

  async getStorageStats(): Promise<{
    notifications: number;
    clients: number;
    templates: number;
    deliveryLogs: number;
    memoryUsage: number;
  }> {
    return {
      notifications: this.notifications.size,
      clients: this.clients.size,
      templates: this.templates.size,
      deliveryLogs: this.deliveryLogs.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  // Private helper methods
  private mapClientRecord(record: InMemoryRecord): Client {
    return {
      id: record.data.id,
      name: record.data.name,
      apiKeyHash: record.data.apiKeyHash,
      rateLimit: record.data.rateLimit,
      isActive: record.data.isActive,
      createdAt: record.data.createdAt,
      updatedAt: record.data.updatedAt
    };
  }

  private isNotExpired(record: InMemoryRecord): boolean {
    return !record.expiresAt || record.expiresAt > new Date();
  }

  private enforceLimit(collection: Map<string, InMemoryRecord>): void {
    if (collection.size <= this.maxRecords) return;

    // Remove oldest records
    const records = Array.from(collection.entries());
    records.sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());

    const toRemove = records.slice(0, collection.size - this.maxRecords);
    for (const [id] of toRemove) {
      collection.delete(id);
    }

    logger.warn(`Enforced memory limit: removed ${toRemove.length} old records from collection`);
  }

  private performCleanup(): void {
    const now = new Date();
    let cleaned = 0;

    // Clean expired API keys
    for (const [id, record] of this.apiKeys.entries()) {
      if (record.expiresAt && record.expiresAt <= now) {
        this.apiKeys.delete(id);
        cleaned++;
      }
    }

    // Clean old completed notifications (older than 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    for (const [id, record] of this.notifications.entries()) {
      if (['sent', 'failed', 'cancelled'].includes(record.data.status) &&
          record.updatedAt < sevenDaysAgo) {
        this.notifications.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Memory cleanup: removed ${cleaned} expired/old records`);
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation in bytes
    const jsonSize = (obj: any) => JSON.stringify(obj).length * 2; // Rough estimate

    let total = 0;
    for (const record of this.clients.values()) total += jsonSize(record);
    for (const record of this.apiKeys.values()) total += jsonSize(record);
    for (const record of this.templates.values()) total += jsonSize(record);
    for (const record of this.notifications.values()) total += jsonSize(record);
    for (const record of this.deliveryLogs.values()) total += jsonSize(record);

    return total;
  }
}