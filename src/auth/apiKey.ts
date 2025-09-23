import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../monitoring/logger';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export interface ApiKeyData {
  keyId: string;
  clientId: string;
  hashedKey: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt?: Date;
  isActive: boolean;
}

export const generateApiKey = (): { keyId: string; apiKey: string; prefix: string } => {
  try {
    const keyId = uuidv4();
    const randomBytes = crypto.randomBytes(32);
    const apiKey = randomBytes.toString('base64url');
    const prefix = apiKey.substring(0, 8);

    return {
      keyId,
      apiKey: `nf_${apiKey}`, // 'nf' for notification service
      prefix
    };
  } catch (error) {
    logger.error('Failed to generate API key:', error);
    throw new Error('API key generation failed');
  }
};

export const hashApiKey = async (apiKey: string): Promise<string> => {
  try {
    // Remove the prefix before hashing
    const keyWithoutPrefix = apiKey.startsWith('nf_') ? apiKey.substring(3) : apiKey;
    return await bcrypt.hash(keyWithoutPrefix, BCRYPT_ROUNDS);
  } catch (error) {
    logger.error('Failed to hash API key:', error);
    throw new Error('API key hashing failed');
  }
};

export const verifyApiKey = async (apiKey: string, hashedKey: string): Promise<boolean> => {
  try {
    // Remove the prefix before verification
    const keyWithoutPrefix = apiKey.startsWith('nf_') ? apiKey.substring(3) : apiKey;
    return await bcrypt.compare(keyWithoutPrefix, hashedKey);
  } catch (error) {
    logger.error('Failed to verify API key:', error);
    return false;
  }
};

export const extractKeyId = (apiKey: string): string | null => {
  try {
    if (!apiKey.startsWith('nf_')) {
      return null;
    }

    // For security, we don't store the key ID in the key itself
    // Instead, we'll look it up by the prefix or through the database
    return null;
  } catch (error) {
    logger.error('Failed to extract key ID:', error);
    return null;
  }
};

export const isValidApiKeyFormat = (apiKey: string): boolean => {
  try {
    // Check if it starts with our prefix
    if (!apiKey.startsWith('nf_')) {
      return false;
    }

    // Check length (prefix + base64url encoded 32 bytes)
    const expectedLength = 3 + Math.ceil(32 * 4 / 3); // 3 for prefix + base64 length
    if (apiKey.length < expectedLength - 2 || apiKey.length > expectedLength + 2) {
      return false;
    }

    // Check if the key part is valid base64url
    const keyPart = apiKey.substring(3);
    const base64urlRegex = /^[A-Za-z0-9_-]+$/;
    return base64urlRegex.test(keyPart);
  } catch (error) {
    logger.error('Failed to validate API key format:', error);
    return false;
  }
};

export const getApiKeyPrefix = (apiKey: string): string | null => {
  try {
    if (!apiKey.startsWith('nf_') || apiKey.length < 11) {
      return null;
    }

    // Return first 8 characters after the prefix
    return apiKey.substring(3, 11);
  } catch (error) {
    logger.error('Failed to get API key prefix:', error);
    return null;
  }
};

export const maskApiKey = (apiKey: string): string => {
  try {
    if (!apiKey || apiKey.length < 11) {
      return '***';
    }

    const prefix = apiKey.substring(0, 11); // 'nf_' + first 8 chars
    const suffix = apiKey.substring(apiKey.length - 4);
    return `${prefix}***${suffix}`;
  } catch (error) {
    logger.error('Failed to mask API key:', error);
    return '***';
  }
};

// Rate limiting helpers for API keys
export const generateRateLimitKey = (clientId: string): string => {
  return `rate_limit:${clientId}`;
};

export const generateApiKeyUsageKey = (keyId: string): string => {
  return `api_key_usage:${keyId}`;
};