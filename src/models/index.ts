import { getStorage } from '../storage/manager';
import { Client, Notification, Template, DeliveryLog, ApiKeyData } from '../types';
import { StorageOptions, StorageResult } from '../storage/adapter';

// Client operations
export class ClientModel {
  static async create(data: {
    name: string;
    email?: string;
    rateLimit?: number;
  }): Promise<Client> {
    const storage = getStorage();
    return await storage.createClient(data);
  }

  static async findById(id: string): Promise<Client | null> {
    const storage = getStorage();
    return await storage.findClientById(id);
  }

  static async findByEmail(email: string): Promise<Client | null> {
    const storage = getStorage();
    return await storage.findClientByEmail(email);
  }

  static async update(id: string, data: Partial<Client>): Promise<Client | null> {
    const storage = getStorage();
    return await storage.updateClient(id, data);
  }

  static async deactivate(id: string): Promise<boolean> {
    const storage = getStorage();
    return await storage.deactivateClient(id);
  }
}

// API Key operations
export class ApiKeyModel {
  static async create(data: {
    clientId: string;
    keyHash: string;
    keyPrefix: string;
    name?: string;
    expiresAt?: Date;
  }): Promise<ApiKeyData> {
    const storage = getStorage();
    return await storage.createApiKey(data);
  }

  static async findByPrefix(prefix: string): Promise<ApiKeyData | null> {
    const storage = getStorage();
    return await storage.findApiKeyByPrefix(prefix);
  }

  static async findByClientId(clientId: string): Promise<ApiKeyData[]> {
    const storage = getStorage();
    return await storage.findApiKeysByClientId(clientId);
  }

  static async updateLastUsed(id: string): Promise<void> {
    const storage = getStorage();
    return await storage.updateApiKeyLastUsed(id);
  }

  static async deactivate(id: string): Promise<boolean> {
    const storage = getStorage();
    return await storage.deactivateApiKey(id);
  }
}

// Template operations
export class TemplateModel {
  static async create(data: {
    clientId: string;
    name: string;
    channel: string;
    subject?: string;
    content: string;
    variables?: string[];
  }): Promise<Template> {
    const storage = getStorage();
    return await storage.createTemplate(data);
  }

  static async findById(id: string): Promise<Template | null> {
    const storage = getStorage();
    return await storage.findTemplateById(id);
  }

  static async findByClientAndName(clientId: string, name: string, channel: string): Promise<Template | null> {
    const storage = getStorage();
    return await storage.findTemplateByClientAndName(clientId, name, channel);
  }

  static async findByClient(clientId: string): Promise<Template[]> {
    const storage = getStorage();
    return await storage.findTemplatesByClient(clientId);
  }

  static async update(id: string, data: Partial<Template>): Promise<Template | null> {
    const storage = getStorage();
    return await storage.updateTemplate(id, data);
  }

  static async deactivate(id: string): Promise<boolean> {
    const storage = getStorage();
    return await storage.deactivateTemplate(id);
  }
}

// Notification operations
export class NotificationModel {
  static async create(data: {
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
    const storage = getStorage();
    return await storage.createNotification(data);
  }

  static async findById(id: string): Promise<Notification | null> {
    const storage = getStorage();
    return await storage.findNotificationById(id);
  }

  static async findPending(limit: number = 100): Promise<Notification[]> {
    const storage = getStorage();
    return await storage.findPendingNotifications(limit);
  }

  static async findByClient(clientId: string, limit: number = 50, offset: number = 0): Promise<Notification[]> {
    const storage = getStorage();
    const result = await storage.findNotificationsByClient(clientId, { limit, offset });
    return result.data;
  }

  static async findByClientWithTotal(clientId: string, limit: number = 50, offset: number = 0): Promise<StorageResult<Notification>> {
    const storage = getStorage();
    return await storage.findNotificationsByClient(clientId, { limit, offset });
  }

  static async updateStatus(
    id: string,
    status: Notification['status'],
    errorMessage?: string,
    externalId?: string
  ): Promise<Notification | null> {
    const storage = getStorage();
    return await storage.updateNotificationStatus(id, status, errorMessage, externalId);
  }

  static async incrementRetryCount(id: string): Promise<Notification | null> {
    const storage = getStorage();
    return await storage.incrementNotificationRetryCount(id);
  }

  static async getStats(clientId?: string, fromDate?: Date, toDate?: Date): Promise<any[]> {
    const storage = getStorage();
    return await storage.getNotificationStats(clientId, fromDate, toDate);
  }
}

// Delivery Log operations
export class DeliveryLogModel {
  static async create(data: {
    notificationId: string;
    attempt: number;
    status: 'success' | 'failed' | 'retry' | 'timeout';
    responseData?: Record<string, any>;
    errorMessage?: string;
    processingTimeMs?: number;
  }): Promise<DeliveryLog> {
    const storage = getStorage();
    return await storage.createDeliveryLog(data);
  }

  static async findByNotificationId(notificationId: string): Promise<DeliveryLog[]> {
    const storage = getStorage();
    return await storage.findDeliveryLogsByNotificationId(notificationId);
  }
}