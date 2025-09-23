import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { NotificationModel, TemplateModel, DeliveryLogModel } from '../../database/models';
import { addNotificationJob } from '../../queue/manager';
import { TelegramChannel } from '../../channels/telegram';
import { TemplateEngine } from '../../templates/engine';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { asyncHandler } from '../middleware/errorHandler';
import { logNotification, logger } from '../../monitoring/logger';
import { AuthenticatedRequest, NotificationRequest, BatchNotificationRequest } from '../../types';

export const sendNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  const {
    channel,
    recipient,
    subject,
    message,
    template,
    data,
    priority = 'medium',
    scheduledAt,
    metadata
  }: NotificationRequest = req.body;

  try {
    // Create notification record
    const notification = await NotificationModel.create({
      clientId: req.client.id,
      channel,
      recipient,
      subject,
      message,
      templateId: template,
      templateData: data,
      priority,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      metadata
    });

    // Queue the notification for processing
    const job = await addNotificationJob(
      notification.id,
      channel,
      recipient,
      message || '',
      {
        priority,
        delay: scheduledAt ? new Date(scheduledAt).getTime() - Date.now() : 0,
        attempts: 3
      }
    );

    logNotification('created', notification.id, channel, {
      clientId: req.client.id,
      priority,
      scheduled: !!scheduledAt,
      hasTemplate: !!template
    });

    res.status(201).json({
      id: notification.id,
      status: 'queued',
      channel,
      recipient,
      priority,
      scheduledAt: notification.scheduledAt,
      createdAt: notification.createdAt,
      message: 'Notification queued successfully'
    });

  } catch (error) {
    logger.error('Failed to send notification:', error);
    throw new Error('Failed to queue notification');
  }
});

export const sendBatchNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  const {
    channel,
    template,
    notifications,
    options = {}
  }: BatchNotificationRequest = req.body;

  try {
    const results = [];
    const { batchSize = 10, delayBetween = 1000, deduplicate = false } = options;

    // Process notifications in batches
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (notif) => {
          try {
            // Create notification record
            const notification = await NotificationModel.create({
              clientId: req.client!.id,
              channel,
              recipient: notif.recipient,
              subject: notif.subject,
              message: notif.message,
              templateId: template,
              templateData: notif.data,
              priority: 'medium',
              metadata: notif.metadata
            });

            // Queue the notification
            await addNotificationJob(
              notification.id,
              channel,
              notif.recipient,
              notif.message || '',
              { priority: 'medium' }
            );

            return {
              recipient: notif.recipient,
              id: notification.id,
              status: 'queued'
            };

          } catch (error) {
            logger.error('Failed to create batch notification:', error);
            return {
              recipient: notif.recipient,
              status: 'error',
              error: (error as Error).message
            };
          }
        })
      );

      results.push(...batchResults);

      // Add delay between batches
      if (i + batchSize < notifications.length && delayBetween > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetween));
      }
    }

    const successful = results.filter(r => r.status === 'queued').length;
    const failed = results.filter(r => r.status === 'error').length;

    logNotification('batch_created', 'batch', channel, {
      clientId: req.client.id,
      total: notifications.length,
      successful,
      failed,
      batchSize,
      hasTemplate: !!template
    });

    res.status(201).json({
      message: 'Batch notifications processed',
      summary: {
        total: notifications.length,
        successful,
        failed
      },
      results
    });

  } catch (error) {
    logger.error('Failed to send batch notifications:', error);
    throw new Error('Failed to process batch notifications');
  }
});

export const scheduleNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  const {
    channel,
    recipient,
    scheduledAt,
    subject,
    message,
    template,
    data,
    priority = 'medium',
    metadata
  } = req.body;

  try {
    const scheduledDate = new Date(scheduledAt);
    const delay = scheduledDate.getTime() - Date.now();

    if (delay <= 0) {
      throw new ValidationError('Scheduled time must be in the future');
    }

    // Create notification record
    const notification = await NotificationModel.create({
      clientId: req.client.id,
      channel,
      recipient,
      subject,
      message,
      templateId: template,
      templateData: data,
      priority,
      scheduledAt: scheduledDate,
      metadata
    });

    // Queue with delay
    await addNotificationJob(
      notification.id,
      channel,
      recipient,
      message || '',
      { priority, delay }
    );

    logNotification('scheduled', notification.id, channel, {
      clientId: req.client.id,
      scheduledAt: scheduledDate.toISOString(),
      delay: `${Math.round(delay / 1000)}s`
    });

    res.status(201).json({
      id: notification.id,
      status: 'scheduled',
      scheduledAt: scheduledDate,
      message: 'Notification scheduled successfully'
    });

  } catch (error) {
    logger.error('Failed to schedule notification:', error);
    throw error;
  }
});

export const getNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  const { id } = req.params;

  const notification = await NotificationModel.findById(id);
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  // Check if notification belongs to the client
  if (notification.clientId !== req.client.id) {
    throw new NotFoundError('Notification not found');
  }

  // Get delivery logs
  const deliveryLogs = await DeliveryLogModel.findByNotificationId(id);

  res.json({
    ...notification,
    deliveryLogs
  });
});

export const getNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  const {
    status,
    channel,
    priority,
    from,
    to,
    limit = 50,
    offset = 0
  } = req.query;

  try {
    // Get notifications for the client
    const notifications = await NotificationModel.findByClient(
      req.client.id,
      Number(limit),
      Number(offset)
    );

    // Apply additional filters
    let filteredNotifications = notifications;

    if (status) {
      filteredNotifications = filteredNotifications.filter(n => n.status === status);
    }

    if (channel) {
      filteredNotifications = filteredNotifications.filter(n => n.channel === channel);
    }

    if (priority) {
      filteredNotifications = filteredNotifications.filter(n => n.priority === priority);
    }

    if (from) {
      const fromDate = new Date(from as string);
      filteredNotifications = filteredNotifications.filter(n => n.createdAt >= fromDate);
    }

    if (to) {
      const toDate = new Date(to as string);
      filteredNotifications = filteredNotifications.filter(n => n.createdAt <= toDate);
    }

    res.json({
      notifications: filteredNotifications,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: filteredNotifications.length
      }
    });

  } catch (error) {
    logger.error('Failed to get notifications:', error);
    throw new Error('Failed to retrieve notifications');
  }
});

export const cancelNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  const { id } = req.params;

  const notification = await NotificationModel.findById(id);
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  // Check if notification belongs to the client
  if (notification.clientId !== req.client.id) {
    throw new NotFoundError('Notification not found');
  }

  // Can only cancel pending or queued notifications
  if (!['pending', 'queued'].includes(notification.status)) {
    throw new ValidationError(`Cannot cancel notification with status: ${notification.status}`);
  }

  try {
    // Update notification status
    await NotificationModel.updateStatus(id, 'cancelled');

    // TODO: Remove from queue if possible

    logNotification('cancelled', id, notification.channel, {
      clientId: req.client.id
    });

    res.json({
      id,
      status: 'cancelled',
      message: 'Notification cancelled successfully'
    });

  } catch (error) {
    logger.error('Failed to cancel notification:', error);
    throw new Error('Failed to cancel notification');
  }
});

export const getNotificationHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  const { id } = req.params;

  const notification = await NotificationModel.findById(id);
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  // Check if notification belongs to the client
  if (notification.clientId !== req.client.id) {
    throw new NotFoundError('Notification not found');
  }

  const deliveryLogs = await DeliveryLogModel.findByNotificationId(id);

  res.json({
    notificationId: id,
    status: notification.status,
    attempts: notification.retryCount + 1,
    maxRetries: notification.maxRetries,
    history: deliveryLogs.map(log => ({
      attempt: log.attempt,
      status: log.status,
      timestamp: log.timestamp,
      errorMessage: log.errorMessage,
      responseData: log.responseData
    }))
  });
});

export const getNotificationStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  const { from, to } = req.query;

  try {
    const fromDate = from ? new Date(from as string) : undefined;
    const toDate = to ? new Date(to as string) : undefined;

    const stats = await NotificationModel.getStats(req.client.id, fromDate, toDate);

    // Process stats into a more useful format
    const processedStats = {
      summary: {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        successRate: 0
      },
      byChannel: {} as Record<string, any>,
      byStatus: {} as Record<string, number>
    };

    stats.forEach((stat: any) => {
      const count = parseInt(stat.count);
      processedStats.summary.total += count;

      // By status
      if (!processedStats.byStatus[stat.status]) {
        processedStats.byStatus[stat.status] = 0;
      }
      processedStats.byStatus[stat.status] += count;

      // By channel
      if (!processedStats.byChannel[stat.channel]) {
        processedStats.byChannel[stat.channel] = {
          total: 0,
          sent: 0,
          failed: 0,
          pending: 0
        };
      }
      processedStats.byChannel[stat.channel].total += count;
      processedStats.byChannel[stat.channel][stat.status] = count;

      // Update summary
      if (stat.status === 'sent') {
        processedStats.summary.sent += count;
      } else if (stat.status === 'failed') {
        processedStats.summary.failed += count;
      } else if (['pending', 'queued', 'processing'].includes(stat.status)) {
        processedStats.summary.pending += count;
      }
    });

    // Calculate success rate
    const completed = processedStats.summary.sent + processedStats.summary.failed;
    if (completed > 0) {
      processedStats.summary.successRate = Math.round(
        (processedStats.summary.sent / completed) * 100
      );
    }

    res.json(processedStats);

  } catch (error) {
    logger.error('Failed to get notification stats:', error);
    throw new Error('Failed to retrieve notification statistics');
  }
});