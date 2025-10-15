import { Router } from 'express';
import { validate } from '../middleware/validator';
import { authenticateRequest, extractChannelCredentials } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import {
  sendNotification,
  sendBatchNotifications,
  scheduleNotification,
  getNotification,
  getNotifications,
  cancelNotification,
  getNotificationHistory,
  getNotificationStats
} from './controller';
import {
  sendNotificationSchema,
  batchNotificationSchema,
  scheduleNotificationSchema,
  getNotificationsQuerySchema,
  notificationIdSchema
} from './validation';

const router = Router();

// Apply authentication and credential extraction to all notification routes
router.use(authenticateRequest);
router.use(extractChannelCredentials);

// Send single notification
router.post('/',
  rateLimit({ windowMs: 60 * 1000, max: 100, keyGenerator: (req: any) => req.client.id }),
  validate(sendNotificationSchema),
  sendNotification
);

// Send batch notifications
router.post('/batch',
  rateLimit({ windowMs: 60 * 1000, max: 10, keyGenerator: (req: any) => req.client.id }),
  validate(batchNotificationSchema),
  sendBatchNotifications
);

// Schedule notification
router.post('/schedule',
  rateLimit({ windowMs: 60 * 1000, max: 50, keyGenerator: (req: any) => req.client.id }),
  validate(scheduleNotificationSchema),
  scheduleNotification
);

// Get notifications list
router.get('/',
  validate(getNotificationsQuerySchema, 'query'),
  getNotifications
);

// Get notification statistics
router.get('/stats',
  getNotificationStats
);

// Get specific notification
router.get('/:id',
  validate(notificationIdSchema, 'params'),
  getNotification
);

// Get notification delivery history
router.get('/:id/history',
  validate(notificationIdSchema, 'params'),
  getNotificationHistory
);

// Cancel notification
router.delete('/:id',
  validate(notificationIdSchema, 'params'),
  cancelNotification
);

export { router as notificationRoutes };