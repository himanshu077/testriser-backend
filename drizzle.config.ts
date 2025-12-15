import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const isCloudDatabase =
  connectionString.includes('supabase.com') ||
  connectionString.includes('amazonaws.com') ||
  connectionString.includes('rds.amazonaws.com');

// Add SSL parameters to connection string for cloud databases
const urlWithSSL = isCloudDatabase && !connectionString.includes('ssl=')
  ? `${connectionString}?ssl=true&sslmode=require`
  : connectionString;

export default {
  schema: './src/models/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: urlWithSSL,
  },
  // Exclude PostgreSQL extension views from schema management
  tablesFilter: ['!pg_stat_statements*'],
  // Enable Drizzle Studio
  verbose: true,
  strict: true,
} satisfies Config;
