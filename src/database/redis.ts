import { createClient, RedisClientType } from 'redis';
import { logger } from '../monitoring/logger';

let redisClient: RedisClientType | null = null;
let redisEnabled: boolean = false;

export const isRedisEnabled = (): boolean => {
  return process.env.REDIS_ENABLED !== 'false' && redisEnabled;
};

export const connectRedis = async (): Promise<RedisClientType | null> => {
  // Check if Redis is disabled
  if (process.env.REDIS_ENABLED === 'false') {
    logger.info('Redis is disabled by configuration (REDIS_ENABLED=false)');
    redisEnabled = false;
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  try {
    const redisConfig = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 10000,
        lazyConnect: true
      },
      password: process.env.REDIS_PASSWORD || undefined
    };

    redisClient = createClient(redisConfig);

    // Error handling
    redisClient.on('error', (error) => {
      logger.error('Redis client error:', error);
      redisEnabled = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
      redisEnabled = true;
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
      redisEnabled = true;
    });

    redisClient.on('end', () => {
      logger.info('Redis client connection ended');
      redisEnabled = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });

    await redisClient.connect();

    // Test the connection
    await redisClient.ping();
    logger.info('Redis connection test successful');
    redisEnabled = true;

    return redisClient;
  } catch (error) {
    logger.warn('Failed to connect to Redis, continuing without Redis:', error);
    logger.warn('Service will run with in-memory queue system and basic rate limiting');
    redisEnabled = false;
    redisClient = null;
    return null;
  }
};

export const getRedis = (): RedisClientType | null => {
  return redisClient;
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

// Health check function
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    if (!redisClient || !isRedisEnabled()) {
      return false;
    }

    await redisClient.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
};

// Redis helper functions with error handling
export const redisOperations = {
  // String operations
  set: async (key: string, value: string, ttl?: number): Promise<void> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis SET operation skipped - Redis not available:', { key });
      return;
    }

    try {
      if (ttl) {
        await redis.setEx(key, ttl, value);
      } else {
        await redis.set(key, value);
      }
    } catch (error) {
      logger.error('Redis SET operation failed:', { key, error });
      throw error;
    }
  },

  get: async (key: string): Promise<string | null> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis GET operation skipped - Redis not available:', { key });
      return null;
    }

    try {
      return await redis.get(key);
    } catch (error) {
      logger.error('Redis GET operation failed:', { key, error });
      throw error;
    }
  },

  del: async (key: string): Promise<number> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis DEL operation skipped - Redis not available:', { key });
      return 0;
    }

    try {
      return await redis.del(key);
    } catch (error) {
      logger.error('Redis DEL operation failed:', { key, error });
      throw error;
    }
  },

  // Hash operations
  hSet: async (key: string, field: string, value: string): Promise<void> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis HSET operation skipped - Redis not available:', { key, field });
      return;
    }

    try {
      await redis.hSet(key, field, value);
    } catch (error) {
      logger.error('Redis HSET operation failed:', { key, field, error });
      throw error;
    }
  },

  hGet: async (key: string, field: string): Promise<string | undefined> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis HGET operation skipped - Redis not available:', { key, field });
      return undefined;
    }

    try {
      return await redis.hGet(key, field);
    } catch (error) {
      logger.error('Redis HGET operation failed:', { key, field, error });
      throw error;
    }
  },

  hGetAll: async (key: string): Promise<Record<string, string>> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis HGETALL operation skipped - Redis not available:', { key });
      return {};
    }

    try {
      return await redis.hGetAll(key);
    } catch (error) {
      logger.error('Redis HGETALL operation failed:', { key, error });
      throw error;
    }
  },

  // List operations
  lPush: async (key: string, value: string): Promise<number> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis LPUSH operation skipped - Redis not available:', { key });
      return 0;
    }

    try {
      return await redis.lPush(key, value);
    } catch (error) {
      logger.error('Redis LPUSH operation failed:', { key, error });
      throw error;
    }
  },

  rPop: async (key: string): Promise<string | null> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis RPOP operation skipped - Redis not available:', { key });
      return null;
    }

    try {
      return await redis.rPop(key);
    } catch (error) {
      logger.error('Redis RPOP operation failed:', { key, error });
      throw error;
    }
  },

  // Set operations
  sAdd: async (key: string, member: string): Promise<number> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis SADD operation skipped - Redis not available:', { key, member });
      return 0;
    }

    try {
      return await redis.sAdd(key, member);
    } catch (error) {
      logger.error('Redis SADD operation failed:', { key, member, error });
      throw error;
    }
  },

  sMembers: async (key: string): Promise<string[]> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis SMEMBERS operation skipped - Redis not available:', { key });
      return [];
    }

    try {
      return await redis.sMembers(key);
    } catch (error) {
      logger.error('Redis SMEMBERS operation failed:', { key, error });
      throw error;
    }
  },

  // Expiration
  expire: async (key: string, seconds: number): Promise<boolean> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis EXPIRE operation skipped - Redis not available:', { key, seconds });
      return false;
    }

    try {
      return await redis.expire(key, seconds);
    } catch (error) {
      logger.error('Redis EXPIRE operation failed:', { key, seconds, error });
      throw error;
    }
  },

  ttl: async (key: string): Promise<number> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis TTL operation skipped - Redis not available:', { key });
      return -1;
    }

    try {
      return await redis.ttl(key);
    } catch (error) {
      logger.error('Redis TTL operation failed:', { key, error });
      throw error;
    }
  },

  // Utility
  exists: async (key: string): Promise<number> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis EXISTS operation skipped - Redis not available:', { key });
      return 0;
    }

    try {
      return await redis.exists(key);
    } catch (error) {
      logger.error('Redis EXISTS operation failed:', { key, error });
      throw error;
    }
  },

  keys: async (pattern: string): Promise<string[]> => {
    const redis = getRedis();
    if (!redis || !isRedisEnabled()) {
      logger.warn('Redis KEYS operation skipped - Redis not available:', { pattern });
      return [];
    }

    try {
      return await redis.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS operation failed:', { pattern, error });
      throw error;
    }
  }
};