import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Migration {
  version: string;
  filename: string;
  content: string;
}

class MigrationRunner {
  private client: Client;

  constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'notification_service',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log('Connected to database for migrations');
  }

  async disconnect(): Promise<void> {
    await this.client.end();
    console.log('Disconnected from database');
  }

  async createMigrationTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `;

    await this.client.query(createTableSQL);
    console.log('Created schema_migrations table if not exists');
  }

  async getAppliedMigrations(): Promise<string[]> {
    const result = await this.client.query(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    );
    return result.rows.map(row => row.version);
  }

  async loadMigrations(): Promise<Migration[]> {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const filename of files) {
      const version = filename.replace('.sql', '');
      const filePath = path.join(migrationsDir, filename);
      const content = fs.readFileSync(filePath, 'utf8');

      migrations.push({
        version,
        filename,
        content
      });
    }

    return migrations;
  }

  async runMigration(migration: Migration): Promise<void> {
    console.log(`Running migration: ${migration.filename}`);

    try {
      // Start transaction
      await this.client.query('BEGIN');

      // Execute migration
      await this.client.query(migration.content);

      // Record migration as applied
      await this.client.query(
        'INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)',
        [migration.version, migration.filename]
      );

      // Commit transaction
      await this.client.query('COMMIT');

      console.log(`✅ Migration ${migration.filename} applied successfully`);
    } catch (error) {
      // Rollback on error
      await this.client.query('ROLLBACK');
      console.error(`❌ Migration ${migration.filename} failed:`, error);
      throw error;
    }
  }

  async migrate(): Promise<void> {
    try {
      await this.connect();
      await this.createMigrationTable();

      const appliedMigrations = await this.getAppliedMigrations();
      const allMigrations = await this.loadMigrations();

      const pendingMigrations = allMigrations.filter(
        migration => !appliedMigrations.includes(migration.version)
      );

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations');
        return;
      }

      console.log(`📋 Found ${pendingMigrations.length} pending migrations`);

      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
      }

      console.log(`🎉 Successfully applied ${pendingMigrations.length} migrations`);

    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }

  async rollback(targetVersion?: string): Promise<void> {
    try {
      await this.connect();
      await this.createMigrationTable();

      const appliedMigrations = await this.getAppliedMigrations();

      if (appliedMigrations.length === 0) {
        console.log('No migrations to rollback');
        return;
      }

      let migrationsToRollback: string[];

      if (targetVersion) {
        const targetIndex = appliedMigrations.indexOf(targetVersion);
        if (targetIndex === -1) {
          throw new Error(`Migration ${targetVersion} not found in applied migrations`);
        }
        migrationsToRollback = appliedMigrations.slice(targetIndex + 1).reverse();
      } else {
        // Rollback last migration
        migrationsToRollback = [appliedMigrations[appliedMigrations.length - 1]];
      }

      console.log(`📋 Rolling back ${migrationsToRollback.length} migrations`);

      for (const version of migrationsToRollback) {
        console.log(`Rolling back migration: ${version}`);

        try {
          await this.client.query('BEGIN');

          // Remove migration record
          await this.client.query(
            'DELETE FROM schema_migrations WHERE version = $1',
            [version]
          );

          await this.client.query('COMMIT');
          console.log(`✅ Rolled back migration: ${version}`);
        } catch (error) {
          await this.client.query('ROLLBACK');
          console.error(`❌ Failed to rollback migration ${version}:`, error);
          throw error;
        }
      }

      console.log(`🎉 Successfully rolled back ${migrationsToRollback.length} migrations`);
      console.log('⚠️  Note: You may need to manually clean up database changes');

    } catch (error) {
      console.error('Rollback failed:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }

  async status(): Promise<void> {
    try {
      await this.connect();
      await this.createMigrationTable();

      const appliedMigrations = await this.getAppliedMigrations();
      const allMigrations = await this.loadMigrations();

      console.log('\n📊 Migration Status:');
      console.log('==================');

      if (allMigrations.length === 0) {
        console.log('No migration files found');
        return;
      }

      for (const migration of allMigrations) {
        const isApplied = appliedMigrations.includes(migration.version);
        const status = isApplied ? '✅ Applied' : '⏳ Pending';
        console.log(`${status} - ${migration.filename}`);
      }

      const pendingCount = allMigrations.length - appliedMigrations.length;
      console.log(`\nTotal: ${allMigrations.length} migrations`);
      console.log(`Applied: ${appliedMigrations.length}`);
      console.log(`Pending: ${pendingCount}`);

    } catch (error) {
      console.error('Failed to get migration status:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';

  const runner = new MigrationRunner();

  switch (command) {
    case 'migrate':
    case 'up':
      await runner.migrate();
      break;

    case 'rollback':
    case 'down':
      const targetVersion = args[1];
      await runner.rollback(targetVersion);
      break;

    case 'status':
      await runner.status();
      break;

    default:
      console.log('Usage:');
      console.log('  npm run migrate          - Run pending migrations');
      console.log('  npm run migrate status   - Show migration status');
      console.log('  npm run migrate rollback [version] - Rollback migrations');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default MigrationRunner;