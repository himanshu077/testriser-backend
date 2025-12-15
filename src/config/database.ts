import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../models/schema';

// Load environment variables first
dotenv.config();

const connectionString = process.env.DATABASE_URL!;

// Connection pool event tracking
let connectionCount = 0;
let queryCount = 0;

// Create postgres client with production-ready configuration
export const client = postgres(connectionString, {
  // Use 'require' for Supabase/AWS, 'prefer' for local
  ssl:
    connectionString.includes('supabase.com') || connectionString.includes('amazonaws.com')
      ? 'require'
      : 'prefer',
  max: 10, // Maximum connections in pool
  idle_timeout: 20, // Close idle connections after 20s
  connect_timeout: 10, // Connection timeout
  max_lifetime: 60 * 30, // Close connections after 30 minutes
  onnotice: () => {}, // Suppress notices in production

  // Debug mode for development
  debug:
    process.env.NODE_ENV !== 'production'
      ? (_connection: unknown, query: string, _params: unknown[]) => {
          queryCount++;
          if (process.env.LOG_QUERIES === 'true') {
            console.log(`[QUERY #${queryCount}]`, query);
          }
        }
      : undefined,
});

// Create drizzle instance
export const db = drizzle(client, { schema });

/**
 * Get connection pool statistics
 */
export function getConnectionStats() {
  return {
    totalConnections: connectionCount,
    totalQueries: queryCount,
    maxConnections: 10,
  };
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await client`SELECT 1 as test`;
    return true;
  } catch (error) {
    console.error('[DB] Connection test failed:', error);
    return false;
  }
}

/**
 * Close database connection gracefully
 */
export async function closeConnection(): Promise<void> {
  try {
    await client.end();
    console.log('[DB] Connection closed gracefully');
  } catch (error) {
    console.error('[DB] Error closing connection:', error);
  }
}

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('[DB] SIGTERM received, closing database connection...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[DB] SIGINT received, closing database connection...');
  await closeConnection();
  process.exit(0);
});

export default db;
