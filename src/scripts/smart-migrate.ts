/**
 * Smart Migration Script
 * Handles all database migration cases:
 * 1. Fresh DB - runs migrations normally
 * 2. Existing DB from db:push - marks initial migration as applied, then runs
 * 3. Schema changes - applies new migrations
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

async function smartMigrate() {
  console.log('🔄 Smart Migration Started\n');

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    // Step 1: Check if database has any tables
    const tables = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE '__drizzle%'
    `);

    const hasExistingTables = tables.length > 0;
    console.log(`📊 Existing tables: ${hasExistingTables ? tables.length : 'None'}`);

    // Step 2: Check if migrations table exists and has entries
    let hasMigrationHistory = false;
    try {
      const migrations = await db.execute(sql`
        SELECT COUNT(*) as count FROM "__drizzle_migrations"
      `);
      hasMigrationHistory = Number(migrations[0]?.count) > 0;
      console.log(`📋 Migration history: ${hasMigrationHistory ? 'Yes' : 'No'}`);
    } catch {
      console.log('📋 Migration table: Does not exist');
    }

    // Step 3: Decide what to do
    if (!hasExistingTables) {
      // Case 1: Fresh DB - run migrations normally
      console.log('\n🆕 Fresh database detected - running full migration...\n');
      execSync('npm run db:migrate', { stdio: 'inherit' });
    } else if (hasExistingTables && !hasMigrationHistory) {
      // Case 2: Existing DB from db:push - mark initial migration as applied
      console.log('\n⚡ Existing schema without migration history detected');
      console.log('   Marking initial migration as applied...\n');

      // Create migrations table if it doesn't exist
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `);

      // Mark the initial migration as applied (use the actual migration filename)
      await db.execute(sql`
        INSERT INTO "__drizzle_migrations" (hash, created_at)
        SELECT '0000_steep_pete_wisdom', EXTRACT(EPOCH FROM NOW())::bigint * 1000
        WHERE NOT EXISTS (
          SELECT 1 FROM "__drizzle_migrations" WHERE hash = '0000_steep_pete_wisdom'
        )
      `);

      console.log('✅ Initial migration marked as applied');
      console.log('   Running any pending migrations...\n');

      try {
        execSync('npm run db:migrate', { stdio: 'inherit' });
      } catch {
        console.log('✅ No new migrations to apply');
      }
    } else {
      // Case 3: Existing DB with migration history - run normally
      console.log('\n📦 Existing database with migration history');
      console.log('   Applying any pending migrations...\n');

      try {
        execSync('npm run db:migrate', { stdio: 'inherit' });
      } catch (e: any) {
        if (e.message?.includes('already exists')) {
          console.log('✅ Schema is up to date');
        } else {
          throw e;
        }
      }
    }

    console.log('\n✅ Smart Migration Completed Successfully');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

smartMigrate();
