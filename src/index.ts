import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';

import { logger } from './monitoring/logger';
import { connectDatabase } from './database/connection';
import { connectRedis, closeRedisConnection } from './database/redis';
import { initializeQueue, getQueues } from './queue/manager';
import { initializeStorage, closeStorage, getStorageMode } from './storage/manager';
import { apiRouter } from './api';
import { errorHandler } from './api/middleware/errorHandler';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Basic security and parsing middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Request parsing
app.use(express.json({
  limit: process.env.MAX_REQUEST_SIZE || '10mb'
}));
app.use(express.urlencoded({
  extended: true,
  limit: process.env.MAX_REQUEST_SIZE || '10mb'
}));

// Setup API routes
app.use('/api', apiRouter);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND'
  });
});

async function startServer() {
  try {
    // Initialize storage (database or in-memory)
    logger.info('Initializing storage...');
    const storageMode = process.env.STORAGE_MODE || 'auto';
    await initializeStorage(storageMode as any);

    // Try to connect to Redis (optional)
    logger.info('Connecting to Redis...');
    const redisConnection = await connectRedis();

    if (redisConnection) {
      logger.info('Redis connected successfully');
    } else {
      logger.warn('Redis connection skipped or failed - continuing with in-memory alternatives');
    }

    // Initialize queue system (will use Redis or in-memory based on availability)
    logger.info('Initializing queue system...');
    await initializeQueue();

    // Start server
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || 'localhost';

    server.listen(port, host, () => {
      const currentStorageMode = getStorageMode();
      logger.info(`🚀 Notification Service started successfully`);
      logger.info(`📡 Server running on http://${host}:${port}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`💾 Storage: ${currentStorageMode}`);
      logger.info(`📊 Metrics available on port ${process.env.PROMETHEUS_PORT || '9090'}`);

      if (currentStorageMode === 'memory') {
        logger.warn('⚠️  Running in memory-only mode - data will not persist across restarts');
      }
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      server.close(() => {
        logger.info('HTTP server closed');
      });

      try {
        // Close queue connections
        const { notificationQueue, templateQueue } = getQueues();
        if (notificationQueue) {
          logger.info('Closing notification queue...');
          await notificationQueue.close();
        }
        if (templateQueue) {
          logger.info('Closing template queue...');
          await templateQueue.close();
        }

        // Close Redis connection
        logger.info('Closing Redis connection...');
        await closeRedisConnection();

        // Close storage connections
        logger.info('Closing storage connections...');
        await closeStorage();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

export { app, server };