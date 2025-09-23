import Queue from 'bull';
import { isRedisEnabled } from '../database/redis';
import { logger, logQueue } from '../monitoring/logger';
import { metrics } from '../monitoring/metrics';
import { IQueue, QueueJob, IQueueManager } from './interface';
import { BullQueueAdapter, InMemoryQueueAdapter } from './adapters';
import { InMemoryQueue } from './inMemoryQueue';

// Queue instances
let notificationQueue: IQueue | null = null;
let templateQueue: IQueue | null = null;

export const initializeQueue = async (): Promise<void> => {
  try {
    if (isRedisEnabled()) {
      // Initialize Redis-based queues
      await initializeRedisQueues();
      logger.info('Queue system initialized with Redis backend');
    } else {
      // Initialize in-memory queues
      initializeInMemoryQueues();
      logger.info('Queue system initialized with in-memory backend');
      logger.warn('Running with in-memory queues - jobs will not persist across restarts');
    }

    // Setup event handlers and processors
    setupQueueEventHandlers();
    setupJobProcessors();

    logger.info('Queue system initialization completed successfully');
  } catch (error) {
    logger.error('Failed to initialize queue system:', error);
    throw error;
  }
};

const initializeRedisQueues = async (): Promise<void> => {
  const redisConfig = {
    redis: {
      port: parseInt(process.env.REDIS_PORT || '6379'),
      host: process.env.REDIS_HOST || 'localhost',
      password: process.env.REDIS_PASSWORD || undefined
    }
  };

  const bullNotificationQueue = new Queue('notification processing', redisConfig);
  const bullTemplateQueue = new Queue('template rendering', redisConfig);

  notificationQueue = new BullQueueAdapter(bullNotificationQueue);
  templateQueue = new BullQueueAdapter(bullTemplateQueue);
};

const initializeInMemoryQueues = (): void => {
  const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '5');

  const inMemoryNotificationQueue = new InMemoryQueue('notification processing', { concurrency });
  const inMemoryTemplateQueue = new InMemoryQueue('template rendering', { concurrency });

  notificationQueue = new InMemoryQueueAdapter(inMemoryNotificationQueue);
  templateQueue = new InMemoryQueueAdapter(inMemoryTemplateQueue);
};

const setupQueueEventHandlers = (): void => {
  if (!notificationQueue || !templateQueue) return;

  // Notification queue events
  notificationQueue.on('completed', (job: QueueJob) => {
    logQueue('completed', job.id.toString(), 'notification', {
      processingTime: Date.now() - job.timestamp
    });
    metrics.recordNotificationSent(job.data.channel, 'success');
  });

  notificationQueue.on('failed', (job: QueueJob, err: Error) => {
    logQueue('failed', job.id.toString(), 'notification', {
      error: err.message,
      attemptsMade: job.attemptsMade,
      attemptsTotal: job.opts?.attempts || 3
    });
    metrics.recordNotificationSent(job.data.channel, 'failed');
  });

  notificationQueue.on('stalled', (job: QueueJob) => {
    logQueue('stalled', job.id.toString(), 'notification');
  });

  // Template queue events
  templateQueue.on('completed', (job: QueueJob) => {
    logQueue('completed', job.id.toString(), 'template');
    if (job.data.templateName) {
      metrics.recordTemplateRender(job.data.templateName, 'success');
    }
  });

  templateQueue.on('failed', (job: QueueJob, err: Error) => {
    logQueue('failed', job.id.toString(), 'template', { error: err.message });
    if (job.data.templateName) {
      metrics.recordTemplateRender(job.data.templateName, 'failed');
    }
  });
};

const setupJobProcessors = (): void => {
  if (!notificationQueue || !templateQueue) return;

  // Process notification jobs
  notificationQueue.process('send_notification', parseInt(process.env.QUEUE_CONCURRENCY || '5'), async (job: QueueJob) => {
    const { notificationId, channel, recipient, message, templateData } = job.data;

    logQueue('processing', job.id.toString(), 'notification', {
      notificationId,
      channel,
      recipient
    });

    try {
      // Import models here to avoid circular dependency
      const { NotificationModel, DeliveryLogModel } = await import('../models');

      // Update notification status to processing
      await NotificationModel.updateStatus(notificationId, 'processing');

      // Send notification based on channel
      let result;
      if (channel === 'telegram') {
        const { TelegramChannel } = await import('../channels/telegram');
        const telegramChannel = new TelegramChannel({
          botToken: process.env.TELEGRAM_BOT_TOKEN || ''
        });
        result = await telegramChannel.sendMessage({
          chatId: recipient,
          message: message
        });
      } else {
        throw new Error(`Unsupported channel: ${channel}`);
      }

      if (result.success) {
        // Update notification status to sent
        await NotificationModel.updateStatus(notificationId, 'sent', undefined, result.messageId?.toString());

        // Log successful delivery
        await DeliveryLogModel.create({
          notificationId,
          attempt: 1,
          status: 'success',
          responseData: result.messageId ? { messageId: result.messageId } : undefined,
          processingTimeMs: Date.now() - job.timestamp
        });

        logger.info(`Notification ${notificationId} sent successfully via ${channel}`);
        return { success: true, notificationId, messageId: result.messageId };
      } else {
        throw new Error(result.error || 'Failed to send notification');
      }
    } catch (error) {
      logger.error(`Failed to send notification ${notificationId}:`, error);

      // Import models for error handling
      const { NotificationModel, DeliveryLogModel } = await import('../models');

      // Update notification status to failed
      await NotificationModel.updateStatus(notificationId, 'failed', (error as Error).message);

      // Log failed delivery
      await DeliveryLogModel.create({
        notificationId,
        attempt: 1,
        status: 'failed',
        errorMessage: (error as Error).message,
        processingTimeMs: Date.now() - job.timestamp
      });

      throw error;
    }
  });

  // Process template rendering jobs
  templateQueue.process('render_template', parseInt(process.env.QUEUE_CONCURRENCY || '5'), async (job: QueueJob) => {
    const { templateId, data } = job.data;

    logQueue('processing', job.id.toString(), 'template', { templateId });

    // TODO: Implement template rendering logic
    // This will be implemented when we create the template engine

    return { success: true, templateId };
  });
};

// Queue management functions
export const addNotificationJob = async (
  notificationId: string,
  channel: string,
  recipient: string,
  message: string,
  options: {
    priority?: 'high' | 'medium' | 'low';
    delay?: number;
    attempts?: number;
  } = {}
): Promise<QueueJob> => {
  if (!notificationQueue) {
    throw new Error('Notification queue not initialized');
  }

  const priority = getPriorityValue(options.priority || 'medium');

  const job = await notificationQueue.add('send_notification', {
    notificationId,
    channel,
    recipient,
    message
  }, {
    priority,
    delay: options.delay || 0,
    attempts: options.attempts || parseInt(process.env.QUEUE_ATTEMPTS || '3'),
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.QUEUE_DELAY || '5000')
    },
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 20 // Keep last 20 failed jobs
  });

  logQueue('added', job.id.toString(), 'notification', {
    notificationId,
    channel,
    priority: options.priority
  });

  return job;
};

export const addTemplateJob = async (
  templateId: string,
  data: Record<string, any>
): Promise<QueueJob> => {
  if (!templateQueue) {
    throw new Error('Template queue not initialized');
  }

  const job = await templateQueue.add('render_template', {
    templateId,
    data
  });

  logQueue('added', job.id.toString(), 'template', { templateId });
  return job;
};

// Utility functions
const getPriorityValue = (priority: 'high' | 'medium' | 'low'): number => {
  switch (priority) {
    case 'high': return 1;
    case 'medium': return 5;
    case 'low': return 10;
    default: return 5;
  }
};

export const getQueueStats = async (): Promise<any> => {
  if (!notificationQueue || !templateQueue) {
    return null;
  }

  const [notificationStats, templateStats] = await Promise.all([
    notificationQueue.getJobCounts(),
    templateQueue.getJobCounts()
  ]);

  return {
    notification: notificationStats,
    template: templateStats
  };
};

export const getQueues = () => {
  return {
    notificationQueue,
    templateQueue
  };
};

// Health check
export const checkQueueHealth = async (): Promise<boolean> => {
  try {
    if (!notificationQueue || !templateQueue) {
      return false;
    }

    // Check if queues are healthy
    return notificationQueue.isHealthy() && templateQueue.isHealthy();
  } catch (error) {
    logger.error('Queue health check failed:', error);
    return false;
  }
};