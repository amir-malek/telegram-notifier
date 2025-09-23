import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from './jwt';
import { generateApiKey, hashApiKey } from './apiKey';
import { ValidationError, NotFoundError } from '../api/middleware/errorHandler';
import { asyncHandler } from '../api/middleware/errorHandler';
import { logAuth, logger } from '../monitoring/logger';
import { RegisterClientRequest, ClientResponse, AuthenticatedRequest } from '../types';

// TODO: Replace with actual database operations
// These are mock implementations for demonstration

export const registerClient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, email, rateLimit = 100 }: RegisterClientRequest = req.body;

  if (!name || name.trim().length === 0) {
    throw new ValidationError('Client name is required');
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Invalid email format');
  }

  try {
    // Generate client ID and API key
    const clientId = uuidv4();
    const { apiKey, keyId } = generateApiKey();
    const hashedKey = await hashApiKey(apiKey);

    // TODO: Save client to database
    const clientData = {
      id: clientId,
      name: name.trim(),
      email,
      rateLimit: Math.max(1, Math.min(rateLimit, 1000)), // Limit between 1 and 1000
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // TODO: Save API key to database
    const apiKeyData = {
      keyId,
      clientId,
      hashedKey,
      prefix: apiKey.substring(3, 11),
      isActive: true,
      createdAt: new Date(),
      lastUsedAt: null
    };

    logAuth('client_registered', clientId, {
      name,
      email,
      rateLimit: clientData.rateLimit
    });

    const response: ClientResponse = {
      id: clientId,
      name: clientData.name,
      apiKey,
      rateLimit: clientData.rateLimit,
      createdAt: clientData.createdAt
    };

    res.status(201).json({
      message: 'Client registered successfully',
      client: response,
      note: 'Save your API key securely. It will not be shown again.'
    });

  } catch (error) {
    logger.error('Client registration failed:', error);
    throw new Error('Failed to register client');
  }
});

export const generateToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { clientId } = req.body;

  if (!clientId) {
    throw new ValidationError('Client ID is required');
  }

  try {
    // TODO: Verify client exists and is active in database
    const client = {
      id: clientId,
      name: 'Demo Client', // Should come from database
      isActive: true
    };

    if (!client.isActive) {
      throw new ValidationError('Client is not active');
    }

    const accessToken = generateAccessToken({
      clientId: client.id,
      name: client.name
    });

    const refreshToken = generateRefreshToken(client.id);

    logAuth('token_generated', clientId);

    res.json({
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

  } catch (error) {
    logger.error('Token generation failed:', error);
    throw new Error('Failed to generate token');
  }
});

export const refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }

  try {
    const { clientId } = verifyRefreshToken(refreshToken);

    // TODO: Verify client exists and is active in database
    const client = {
      id: clientId,
      name: 'Demo Client', // Should come from database
      isActive: true
    };

    if (!client.isActive) {
      throw new ValidationError('Client is not active');
    }

    const newAccessToken = generateAccessToken({
      clientId: client.id,
      name: client.name
    });

    const newRefreshToken = generateRefreshToken(client.id);

    logAuth('token_refreshed', clientId);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

  } catch (error) {
    logger.error('Token refresh failed:', error);
    throw new ValidationError('Invalid or expired refresh token');
  }
});

export const generateNewApiKey = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  const clientId = req.client.id;

  try {
    // Generate new API key
    const { apiKey, keyId } = generateApiKey();
    const hashedKey = await hashApiKey(apiKey);

    // TODO: Save new API key to database
    // TODO: Optionally revoke old API keys

    const apiKeyData = {
      keyId,
      clientId,
      hashedKey,
      prefix: apiKey.substring(3, 11),
      isActive: true,
      createdAt: new Date(),
      lastUsedAt: null
    };

    logAuth('api_key_generated', clientId, { keyId });

    res.json({
      apiKey,
      keyId,
      message: 'New API key generated successfully',
      note: 'Save your API key securely. It will not be shown again.'
    });

  } catch (error) {
    logger.error('API key generation failed:', error);
    throw new Error('Failed to generate API key');
  }
});

export const revokeApiKey = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  const { keyId } = req.params;
  const clientId = req.client.id;

  if (!keyId) {
    throw new ValidationError('Key ID is required');
  }

  try {
    // TODO: Verify the API key belongs to the client and revoke it
    // For now, we'll simulate this

    logAuth('api_key_revoked', clientId, { keyId });

    res.json({
      message: 'API key revoked successfully',
      keyId
    });

  } catch (error) {
    logger.error('API key revocation failed:', error);
    throw new Error('Failed to revoke API key');
  }
});

export const listApiKeys = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  const clientId = req.client.id;

  try {
    // TODO: Fetch API keys from database
    const apiKeys = [
      {
        keyId: 'demo-key-1',
        prefix: 'nf_abc123',
        isActive: true,
        createdAt: new Date(),
        lastUsedAt: new Date()
      }
    ];

    res.json({
      apiKeys: apiKeys.map(key => ({
        keyId: key.keyId,
        prefix: key.prefix,
        isActive: key.isActive,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt
      }))
    });

  } catch (error) {
    logger.error('Failed to list API keys:', error);
    throw new Error('Failed to retrieve API keys');
  }
});

export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.client) {
    throw new ValidationError('Authentication required');
  }

  try {
    // TODO: Fetch full client data from database
    const clientData = {
      id: req.client.id,
      name: req.client.name,
      rateLimit: req.client.rateLimit,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.json({
      client: clientData,
      authMethod: req.authMethod
    });

  } catch (error) {
    logger.error('Failed to get client profile:', error);
    throw new Error('Failed to retrieve profile');
  }
});