import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../monitoring/logger';
import { metrics } from '../monitoring/metrics';
import { TemplateEngine, RenderedTemplate } from '../templates/engine';
import { NotificationModel, DeliveryLogModel } from '../models';

export interface TelegramConfig {
  botToken: string;
  webhookUrl?: string;
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
}

export interface TelegramMessage {
  chatId: string | number;
  message: string;
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  replyMarkup?: any;
}

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  error?: string;
  retryAfter?: number;
}

export class TelegramChannel {
  private bot: TelegramBot | null = null;
  private config: TelegramConfig;
  private templateEngine: TemplateEngine;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.templateEngine = TemplateEngine.getInstance();
    this.initializeBot();
  }

  private initializeBot(): void {
    try {
      if (!this.config.botToken) {
        throw new Error('Telegram bot token is required');
      }

      // Initialize bot without polling to avoid conflicts in production
      this.bot = new TelegramBot(this.config.botToken, {
        polling: false,
        webHook: false
      });

      logger.info('Telegram bot initialized successfully');

      // Set up error handling
      this.bot.on('error', (error) => {
        logger.error('Telegram bot error:', error);
      });

      this.bot.on('polling_error', (error) => {
        logger.error('Telegram polling error:', error);
      });

      this.bot.on('webhook_error', (error) => {
        logger.error('Telegram webhook error:', error);
      });

    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error);
      throw error;
    }
  }

  async sendMessage(message: TelegramMessage): Promise<TelegramSendResult> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    const startTime = Date.now();

    try {
      const options: any = {
        parse_mode: message.parseMode || this.config.parseMode || 'Markdown',
        disable_web_page_preview: message.disableWebPagePreview ?? this.config.disableWebPagePreview ?? true,
        disable_notification: message.disableNotification ?? this.config.disableNotification ?? false
      };

      if (message.replyMarkup) {
        options.reply_markup = message.replyMarkup;
      }

      const result = await this.bot.sendMessage(message.chatId, message.message, options);

      const processingTime = Date.now() - startTime;

      metrics.recordNotificationProcessingTime('telegram', processingTime / 1000);

      logger.info('Telegram message sent successfully', {
        chatId: message.chatId,
        messageId: result.message_id,
        processingTime: `${processingTime}ms`
      });

      return {
        success: true,
        messageId: result.message_id
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      logger.error('Failed to send Telegram message', {
        chatId: message.chatId,
        processingTime: `${processingTime}ms`,
        error: error.message,
        code: error.code
      });

      // Handle rate limiting
      if (error.code === 429) {
        const retryAfter = error.response?.parameters?.retry_after || 60;
        return {
          success: false,
          error: 'Rate limited',
          retryAfter
        };
      }

      // Handle other specific errors
      if (error.code === 400) {
        return {
          success: false,
          error: `Bad request: ${error.message}`
        };
      }

      if (error.code === 403) {
        return {
          success: false,
          error: 'Bot was blocked by the user or chat not found'
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendNotification(notificationId: string): Promise<TelegramSendResult> {
    try {
      // Get notification from database
      const notification = await NotificationModel.findById(notificationId);
      if (!notification) {
        throw new Error('Notification not found');
      }

      let message = notification.message || '';

      // Render template if specified
      if (notification.templateId && notification.templateData) {
        const rendered = await this.renderTemplate(notification.templateId, notification.templateData);
        message = rendered.content;

        // Log template variables usage
        if (rendered.missingVariables.length > 0) {
          logger.warn('Template has missing variables', {
            notificationId,
            templateId: notification.templateId,
            missingVariables: rendered.missingVariables
          });
        }
      }

      if (!message.trim()) {
        throw new Error('No message content to send');
      }

      // Update notification status to processing
      await NotificationModel.updateStatus(notificationId, 'processing');

      // Send the message
      const result = await this.sendMessage({
        chatId: notification.recipient,
        message,
        parseMode: 'Markdown'
      });

      // Log delivery attempt
      await DeliveryLogModel.create({
        notificationId,
        attempt: (notification.retryCount || 0) + 1,
        status: result.success ? 'success' : 'failed',
        responseData: result.messageId ? { messageId: result.messageId } : undefined,
        errorMessage: result.error,
        processingTimeMs: undefined
      });

      if (result.success) {
        // Update notification as sent
        await NotificationModel.updateStatus(
          notificationId,
          'sent',
          undefined,
          result.messageId?.toString()
        );

        logger.info('Notification sent successfully', {
          notificationId,
          messageId: result.messageId,
          recipient: notification.recipient
        });
      } else {
        // Update notification as failed or retry
        const shouldRetry = (notification.retryCount || 0) < (notification.maxRetries || 3) &&
                           result.error !== 'Bot was blocked by the user or chat not found';

        if (shouldRetry) {
          await NotificationModel.incrementRetryCount(notificationId);
          logger.warn('Notification failed, will retry', {
            notificationId,
            attempt: (notification.retryCount || 0) + 1,
            maxRetries: notification.maxRetries || 3,
            error: result.error
          });
        } else {
          await NotificationModel.updateStatus(notificationId, 'failed', result.error);
          logger.error('Notification failed permanently', {
            notificationId,
            attempts: (notification.retryCount || 0) + 1,
            error: result.error
          });
        }
      }

      return result;

    } catch (error) {
      logger.error('Error processing notification', {
        notificationId,
        error: (error as Error).message
      });

      // Log failed delivery
      await DeliveryLogModel.create({
        notificationId,
        attempt: 1,
        status: 'failed',
        errorMessage: (error as Error).message
      });

      // Update notification as failed
      await NotificationModel.updateStatus(notificationId, 'failed', (error as Error).message);

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  private async renderTemplate(templateId: string, data: Record<string, any>): Promise<RenderedTemplate> {
    // This would fetch template from database in real implementation
    // For now, using a mock template
    const mockTemplate = {
      id: templateId,
      clientId: 'mock',
      name: 'job_alert',
      channel: 'telegram',
      content: `🆕 *New Job Alert*

*{{title}}*
🏢 {{company}}
📍 {{location}}
{{#if salary}}💰 {{salary}}{{/if}}

{{#if description}}{{truncate description 200}}{{/if}}

🔗 [View Job]({{url}})`,
      variables: ['title', 'company', 'location', 'salary', 'description', 'url'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.templateEngine.render(mockTemplate, data);
  }

  async getWebhookInfo(): Promise<any> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    return this.bot.getWebHookInfo();
  }

  async setWebhook(url: string, options?: any): Promise<boolean> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    try {
      const result = await this.bot.setWebHook(url, options);
      logger.info('Telegram webhook set successfully', { url });
      return result;
    } catch (error) {
      logger.error('Failed to set Telegram webhook', { url, error });
      throw error;
    }
  }

  async deleteWebhook(): Promise<boolean> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    try {
      const result = await this.bot.deleteWebHook();
      logger.info('Telegram webhook deleted successfully');
      return result;
    } catch (error) {
      logger.error('Failed to delete Telegram webhook', error);
      throw error;
    }
  }

  async getMe(): Promise<any> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    return this.bot.getMe();
  }

  async testConnection(): Promise<boolean> {
    try {
      const me = await this.getMe();
      logger.info('Telegram bot connection test successful', {
        botId: me.id,
        botUsername: me.username
      });
      return true;
    } catch (error) {
      logger.error('Telegram bot connection test failed', error);
      return false;
    }
  }

  // Utility methods for message formatting
  static escapeMarkdown(text: string): string {
    // Escape special markdown characters
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  static createInlineKeyboard(buttons: Array<Array<{ text: string; url?: string; callback_data?: string }>>): any {
    return {
      inline_keyboard: buttons
    };
  }

  static createReplyKeyboard(buttons: Array<Array<string>>, options?: {
    resize_keyboard?: boolean;
    one_time_keyboard?: boolean;
    selective?: boolean;
  }): any {
    return {
      keyboard: buttons.map(row => row.map(text => ({ text }))),
      resize_keyboard: options?.resize_keyboard ?? true,
      one_time_keyboard: options?.one_time_keyboard ?? false,
      selective: options?.selective ?? false
    };
  }

  // Format job notification specifically
  static formatJobNotification(job: {
    title: string;
    company: string;
    location?: string;
    salary?: string;
    description?: string;
    url: string;
    source?: string;
  }): string {
    let message = '🆕 *New Job Alert*\n\n';
    message += `*${TelegramChannel.escapeMarkdown(job.title)}*\n`;
    message += `🏢 ${TelegramChannel.escapeMarkdown(job.company)}\n`;

    if (job.location) {
      message += `📍 ${TelegramChannel.escapeMarkdown(job.location)}\n`;
    }

    if (job.salary) {
      message += `💰 ${TelegramChannel.escapeMarkdown(job.salary)}\n`;
    }

    if (job.description) {
      const truncatedDesc = job.description.length > 200
        ? job.description.substring(0, 200) + '...'
        : job.description;
      message += `\n${TelegramChannel.escapeMarkdown(truncatedDesc)}\n`;
    }

    message += `\n🔗 [View Job](${job.url})`;

    if (job.source) {
      message += `\n📍 Source: ${TelegramChannel.escapeMarkdown(job.source)}`;
    }

    return message;
  }
}