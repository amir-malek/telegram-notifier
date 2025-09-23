import { query, withTransaction } from './connection';
import { Client, Notification, Template, Channel, DeliveryLog, ApiKeyData } from '../types';
import { logger } from '../monitoring/logger';

// Client operations
export class ClientModel {
  static async create(data: {
    name: string;
    email?: string;
    rateLimit?: number;
  }): Promise<Client> {
    const result = await query(
      `INSERT INTO clients (name, email, rate_limit)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.name, data.email, data.rateLimit || 100]
    );

    return this.mapRow(result.rows[0]);
  }

  static async findById(id: string): Promise<Client | null> {
    const result = await query(
      'SELECT * FROM clients WHERE id = $1 AND is_active = true',
      [id]
    );

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  static async findByEmail(email: string): Promise<Client | null> {
    const result = await query(
      'SELECT * FROM clients WHERE email = $1 AND is_active = true',
      [email]
    );

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  static async update(id: string, data: Partial<Client>): Promise<Client | null> {
    const setClause = Object.keys(data)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [id, ...Object.values(data)];

    const result = await query(
      `UPDATE clients SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  static async deactivate(id: string): Promise<boolean> {
    const result = await query(
      'UPDATE clients SET is_active = false WHERE id = $1',
      [id]
    );

    return result.rowCount > 0;
  }

  private static mapRow(row: any): Client {
    return {
      id: row.id,
      name: row.name,
      apiKeyHash: '', // Not exposed
      rateLimit: row.rate_limit,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
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
    const result = await query(
      `INSERT INTO api_keys (client_id, key_hash, key_prefix, name, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.clientId, data.keyHash, data.keyPrefix, data.name, data.expiresAt]
    );

    return this.mapRow(result.rows[0]);
  }

  static async findByPrefix(prefix: string): Promise<ApiKeyData | null> {
    const result = await query(
      `SELECT ak.*, c.id as client_id, c.name as client_name
       FROM api_keys ak
       JOIN clients c ON ak.client_id = c.id
       WHERE ak.key_prefix = $1 AND ak.is_active = true AND c.is_active = true`,
      [prefix]
    );

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  static async findByClientId(clientId: string): Promise<ApiKeyData[]> {
    const result = await query(
      'SELECT * FROM api_keys WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId]
    );

    return result.rows.map(this.mapRow);
  }

  static async updateLastUsed(id: string): Promise<void> {
    await query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [id]
    );
  }

  static async deactivate(id: string): Promise<boolean> {
    const result = await query(
      'UPDATE api_keys SET is_active = false WHERE id = $1',
      [id]
    );

    return result.rowCount > 0;
  }

  private static mapRow(row: any): ApiKeyData {
    return {
      keyId: row.id,
      clientId: row.client_id,
      hashedKey: row.key_hash,
      prefix: row.key_prefix,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      isActive: row.is_active
    };
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
    const result = await query(
      `INSERT INTO templates (client_id, name, channel, subject, content, variables)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.clientId,
        data.name,
        data.channel,
        data.subject,
        data.content,
        JSON.stringify(data.variables || [])
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  static async findById(id: string): Promise<Template | null> {
    const result = await query(
      'SELECT * FROM templates WHERE id = $1 AND is_active = true',
      [id]
    );

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  static async findByClientAndName(clientId: string, name: string, channel: string): Promise<Template | null> {
    const result = await query(
      'SELECT * FROM templates WHERE client_id = $1 AND name = $2 AND channel = $3 AND is_active = true',
      [clientId, name, channel]
    );

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  static async findByClient(clientId: string): Promise<Template[]> {
    const result = await query(
      'SELECT * FROM templates WHERE client_id = $1 AND is_active = true ORDER BY created_at DESC',
      [clientId]
    );

    return result.rows.map(this.mapRow);
  }

  static async update(id: string, data: Partial<Template>): Promise<Template | null> {
    const updateData = { ...data };
    delete updateData.id;
    delete updateData.clientId;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const setClause = Object.keys(updateData)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [id, ...Object.values(updateData)];

    const result = await query(
      `UPDATE templates SET ${setClause}, version = version + 1 WHERE id = $1 RETURNING *`,
      values
    );

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  static async deactivate(id: string): Promise<boolean> {
    const result = await query(
      'UPDATE templates SET is_active = false WHERE id = $1',
      [id]
    );

    return result.rowCount > 0;
  }

  private static mapRow(row: any): Template {
    return {
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      channel: row.channel,
      content: row.content,
      variables: Array.isArray(row.variables) ? row.variables : JSON.parse(row.variables || '[]'),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
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
    const result = await query(
      `INSERT INTO notifications (
        client_id, channel, recipient, subject, message,
        template_id, template_data, priority, scheduled_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        data.clientId,
        data.channel,
        data.recipient,
        data.subject,
        data.message,
        data.templateId,
        data.templateData ? JSON.stringify(data.templateData) : null,
        data.priority || 'medium',
        data.scheduledAt,
        data.metadata ? JSON.stringify(data.metadata) : null
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  static async findById(id: string): Promise<Notification | null> {
    const result = await query(
      'SELECT * FROM notifications WHERE id = $1',
      [id]
    );

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  static async findPending(limit: number = 100): Promise<Notification[]> {
    const result = await query(
      `SELECT * FROM notifications
       WHERE status IN ('pending', 'queued')
       AND (scheduled_at IS NULL OR scheduled_at <= NOW())
       ORDER BY priority = 'high' DESC, priority = 'medium' DESC, created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(this.mapRow);
  }

  static async findByClient(clientId: string, limit: number = 50, offset: number = 0): Promise<Notification[]> {
    const result = await query(
      `SELECT * FROM notifications
       WHERE client_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [clientId, limit, offset]
    );

    return result.rows.map(this.mapRow);
  }

  static async updateStatus(
    id: string,
    status: Notification['status'],
    errorMessage?: string,
    externalId?: string
  ): Promise<Notification | null> {
    const updateFields: string[] = ['status = $2'];
    const values: any[] = [id, status];

    if (status === 'sent') {
      updateFields.push('sent_at = NOW()');
    } else if (status === 'failed') {
      updateFields.push('failed_at = NOW()');
      if (errorMessage) {
        updateFields.push(`error_message = $${values.length + 1}`);
        values.push(errorMessage);
      }
    }

    if (externalId) {
      updateFields.push(`external_id = $${values.length + 1}`);
      values.push(externalId);
    }

    const result = await query(
      `UPDATE notifications SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  static async incrementRetryCount(id: string): Promise<Notification | null> {
    const result = await query(
      'UPDATE notifications SET retry_count = retry_count + 1 WHERE id = $1 RETURNING *',
      [id]
    );

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  static async getStats(clientId?: string, fromDate?: Date, toDate?: Date): Promise<any> {
    let whereClause = '1=1';
    const values: any[] = [];

    if (clientId) {
      values.push(clientId);
      whereClause += ` AND client_id = $${values.length}`;
    }

    if (fromDate) {
      values.push(fromDate);
      whereClause += ` AND created_at >= $${values.length}`;
    }

    if (toDate) {
      values.push(toDate);
      whereClause += ` AND created_at <= $${values.length}`;
    }

    const result = await query(
      `SELECT
        status,
        channel,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (COALESCE(sent_at, failed_at) - created_at))) as avg_processing_time
       FROM notifications
       WHERE ${whereClause}
       GROUP BY status, channel
       ORDER BY status, channel`,
      values
    );

    return result.rows;
  }

  private static mapRow(row: any): Notification {
    return {
      id: row.id,
      clientId: row.client_id,
      channel: row.channel,
      recipient: row.recipient,
      message: row.message,
      templateId: row.template_id,
      templateData: row.template_data ? JSON.parse(row.template_data) : undefined,
      priority: row.priority,
      status: row.status,
      scheduledAt: row.scheduled_at,
      sentAt: row.sent_at,
      failedAt: row.failed_at,
      errorMessage: row.error_message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
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
    const result = await query(
      `INSERT INTO delivery_logs (
        notification_id, attempt, status, response_data, error_message, processing_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        data.notificationId,
        data.attempt,
        data.status,
        data.responseData ? JSON.stringify(data.responseData) : null,
        data.errorMessage,
        data.processingTimeMs
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  static async findByNotificationId(notificationId: string): Promise<DeliveryLog[]> {
    const result = await query(
      'SELECT * FROM delivery_logs WHERE notification_id = $1 ORDER BY attempt ASC',
      [notificationId]
    );

    return result.rows.map(this.mapRow);
  }

  private static mapRow(row: any): DeliveryLog {
    return {
      id: row.id,
      notificationId: row.notification_id,
      attempt: row.attempt,
      status: row.status,
      errorMessage: row.error_message,
      responseData: row.response_data ? JSON.parse(row.response_data) : undefined,
      timestamp: row.created_at
    };
  }
}