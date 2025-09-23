import Joi from 'joi';

export const sendNotificationSchema = Joi.object({
  channel: Joi.string()
    .valid('telegram', 'slack', 'discord', 'email', 'sms', 'webhook')
    .required()
    .messages({
      'any.only': 'Channel must be one of: telegram, slack, discord, email, sms, webhook',
      'any.required': 'Channel is required'
    }),

  recipient: Joi.string()
    .required()
    .min(1)
    .max(500)
    .messages({
      'string.empty': 'Recipient cannot be empty',
      'string.min': 'Recipient must be at least 1 character long',
      'string.max': 'Recipient cannot exceed 500 characters',
      'any.required': 'Recipient is required'
    }),

  subject: Joi.string()
    .optional()
    .max(255)
    .messages({
      'string.max': 'Subject cannot exceed 255 characters'
    }),

  message: Joi.string()
    .optional()
    .max(10000)
    .messages({
      'string.max': 'Message cannot exceed 10,000 characters'
    }),

  template: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Template must be a valid UUID'
    }),

  data: Joi.object()
    .optional()
    .unknown(true)
    .messages({
      'object.base': 'Data must be an object'
    }),

  priority: Joi.string()
    .valid('high', 'medium', 'low')
    .default('medium')
    .messages({
      'any.only': 'Priority must be one of: high, medium, low'
    }),

  scheduledAt: Joi.date()
    .iso()
    .min('now')
    .optional()
    .messages({
      'date.format': 'Scheduled date must be in ISO format',
      'date.min': 'Scheduled date must be in the future'
    }),

  metadata: Joi.object()
    .optional()
    .unknown(true)
    .messages({
      'object.base': 'Metadata must be an object'
    })
}).custom((value, helpers) => {
  // Either message or template must be provided
  if (!value.message && !value.template) {
    return helpers.error('custom.messageOrTemplate');
  }
  return value;
}).messages({
  'custom.messageOrTemplate': 'Either message or template must be provided'
});

export const batchNotificationSchema = Joi.object({
  channel: Joi.string()
    .valid('telegram', 'slack', 'discord', 'email', 'sms', 'webhook')
    .required()
    .messages({
      'any.only': 'Channel must be one of: telegram, slack, discord, email, sms, webhook',
      'any.required': 'Channel is required'
    }),

  template: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Template must be a valid UUID'
    }),

  notifications: Joi.array()
    .items(
      Joi.object({
        recipient: Joi.string()
          .required()
          .min(1)
          .max(500)
          .messages({
            'string.empty': 'Recipient cannot be empty',
            'string.min': 'Recipient must be at least 1 character long',
            'string.max': 'Recipient cannot exceed 500 characters',
            'any.required': 'Recipient is required'
          }),

        subject: Joi.string()
          .optional()
          .max(255)
          .messages({
            'string.max': 'Subject cannot exceed 255 characters'
          }),

        message: Joi.string()
          .optional()
          .max(10000)
          .messages({
            'string.max': 'Message cannot exceed 10,000 characters'
          }),

        data: Joi.object()
          .optional()
          .unknown(true)
          .messages({
            'object.base': 'Data must be an object'
          }),

        metadata: Joi.object()
          .optional()
          .unknown(true)
          .messages({
            'object.base': 'Metadata must be an object'
          })
      }).custom((value, helpers) => {
        // Either message or parent template must be provided
        const parentTemplate = helpers.state.ancestors[1].template;
        if (!value.message && !parentTemplate) {
          return helpers.error('custom.messageOrTemplate');
        }
        return value;
      })
    )
    .required()
    .min(1)
    .max(1000)
    .messages({
      'array.min': 'At least one notification must be provided',
      'array.max': 'Cannot send more than 1000 notifications in a single batch',
      'any.required': 'Notifications array is required',
      'custom.messageOrTemplate': 'Either message or template must be provided'
    }),

  options: Joi.object({
    deduplicate: Joi.boolean()
      .default(false)
      .messages({
        'boolean.base': 'Deduplicate must be a boolean'
      }),

    batchSize: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .messages({
        'number.base': 'Batch size must be a number',
        'number.integer': 'Batch size must be an integer',
        'number.min': 'Batch size must be at least 1',
        'number.max': 'Batch size cannot exceed 100'
      }),

    delayBetween: Joi.number()
      .integer()
      .min(0)
      .max(60000)
      .default(1000)
      .messages({
        'number.base': 'Delay must be a number',
        'number.integer': 'Delay must be an integer',
        'number.min': 'Delay must be at least 0 milliseconds',
        'number.max': 'Delay cannot exceed 60 seconds'
      })
  }).optional()
});

export const scheduleNotificationSchema = Joi.object({
  channel: Joi.string()
    .valid('telegram', 'slack', 'discord', 'email', 'sms', 'webhook')
    .required()
    .messages({
      'any.only': 'Channel must be one of: telegram, slack, discord, email, sms, webhook',
      'any.required': 'Channel is required'
    }),

  recipient: Joi.string()
    .required()
    .min(1)
    .max(500)
    .messages({
      'string.empty': 'Recipient cannot be empty',
      'any.required': 'Recipient is required'
    }),

  scheduledAt: Joi.date()
    .iso()
    .min('now')
    .required()
    .messages({
      'date.format': 'Scheduled date must be in ISO format',
      'date.min': 'Scheduled date must be in the future',
      'any.required': 'Scheduled date is required'
    }),

  subject: Joi.string()
    .optional()
    .max(255),

  message: Joi.string()
    .optional()
    .max(10000),

  template: Joi.string()
    .uuid()
    .optional(),

  data: Joi.object()
    .optional()
    .unknown(true),

  priority: Joi.string()
    .valid('high', 'medium', 'low')
    .default('medium'),

  metadata: Joi.object()
    .optional()
    .unknown(true)
}).custom((value, helpers) => {
  if (!value.message && !value.template) {
    return helpers.error('custom.messageOrTemplate');
  }
  return value;
}).messages({
  'custom.messageOrTemplate': 'Either message or template must be provided'
});

export const getNotificationsQuerySchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'queued', 'processing', 'sent', 'failed', 'cancelled')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, queued, processing, sent, failed, cancelled'
    }),

  channel: Joi.string()
    .valid('telegram', 'slack', 'discord', 'email', 'sms', 'webhook')
    .optional()
    .messages({
      'any.only': 'Channel must be one of: telegram, slack, discord, email, sms, webhook'
    }),

  priority: Joi.string()
    .valid('high', 'medium', 'low')
    .optional()
    .messages({
      'any.only': 'Priority must be one of: high, medium, low'
    }),

  from: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'From date must be in ISO format'
    }),

  to: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'To date must be in ISO format'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(50)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 1000'
    }),

  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.base': 'Offset must be a number',
      'number.integer': 'Offset must be an integer',
      'number.min': 'Offset must be at least 0'
    })
}).custom((value, helpers) => {
  if (value.from && value.to && value.from >= value.to) {
    return helpers.error('custom.dateRange');
  }
  return value;
}).messages({
  'custom.dateRange': 'From date must be before to date'
});

export const notificationIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Notification ID must be a valid UUID',
      'any.required': 'Notification ID is required'
    })
});