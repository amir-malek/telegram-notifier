import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { getRedisClient } from '../../database/redis';
import { logger } from '../../monitoring/logger';
import { metrics } from '../../monitoring/metrics';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  keyGenerator?: (req: any) => string; // Function to generate unique key
  message?: string; // Custom error message
  standardHeaders?: boolean; // Add standard rate limit headers
  legacyHeaders?: boolean; // Add legacy rate limit headers
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: number;
}

export class RateLimiter {
  private redis: Redis;
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions) {
    this.redis = getRedisClient();
    this.options = {
      windowMs: options.windowMs,
      max: options.max,
      keyGenerator: options.keyGenerator || ((req: Request) => req.ip),
      message: options.message || 'Too many requests, please try again later.',
      standardHeaders: options.standardHeaders ?? true,
      legacyHeaders: options.legacyHeaders ?? false,
      skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
      skipFailedRequests: options.skipFailedRequests ?? false
    };
  }

  async checkLimit(key: string): Promise<RateLimitInfo> {
    const redisKey = `ratelimit:${key}`;
    const window = Math.floor(Date.now() / this.options.windowMs);
    const windowKey = `${redisKey}:${window}`;

    try {
      // Use a pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      pipeline.incr(windowKey);
      pipeline.expire(windowKey, Math.ceil(this.options.windowMs / 1000));
      pipeline.ttl(windowKey);

      const results = await pipeline.exec();

      if (!results || results.some(result => result[0] !== null)) {
        throw new Error('Redis pipeline failed');
      }

      const current = results[0][1] as number;
      const ttl = results[2][1] as number;
      const resetTime = Date.now() + (ttl * 1000);

      return {
        limit: this.options.max,
        current,
        remaining: Math.max(0, this.options.max - current),
        resetTime
      };

    } catch (error) {
      logger.error('Rate limit check failed:', error);
      // If Redis fails, allow the request but log the error
      return {
        limit: this.options.max,
        current: 0,
        remaining: this.options.max,
        resetTime: Date.now() + this.options.windowMs
      };
    }
  }

  createMiddleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.options.keyGenerator(req);
        const limitInfo = await this.checkLimit(key);

        // Add headers
        if (this.options.standardHeaders) {
          res.set({
            'RateLimit-Limit': limitInfo.limit.toString(),
            'RateLimit-Remaining': limitInfo.remaining.toString(),
            'RateLimit-Reset': new Date(limitInfo.resetTime).toISOString()
          });
        }

        if (this.options.legacyHeaders) {
          res.set({
            'X-RateLimit-Limit': limitInfo.limit.toString(),
            'X-RateLimit-Remaining': limitInfo.remaining.toString(),
            'X-RateLimit-Reset': Math.ceil(limitInfo.resetTime / 1000).toString()
          });
        }

        // Check if limit exceeded
        if (limitInfo.current > limitInfo.limit) {
          metrics.recordRateLimitHit(key);

          logger.warn('Rate limit exceeded', {
            key,
            current: limitInfo.current,
            limit: limitInfo.limit,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });

          res.status(429).json({
            error: 'Rate limit exceeded',
            message: this.options.message,
            retryAfter: Math.ceil((limitInfo.resetTime - Date.now()) / 1000)
          });
          return;
        }

        next();

      } catch (error) {
        logger.error('Rate limiting middleware error:', error);
        // If rate limiting fails, allow the request through
        next();
      }
    };
  }
}

// Helper function for easy middleware creation
export function rateLimit(options: RateLimitOptions) {
  const limiter = new RateLimiter(options);
  return limiter.createMiddleware();
}

// Pre-configured rate limiters for common use cases
export const rateLimiters = {
  // General API rate limit
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  }),

  // Strict rate limit for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: 'Too many authentication attempts, please try again later.'
  }),

  // Per-client rate limit for notification endpoints
  notifications: (clientId: string) => rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 notifications per minute per client
    keyGenerator: () => `client:${clientId}`,
    message: 'Notification rate limit exceeded for your account.'
  })
};