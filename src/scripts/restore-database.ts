#!/usr/bin/env tsx

/**
 * Database Restore Script
 *
 * Restores a PostgreSQL database from a backup file
 *
 * Usage:
 *   npm run db:restore -- --file backup_2025-11-04_12-30-45.sql
 *   npm run db:restore -- --latest  - Restore from most recent backup
 *
 * WARNING: This will DROP and recreate the database!
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { config } from 'dotenv';

const execAsync = promisify(exec);

// Load environment variables
config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_DIR = path.join(process.cwd(), '..', 'backups', 'database');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg: string) => console.error(`${colors.red}[ERROR]${colors.reset} ${msg}`),
};

/**
 * Parse DATABASE_URL to get connection details
 */
function parseDatabaseUrl(url: string): {
  user: string;
  password: string;
  host: string;
  port: string;
  database: string;
} {
  const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = url.match(regex);

  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }

  return {
    user: decodeURIComponent(match[1]),
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

/**
 * Get user confirmation
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question} (yes/no):${colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Find latest backup file
 */
function findLatestBackup(): string | null {
  if (!fs.existsSync(BACKUP_DIR)) {
    return null;
  }

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((file) => ({
      file,
      path: path.join(BACKUP_DIR, file),
      mtime: fs.statSync(path.join(BACKUP_DIR, file)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Sort by date, newest first

  return files.length > 0 ? files[0].file : null;
}

/**
 * Create a safety backup before restore
 */
async function createSafetyBackup(dbConfig: any): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];

  const safetyBackupFile = `safety_backup_before_restore_${timestamp}.sql`;
  const safetyBackupPath = path.join(BACKUP_DIR, safetyBackupFile);

  log.info('Creating safety backup of current database...');

  const env = {
    ...process.env,
    PGPASSWORD: dbConfig.password,
  };

  const command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -F p -f "${safetyBackupPath}"`;

  try {
    await execAsync(command, { env });
    log.success(`Safety backup created: ${safetyBackupFile}`);
    return safetyBackupPath;
  } catch {
    log.warning('Could not create safety backup (database might be empty)');
    return '';
  }
}

/**
 * Restore database from backup file
 */
async function restoreDatabase(backupFile: string): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const backupPath = path.join(BACKUP_DIR, backupFile);

  // Check if backup file exists
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const dbConfig = parseDatabaseUrl(DATABASE_URL);

  // Get file size
  const stats = fs.statSync(backupPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('');
  log.warning('⚠️  DATABASE RESTORE OPERATION ⚠️');
  console.log('');
  log.info(`Backup file: ${backupFile}`);
  log.info(`Size: ${sizeMB} MB`);
  log.info(`Database: ${dbConfig.database}`);
  log.info(`Host: ${dbConfig.host}:${dbConfig.port}`);
  console.log('');
  log.warning('This will DROP all existing tables and data!');
  console.log('');

  // Ask for confirmation
  const confirmed = await askConfirmation('Are you sure you want to restore from this backup?');

  if (!confirmed) {
    log.info('Restore cancelled by user');
    return;
  }

  // Create safety backup
  await createSafetyBackup(dbConfig);

  // Set environment variables for psql authentication
  const env = {
    ...process.env,
    PGPASSWORD: dbConfig.password,
  };

  log.info('Starting database restore...');

  // Drop existing connections
  log.info('Terminating existing connections...');
  const terminateCommand = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${dbConfig.database}' AND pid <> pg_backend_pid();"`;

  try {
    await execAsync(terminateCommand, { env });
  } catch {
    log.warning('Could not terminate connections (might be none)');
  }

  // Drop and recreate database
  log.info('Dropping and recreating database...');
  const dropCommand = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d postgres -c "DROP DATABASE IF EXISTS ${dbConfig.database};"`;
  const createCommand = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d postgres -c "CREATE DATABASE ${dbConfig.database};"`;

  try {
    await execAsync(dropCommand, { env });
    await execAsync(createCommand, { env });
  } catch (error) {
    throw new Error(`Failed to recreate database: ${error}`);
  }

  // Restore from backup
  log.info('Restoring data from backup...');
  const restoreCommand = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f "${backupPath}"`;

  try {
    const { stderr } = await execAsync(restoreCommand, { env });

    if (stderr && !stderr.includes('NOTICE') && !stderr.includes('WARNING')) {
      log.warning(`psql warnings: ${stderr}`);
    }

    log.success('Database restored successfully!');
    console.log('');
    log.info('Next steps:');
    log.info('  - Verify data: npm run db:studio');
    log.info('  - Run migrations if needed: npm run db:push');
    log.info('  - Restart backend: npm run dev');
  } catch (error) {
    log.error(`Restore failed: ${error}`);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  console.log('');
  console.log('='.repeat(60));
  console.log('Database Restore Script');
  console.log('='.repeat(60));
  console.log('');

  try {
    let backupFile: string | null = null;

    // Check for --latest flag
    if (args.includes('--latest')) {
      backupFile = findLatestBackup();
      if (!backupFile) {
        throw new Error('No backup files found');
      }
      log.info(`Using latest backup: ${backupFile}`);
    }
    // Check for --file flag
    else {
      const fileIndex = args.indexOf('--file');
      if (fileIndex === -1 || !args[fileIndex + 1]) {
        throw new Error('Please specify backup file: --file <filename> or use --latest');
      }
      backupFile = args[fileIndex + 1];
    }

    await restoreDatabase(backupFile);

    console.log('');
    console.log('='.repeat(60));
    log.success('Restore process completed!');
    console.log('='.repeat(60));
    console.log('');
  } catch (error) {
    console.log('');
    console.log('='.repeat(60));
    log.error('Restore process failed!');
    log.error(error instanceof Error ? error.message : String(error));
    console.log('='.repeat(60));
    console.log('');
    process.exit(1);
  }
}

// Run main function
main();
