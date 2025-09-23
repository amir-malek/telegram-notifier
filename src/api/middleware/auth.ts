import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../../auth/jwt';
import { validateApiKey } from '../../auth/apiKey';
import { ClientModel, ApiKeyModel } from '../../database/models';
import { AuthenticationError } from './errorHandler';
import { logger } from '../../monitoring/logger';
import { metrics } from '../../monitoring/metrics';
import { AuthenticatedRequest } from '../../types';

export async function authenticateRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('Authorization header is required');
    }

    let client = null;

    // Check if it's a Bearer token (JWT)
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const payload = verifyJWT(token);
        client = await ClientModel.findById(payload.clientId);

        if (!client) {
          throw new AuthenticationError('Invalid token: client not found');
        }

        logger.debug('JWT authentication successful', {
          clientId: client.id,
          clientName: client.name
        });

        metrics.recordAuthEvent('jwt', 'success');

      } catch (error) {
        logger.warn('JWT authentication failed', {
          error: (error as Error).message,
          token: token.substring(0, 10) + '...'
        });
        metrics.recordAuthEvent('jwt', 'failed');
        throw new AuthenticationError('Invalid or expired token');
      }
    }
    // Check if it's an API key
    else if (authHeader.startsWith('ApiKey ')) {
      const apiKey = authHeader.substring(7);

      try {
        const { isValid, keyData } = await validateApiKey(apiKey);

        if (!isValid || !keyData) {
          throw new AuthenticationError('Invalid API key');
        }

        client = await ClientModel.findById(keyData.clientId);

        if (!client) {
          throw new AuthenticationError('Invalid API key: client not found');
        }

        // Update last used timestamp
        await ApiKeyModel.updateLastUsed(keyData.keyId);

        logger.debug('API key authentication successful', {
          clientId: client.id,
          clientName: client.name,
          keyId: keyData.keyId
        });

        metrics.recordAuthEvent('apikey', 'success');

      } catch (error) {
        logger.warn('API key authentication failed', {
          error: (error as Error).message,
          keyPrefix: apiKey.substring(0, 8) + '...'
        });
        metrics.recordAuthEvent('apikey', 'failed');
        throw new AuthenticationError('Invalid API key');
      }
    }
    else {
      throw new AuthenticationError('Invalid authorization format. Use "Bearer <jwt>" or "ApiKey <key>"');
    }

    // Check if client is active
    if (!client.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Add client to request object
    req.client = client;

    next();

  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    } else {
      logger.error('Authentication middleware error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication failed'
      });
    }
  }
}

// Optional authentication middleware (doesn't fail if no auth provided)
export async function optionalAuthentication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      // If auth header is provided, validate it
      await authenticateRequest(req, res, next);
    } else {
      // No auth header provided, continue without authentication
      req.client = null;
      next();
    }
  } catch (error) {
    // If optional auth fails, log but don't fail the request
    logger.warn('Optional authentication failed', error);
    req.client = null;
    next();
  }
}

// Middleware to check if user has specific permissions
export function requirePermissions(...permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.client) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    // For now, all authenticated clients have all permissions
    // In the future, this could check client-specific permissions
    next();
  };
}

// Middleware to check rate limits based on client's plan
export function checkClientRateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.client) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
    return;
  }

  // Rate limit is stored in client.rateLimit
  // This is handled by the rate limiting middleware using the client ID
  next();
}