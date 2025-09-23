import { Express } from 'express';
import { metricsHandler } from '../monitoring/metrics';
import { checkDatabaseHealth } from '../database/connection';
import { checkRedisHealth, isRedisEnabled } from '../database/redis';
import { checkQueueHealth } from '../queue/manager';
import authRoutes from '../auth/routes';
import { notificationRoutes } from './notifications/routes';

export const setupRoutes = (app: Express): void => {
  // API version prefix
  const apiPrefix = `/api/${process.env.API_VERSION || 'v1'}`;

  // Metrics endpoint
  app.get('/metrics', metricsHandler);

  // Enhanced health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const [dbHealth, redisHealth, queueHealth] = await Promise.all([
        checkDatabaseHealth(),
        checkRedisHealth(),
        checkQueueHealth()
      ]);

      const redisStatus = isRedisEnabled() ? (redisHealth ? 'up' : 'down') : 'disabled';

      // Service is healthy if DB and queues are working
      // Redis is optional - service can be degraded but still functional
      const criticalServicesHealthy = dbHealth && queueHealth;
      const allServicesHealthy = criticalServicesHealthy && redisHealth;

      let status: string;
      let statusCode: number;

      if (criticalServicesHealthy) {
        if (allServicesHealthy || !isRedisEnabled()) {
          status = 'healthy';
          statusCode = 200;
        } else {
          status = 'degraded'; // Redis is down but service still functional
          statusCode = 200;
        }
      } else {
        status = 'unhealthy';
        statusCode = 503;
      }

      const response: any = {
        status,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: dbHealth ? 'up' : 'down',
          redis: redisStatus,
          queue: queueHealth ? 'up' : 'down'
        }
      };

      // Add warnings for degraded mode
      if (status === 'degraded' || !isRedisEnabled()) {
        response.warnings = [];

        if (!isRedisEnabled()) {
          response.warnings.push('Redis is disabled - using in-memory alternatives');
          response.warnings.push('Rate limiting is per-instance only');
          response.warnings.push('Queue data will not persist across restarts');
        } else if (!redisHealth) {
          response.warnings.push('Redis connection failed - falling back to in-memory alternatives');
          response.warnings.push('Service functionality may be limited');
        }
      }

      res.status(statusCode).json(response);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // API Info endpoint
  app.get(apiPrefix, (req, res) => {
    res.json({
      name: 'Notification Service API',
      version: process.env.npm_package_version || '1.0.0',
      description: 'Multi-channel notification service with REST API',
      documentation: '/docs',
      endpoints: {
        health: '/health',
        metrics: '/metrics',
        auth: `${apiPrefix}/auth`,
        notifications: `${apiPrefix}/notifications`,
        templates: `${apiPrefix}/templates`,
        channels: `${apiPrefix}/channels`
      }
    });
  });

  // Route handlers
  app.use(`${apiPrefix}/auth`, authRoutes);
  app.use(`${apiPrefix}/notifications`, notificationRoutes);

  // TODO: Add remaining route handlers when implemented
  // app.use(`${apiPrefix}/templates`, templateRoutes);
  // app.use(`${apiPrefix}/channels`, channelRoutes);

  app.get(`${apiPrefix}/templates`, (req, res) => {
    res.json({ message: 'Template endpoints - Coming soon' });
  });

  app.get(`${apiPrefix}/channels`, (req, res) => {
    res.json({ message: 'Channel endpoints - Coming soon' });
  });
};