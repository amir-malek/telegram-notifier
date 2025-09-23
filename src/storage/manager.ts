import { StorageAdapter } from './adapter';
import { InMemoryStorageAdapter } from './memory';
import { PostgreSQLStorageAdapter } from './postgresql';
import { logger } from '../monitoring/logger';
import { connectDatabase } from '../database/connection';

export type StorageMode = 'auto' | 'database' | 'memory';

let storageAdapter: StorageAdapter | null = null;

export const initializeStorage = async (mode: StorageMode = 'auto'): Promise<StorageAdapter> => {
  if (storageAdapter) {
    return storageAdapter;
  }

  logger.info(`Initializing storage with mode: ${mode}`);

  try {
    if (mode === 'memory') {
      // Force in-memory mode
      storageAdapter = new InMemoryStorageAdapter();
      await storageAdapter.connect();
      logger.info('Storage initialized in memory-only mode');
    } else if (mode === 'database') {
      // Force database mode
      await connectDatabase();
      storageAdapter = new PostgreSQLStorageAdapter();
      await storageAdapter.connect();
      logger.info('Storage initialized in database mode');
    } else {
      // Auto mode: try database first, fallback to memory
      try {
        // Check if database is disabled
        if (process.env.DATABASE_ENABLED === 'false') {
          throw new Error('Database disabled by configuration');
        }

        await connectDatabase();
        storageAdapter = new PostgreSQLStorageAdapter();
        await storageAdapter.connect();

        // Test the connection
        const isHealthy = await storageAdapter.isHealthy();
        if (!isHealthy) {
          throw new Error('Database health check failed');
        }

        logger.info('Storage initialized in database mode');
      } catch (error) {
        logger.warn('Database connection failed, falling back to in-memory storage:', error);
        logger.warn('⚠️  Data will not persist across service restarts');

        storageAdapter = new InMemoryStorageAdapter();
        await storageAdapter.connect();
        logger.info('Storage initialized in memory mode (fallback)');
      }
    }

    return storageAdapter;
  } catch (error) {
    logger.error('Failed to initialize storage:', error);
    throw error;
  }
};

export const getStorage = (): StorageAdapter => {
  if (!storageAdapter) {
    throw new Error('Storage not initialized. Call initializeStorage() first.');
  }
  return storageAdapter;
};

export const closeStorage = async (): Promise<void> => {
  if (storageAdapter) {
    await storageAdapter.disconnect();
    storageAdapter = null;
    logger.info('Storage connection closed');
  }
};

export const getStorageMode = (): string => {
  if (!storageAdapter) {
    return 'not_initialized';
  }
  return storageAdapter.type;
};

export const isStorageHealthy = async (): Promise<boolean> => {
  if (!storageAdapter) {
    return false;
  }

  try {
    return await storageAdapter.isHealthy();
  } catch (error) {
    logger.error('Storage health check failed:', error);
    return false;
  }
};

export const getStorageStats = async (): Promise<any> => {
  if (!storageAdapter) {
    return null;
  }

  const stats = {
    type: storageAdapter.type,
    isConnected: storageAdapter.isConnected,
    isHealthy: await storageAdapter.isHealthy()
  };

  // Add memory-specific stats if available
  if (storageAdapter.getStorageStats) {
    const memoryStats = await storageAdapter.getStorageStats();
    return { ...stats, ...memoryStats };
  }

  return stats;
};