#!/usr/bin/env tsx

/**
 * Database Backup Script
 *
 * Creates a backup of the PostgreSQL database using pg_dump
 *
 * Usage:
 *   npm run db:backup                    - Create backup with timestamp
 *   npm run db:backup -- --name mybackup - Create backup with custom name
 *   npm run db:backup -- --list          - List available backups
 *
 * Backups are stored in: backups/database/
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

const execAsync = promisify(exec);

// Load environment variables
config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_DIR = path.join(process.cwd(), '..', 'backups', 'database');
const MAX_BACKUPS = 5; // Keep last 5 backups

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
 * Ensure backup directory exists
 */
function ensureBackupDirectory(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    log.info(`Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Generate backup filename
 */
function generateBackupFilename(customName?: string): string {
  if (customName) {
    return `${customName}.sql`;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0]; // Format: 2025-11-04_12-30-45

  return `backup_${timestamp}.sql`;
}

/**
 * Create database backup using pg_dump
 */
async function createBackup(filename: string): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const dbConfig = parseDatabaseUrl(DATABASE_URL);
  const backupPath = path.join(BACKUP_DIR, filename);

  log.info(`Creating backup: ${filename}`);
  log.info(`Database: ${dbConfig.database}`);
  log.info(`Host: ${dbConfig.host}:${dbConfig.port}`);

  // Set environment variables for pg_dump authentication
  const env = {
    ...process.env,
    PGPASSWORD: dbConfig.password,
  };

  // Execute pg_dump command
  const command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -F p -f "${backupPath}"`;

  try {
    const { stdout, stderr } = await execAsync(command, { env });

    if (stderr && !stderr.includes('Warning')) {
      log.warning(`pg_dump warnings: ${stderr}`);
    }

    // Check if backup file was created and has content
    const stats = fs.statSync(backupPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    log.success(`Backup created successfully!`);
    log.info(`Location: ${backupPath}`);
    log.info(`Size: ${sizeMB} MB`);

    // Cleanup old backups
    await cleanupOldBackups();
  } catch (error) {
    log.error(`Backup failed: ${error}`);
    throw error;
  }
}

/**
 * List all available backups
 */
function listBackups(): void {
  ensureBackupDirectory();

  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.sql'));

  if (files.length === 0) {
    log.warning('No backups found');
    return;
  }

  console.log(`\n${colors.bright}Available Backups:${colors.reset}\n`);

  files
    .map((file) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      const date = stats.mtime.toLocaleString();

      return { file, sizeMB, date, mtime: stats.mtime };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()) // Sort by date, newest first
    .forEach(({ file, sizeMB, date }, index) => {
      console.log(`${index + 1}. ${file}`);
      console.log(`   Size: ${sizeMB} MB`);
      console.log(`   Created: ${date}`);
      console.log('');
    });

  log.info(`Total backups: ${files.length}`);
  log.info(`Backup directory: ${BACKUP_DIR}`);
}

/**
 * Cleanup old backups (keep only MAX_BACKUPS)
 */
async function cleanupOldBackups(): Promise<void> {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((file) => ({
      file,
      path: path.join(BACKUP_DIR, file),
      mtime: fs.statSync(path.join(BACKUP_DIR, file)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Sort by date, newest first

  if (files.length > MAX_BACKUPS) {
    const filesToDelete = files.slice(MAX_BACKUPS);

    log.info(`Cleaning up old backups (keeping last ${MAX_BACKUPS} backups)...`);

    filesToDelete.forEach(({ file, path }) => {
      fs.unlinkSync(path);
      log.info(`Deleted old backup: ${file}`);
    });
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  console.log('');
  console.log('='.repeat(60));
  console.log('Database Backup Script');
  console.log('='.repeat(60));
  console.log('');

  try {
    ensureBackupDirectory();

    // Check for --list flag
    if (args.includes('--list')) {
      listBackups();
      return;
    }

    // Check for custom name
    const nameIndex = args.indexOf('--name');
    const customName = nameIndex !== -1 ? args[nameIndex + 1] : undefined;

    const filename = generateBackupFilename(customName);
    await createBackup(filename);

    console.log('');
    console.log('='.repeat(60));
    log.success('Backup process completed!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Next steps:');
    console.log('  - View backups: npm run db:backup -- --list');
    console.log('  - Restore backup: npm run db:restore -- --file <filename>');
    console.log('');
  } catch (error) {
    console.log('');
    console.log('='.repeat(60));
    log.error('Backup process failed!');
    console.log('='.repeat(60));
    console.log('');
    process.exit(1);
  }
}

// Run main function
main();
