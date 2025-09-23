import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'notification-service',
  version: process.env.npm_package_version || '1.0.0'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register]
});

const notificationsSent = new client.Counter({
  name: 'notifications_sent_total',
  help: 'Total number of notifications sent',
  labelNames: ['channel', 'status'],
  registers: [register]
});

const notificationProcessingTime = new client.Histogram({
  name: 'notification_processing_seconds',
  help: 'Time spent processing notifications',
  labelNames: ['channel'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

const queueJobs = new client.Gauge({
  name: 'queue_jobs_total',
  help: 'Number of jobs in queue by status',
  labelNames: ['status', 'queue_name'],
  registers: [register]
});

const activeConnections = new client.Gauge({
  name: 'active_connections_total',
  help: 'Number of active connections',
  labelNames: ['type'],
  registers: [register]
});

const rateLimitHits = new client.Counter({
  name: 'rate_limit_hits_total',
  help: 'Number of rate limit hits',
  labelNames: ['client_id'],
  registers: [register]
});

const templateRenders = new client.Counter({
  name: 'template_renders_total',
  help: 'Total number of template renders',
  labelNames: ['template_name', 'status'],
  registers: [register]
});

const authEvents = new client.Counter({
  name: 'auth_events_total',
  help: 'Total number of authentication events',
  labelNames: ['method', 'status'],
  registers: [register]
});

// Middleware to collect HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Skip metrics collection for metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const route = getRoutePattern(req);

    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();

    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
  });

  next();
};

// Helper function to get route pattern for metrics
function getRoutePattern(req: Request): string {
  if (req.route) {
    return req.route.path;
  }

  // Fallback for non-matched routes
  const path = req.path;

  // Replace IDs with placeholder
  const idPattern = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  return path.replace(idPattern, '/:id');
}

// Metrics functions for other parts of the application
export const metrics = {
  // Notification metrics
  recordNotificationSent: (channel: string, status: 'success' | 'failed') => {
    notificationsSent.labels(channel, status).inc();
  },

  recordNotificationProcessingTime: (channel: string, duration: number) => {
    notificationProcessingTime.labels(channel).observe(duration);
  },

  // Queue metrics
  setQueueJobCount: (status: string, queueName: string, count: number) => {
    queueJobs.labels(status, queueName).set(count);
  },

  // Connection metrics
  setActiveConnections: (type: string, count: number) => {
    activeConnections.labels(type).set(count);
  },

  // Rate limit metrics
  recordRateLimitHit: (clientId: string) => {
    rateLimitHits.labels(clientId).inc();
  },

  // Template metrics
  recordTemplateRender: (templateName: string, status: 'success' | 'failed') => {
    templateRenders.labels(templateName, status).inc();
  },

  // Authentication metrics
  recordAuthEvent: (method: 'jwt' | 'apikey', status: 'success' | 'failed') => {
    authEvents.labels(method, status).inc();
  },

  // Get all metrics
  getMetrics: async (): Promise<string> => {
    return register.metrics();
  },

  // Clear all metrics (for testing)
  clearMetrics: () => {
    register.clear();
  }
};

// Metrics endpoint handler
export const metricsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
};

export { register };