import { createClient, RedisClientType } from 'redis';
import { logger } from '../monitoring/logger';

let redisClient: RedisClientType | null = null;

export const connectRedis = async (): Promise<RedisClientType> => {
  if (redisClient) {
    return redisClient;
  }

  try {
    const redisConfig = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 10000,
        lazyConnect: true,
      },
      password: process.env.REDIS_PASSWORD || undefined,
    };

    redisClient = createClient(redisConfig);

    // Error handling
    redisClient.on('error', (error) => {
      logger.error('Redis client error:', error);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis client connection ended');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });

    await redisClient.connect();

    // Test the connection
    await redisClient.ping();
    logger.info('Redis connection test successful');

    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

export const getRedis = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
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
    if (!redisClient) {
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
    try {
      const redis = getRedis();
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
    try {
      const redis = getRedis();
      return await redis.get(key);
    } catch (error) {
      logger.error('Redis GET operation failed:', { key, error });
      throw error;
    }
  },

  del: async (key: string): Promise<number> => {
    try {
      const redis = getRedis();
      return await redis.del(key);
    } catch (error) {
      logger.error('Redis DEL operation failed:', { key, error });
      throw error;
    }
  },

  // Hash operations
  hSet: async (key: string, field: string, value: string): Promise<void> => {
    try {
      const redis = getRedis();
      await redis.hSet(key, field, value);
    } catch (error) {
      logger.error('Redis HSET operation failed:', { key, field, error });
      throw error;
    }
  },

  hGet: async (key: string, field: string): Promise<string | undefined> => {
    try {
      const redis = getRedis();
      return await redis.hGet(key, field);
    } catch (error) {
      logger.error('Redis HGET operation failed:', { key, field, error });
      throw error;
    }
  },

  hGetAll: async (key: string): Promise<Record<string, string>> => {
    try {
      const redis = getRedis();
      return await redis.hGetAll(key);
    } catch (error) {
      logger.error('Redis HGETALL operation failed:', { key, error });
      throw error;
    }
  },

  // List operations
  lPush: async (key: string, value: string): Promise<number> => {
    try {
      const redis = getRedis();
      return await redis.lPush(key, value);
    } catch (error) {
      logger.error('Redis LPUSH operation failed:', { key, error });
      throw error;
    }
  },

  rPop: async (key: string): Promise<string | null> => {
    try {
      const redis = getRedis();
      return await redis.rPop(key);
    } catch (error) {
      logger.error('Redis RPOP operation failed:', { key, error });
      throw error;
    }
  },

  // Set operations
  sAdd: async (key: string, member: string): Promise<number> => {
    try {
      const redis = getRedis();
      return await redis.sAdd(key, member);
    } catch (error) {
      logger.error('Redis SADD operation failed:', { key, member, error });
      throw error;
    }
  },

  sMembers: async (key: string): Promise<string[]> => {
    try {
      const redis = getRedis();
      return await redis.sMembers(key);
    } catch (error) {
      logger.error('Redis SMEMBERS operation failed:', { key, error });
      throw error;
    }
  },

  // Expiration
  expire: async (key: string, seconds: number): Promise<boolean> => {
    try {
      const redis = getRedis();
      return await redis.expire(key, seconds);
    } catch (error) {
      logger.error('Redis EXPIRE operation failed:', { key, seconds, error });
      throw error;
    }
  },

  ttl: async (key: string): Promise<number> => {
    try {
      const redis = getRedis();
      return await redis.ttl(key);
    } catch (error) {
      logger.error('Redis TTL operation failed:', { key, error });
      throw error;
    }
  },

  // Utility
  exists: async (key: string): Promise<number> => {
    try {
      const redis = getRedis();
      return await redis.exists(key);
    } catch (error) {
      logger.error('Redis EXISTS operation failed:', { key, error });
      throw error;
    }
  },

  keys: async (pattern: string): Promise<string[]> => {
    try {
      const redis = getRedis();
      return await redis.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS operation failed:', { pattern, error });
      throw error;
    }
  }
};