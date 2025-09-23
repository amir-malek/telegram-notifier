import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt';
import { isValidApiKeyFormat, getApiKeyPrefix, maskApiKey } from './apiKey';
import { AuthenticationError, AuthorizationError, RateLimitError } from '../api/middleware/errorHandler';
import { logAuth, logger } from '../monitoring/logger';
import { metrics } from '../monitoring/metrics';
import { redisOperations } from '../database/redis';

export interface AuthenticatedRequest extends Request {
  client?: {
    id: string;
    name: string;
    rateLimit: number;
  };
  authMethod?: 'jwt' | 'apikey';
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('Authorization header required');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme === 'Bearer') {
      // JWT Authentication
      await authenticateWithJWT(req, token);
    } else if (scheme === 'ApiKey') {
      // API Key Authentication
      await authenticateWithApiKey(req, token);
    } else {
      throw new AuthenticationError('Invalid authentication scheme. Use Bearer or ApiKey');
    }

    // Check rate limiting
    await checkRateLimit(req);

    next();
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof RateLimitError) {
      next(error);
    } else {
      logger.error('Authentication middleware error:', error);
      next(new AuthenticationError('Authentication failed'));
    }
  }
};

const authenticateWithJWT = async (req: AuthenticatedRequest, token: string): Promise<void> => {
  try {
    const payload = verifyAccessToken(token);

    // TODO: Verify client exists in database and is active
    // For now, we'll use the payload data directly
    req.client = {
      id: payload.clientId,
      name: payload.name,
      rateLimit: 100 // Default rate limit, should come from database
    };

    req.authMethod = 'jwt';

    logAuth('jwt_success', payload.clientId, {
      method: req.method,
      path: req.path
    });

  } catch (error) {
    logAuth('jwt_failed', undefined, {
      error: (error as Error).message,
      method: req.method,
      path: req.path
    });
    throw new AuthenticationError((error as Error).message);
  }
};

const authenticateWithApiKey = async (req: AuthenticatedRequest, apiKey: string): Promise<void> => {
  try {
    if (!isValidApiKeyFormat(apiKey)) {
      throw new Error('Invalid API key format');
    }

    const prefix = getApiKeyPrefix(apiKey);
    if (!prefix) {
      throw new Error('Could not extract API key prefix');
    }

    // TODO: Look up client by API key prefix in database
    // For now, we'll simulate this
    const maskedKey = maskApiKey(apiKey);

    // Simulate database lookup and verification
    // In real implementation, you would:
    // 1. Find the client by the API key prefix
    // 2. Verify the full API key against the stored hash
    // 3. Check if the client and key are active
    // 4. Update last used timestamp

    req.client = {
      id: 'demo-client-id', // Should come from database
      name: 'Demo Client', // Should come from database
      rateLimit: 50 // Should come from database
    };

    req.authMethod = 'apikey';

    logAuth('apikey_success', req.client.id, {
      maskedKey,
      method: req.method,
      path: req.path
    });

    // Update API key usage timestamp (in background)
    updateApiKeyUsage(req.client.id, apiKey).catch(error => {
      logger.error('Failed to update API key usage:', error);
    });

  } catch (error) {
    logAuth('apikey_failed', undefined, {
      error: (error as Error).message,
      method: req.method,
      path: req.path
    });
    throw new AuthenticationError((error as Error).message);
  }
};

const checkRateLimit = async (req: AuthenticatedRequest): Promise<void> => {
  if (!req.client) {
    return;
  }

  const { id: clientId, rateLimit } = req.client;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const rateLimitKey = `rate_limit:${clientId}:${windowStart}`;

  try {
    // Get current request count
    const currentCount = await redisOperations.get(rateLimitKey);
    const requestCount = currentCount ? parseInt(currentCount) : 0;

    if (requestCount >= rateLimit) {
      metrics.recordRateLimitHit(clientId);
      throw new RateLimitError(`Rate limit exceeded. Limit: ${rateLimit} requests per 15 minutes`);
    }

    // Increment request count
    await redisOperations.set(rateLimitKey, (requestCount + 1).toString(), Math.floor(windowMs / 1000));

  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    // If Redis is down, we'll allow the request but log the error
    logger.error('Rate limiting check failed:', error);
  }
};

const updateApiKeyUsage = async (clientId: string, apiKey: string): Promise<void> => {
  try {
    const usageKey = `api_key_usage:${clientId}`;
    const timestamp = new Date().toISOString();

    await redisOperations.hSet(usageKey, 'lastUsed', timestamp);
    await redisOperations.expire(usageKey, 30 * 24 * 60 * 60); // 30 days

  } catch (error) {
    logger.error('Failed to update API key usage:', error);
  }
};

// Optional authentication middleware (for public endpoints that can benefit from auth)
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      // Try to authenticate, but don't fail if it doesn't work
      try {
        await authenticate(req, res, () => {});
      } catch (error) {
        // Log the error but continue without authentication
        logger.warn('Optional authentication failed:', error);
      }
    }

    next();
  } catch (error) {
    // Never fail on optional authentication
    next();
  }
};

// Middleware to require specific permissions (for future use)
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.client) {
      return next(new AuthenticationError('Authentication required'));
    }

    // TODO: Implement permission checking based on client permissions
    // For now, we'll allow all authenticated requests
    next();
  };
};