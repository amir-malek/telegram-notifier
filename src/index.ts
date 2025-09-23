import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';

import { logger } from './monitoring/logger';
import { connectDatabase } from './database/connection';
import { connectRedis } from './database/redis';
import { initializeQueue } from './queue/manager';
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
    // Initialize database connections
    logger.info('Connecting to database...');
    await connectDatabase();

    logger.info('Connecting to Redis...');
    await connectRedis();

    // Initialize queue system
    logger.info('Initializing queue system...');
    await initializeQueue();

    // Start server
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || 'localhost';

    server.listen(port, host, () => {
      logger.info(`🚀 Notification Service started successfully`);
      logger.info(`📡 Server running on http://${host}:${port}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📊 Metrics available on port ${process.env.PROMETHEUS_PORT || '9090'}`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Add cleanup logic here
      // - Close database connections
      // - Close Redis connection
      // - Wait for queue jobs to complete

      setTimeout(() => {
        logger.error('Forcing shutdown');
        process.exit(1);
      }, 10000); // Force shutdown after 10 seconds
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