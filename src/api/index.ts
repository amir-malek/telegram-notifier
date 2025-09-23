import { Router } from 'express';
import { notificationRoutes } from './notifications/routes';
import { docsRoutes } from './docs/routes';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiters } from './middleware/rateLimit';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { logger } from '../monitoring/logger';

const router = Router();

// Security middleware
router.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
router.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Compression
router.use(compression());

// Request logging middleware
router.use((req, res, next) => {
  const startTime = Date.now();

  // Generate request ID if not present
  const requestId = req.headers['x-request-id'] ||
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Log request
  logger.info('API Request', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('API Response', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
});

// Global rate limiting
router.use(rateLimiters.general);

// API Routes
router.use('/notifications', notificationRoutes);
router.use('/docs', docsRoutes);

// Basic health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'notification-service',
    version: '1.0.0'
  });
});

// API documentation route
router.get('/', (req, res) => {
  res.json({
    name: 'Notification Service API',
    version: '1.0.0',
    description: 'Multi-channel notification service with template support',
    endpoints: {
      notifications: '/api/notifications',
      health: '/api/health',
      docs: '/api/docs'
    },
    availableChannels: ['telegram'],
    documentation: {
      interactive: '/api/docs/swagger',
      openapi_json: '/api/docs/openapi.json',
      openapi_yaml: '/api/docs/openapi.yaml'
    }
  });
});

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl,
    availableEndpoints: [
      '/api/notifications',
      '/api/health',
      '/api/docs'
    ]
  });
});

// Error handling middleware (must be last)
router.use(errorHandler);

export { router as apiRouter };