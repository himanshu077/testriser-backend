import type { Config } from 'drizzle-kit';

/**
 * Production Drizzle Studio Configuration
 *
 * Usage:
 *   1. Set up SSH tunnel to production database:
 *      ssh -L 5432:localhost:5432 user@your-ec2-ip
 *
 *   2. Set DATABASE_URL to tunnel connection:
 *      export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
 *
 *   3. Run Drizzle Studio:
 *      npm run db:studio:prod
 *
 * This will connect to production database via SSH tunnel
 */

export default {
  schema: './src/models/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Connect via SSH tunnel on localhost
    url: process.env.DATABASE_URL!,
  },
  // Exclude PostgreSQL extension views from schema management
  tablesFilter: ['!pg_stat_statements*'],
  verbose: true,
  strict: true,
} satisfies Config;
