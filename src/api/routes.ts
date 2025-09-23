import { Express } from 'express';
import { metricsHandler } from '../monitoring/metrics';
import { checkDatabaseHealth } from '../database/connection';
import { checkRedisHealth } from '../database/redis';
import { checkQueueHealth } from '../queue/manager';
import authRoutes from '../auth/routes';

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

      const isHealthy = dbHealth && redisHealth && queueHealth;

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: dbHealth ? 'up' : 'down',
          redis: redisHealth ? 'up' : 'down',
          queue: queueHealth ? 'up' : 'down'
        }
      });
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

  // TODO: Add remaining route handlers when implemented
  // app.use(`${apiPrefix}/notifications`, notificationRoutes);
  // app.use(`${apiPrefix}/templates`, templateRoutes);
  // app.use(`${apiPrefix}/channels`, channelRoutes);

  // Placeholder routes for now
  app.get(`${apiPrefix}/notifications`, (req, res) => {
    res.json({ message: 'Notification endpoints - Coming soon' });
  });

  app.get(`${apiPrefix}/templates`, (req, res) => {
    res.json({ message: 'Template endpoints - Coming soon' });
  });

  app.get(`${apiPrefix}/channels`, (req, res) => {
    res.json({ message: 'Channel endpoints - Coming soon' });
  });
};