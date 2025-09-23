import { Client } from 'pg';
import { logger } from '../monitoring/logger';

let client: Client | null = null;
let databaseEnabled: boolean = true;

export const isDatabaseEnabled = (): boolean => {
  return process.env.DATABASE_ENABLED !== 'false' && databaseEnabled;
};

export const connectDatabase = async (): Promise<Client | null> => {
  // Check if database is disabled
  if (process.env.DATABASE_ENABLED === 'false') {
    logger.info('Database is disabled by configuration (DATABASE_ENABLED=false)');
    databaseEnabled = false;
    return null;
  }

  if (client) {
    return client;
  }

  try {
    const connectionConfig = {
      connectionString: process.env.DATABASE_URL,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'notification_service',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error if connection takes longer than 10 seconds
    };

    client = new Client(connectionConfig);
    await client.connect();

    logger.info('Connected to PostgreSQL database successfully');

    // Test the connection
    const result = await client.query('SELECT NOW()');
    logger.info('Database connection test successful', { timestamp: result.rows[0].now });
    databaseEnabled = true;

    return client;
  } catch (error) {
    logger.warn('Failed to connect to PostgreSQL database, continuing without database:', error);
    logger.warn('Service will run with in-memory storage - data will not persist');
    databaseEnabled = false;
    client = null;
    return null;
  }
};

export const getDatabase = (): Client => {
  if (!client || !isDatabaseEnabled()) {
    throw new Error('Database not connected or disabled. Use storage adapter instead.');
  }
  return client;
};

export const closeDatabaseConnection = async (): Promise<void> => {
  if (client) {
    await client.end();
    client = null;
    logger.info('Database connection closed');
  }
};

// Health check function
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    if (!client || !isDatabaseEnabled()) {
      return false;
    }

    await client.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};

// Query helper with error handling and metrics
export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();

  try {
    const db = getDatabase();
    const result = await db.query(text, params);

    const duration = Date.now() - start;
    logger.debug('Query executed successfully', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rowCount: result.rowCount
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Query execution failed', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      error: (error as Error).message
    });
    throw error;
  }
};

// Transaction helper
export const withTransaction = async <T>(
  callback: (client: Client) => Promise<T>
): Promise<T> => {
  const db = getDatabase();

  try {
    await db.query('BEGIN');
    const result = await callback(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
};