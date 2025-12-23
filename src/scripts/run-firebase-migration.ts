/**
 * Run Firebase User ID Migration
 * Changes user_id columns from UUID to TEXT for Firebase UID support
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

async function runMigration() {
  console.log('🔄 Running Firebase User ID Migration\n');

  const client = postgres(connectionString);

  try {
    // Read the migration SQL file
    const migrationPath = path.join(
      __dirname,
      '../migrations/change_userid_to_text_for_firebase.sql'
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Executing migration SQL...\n');

    // Execute the migration
    await client.unsafe(migrationSql);

    console.log('✅ Migration completed successfully!');
    console.log('   - ai_chat_sessions.user_id changed to TEXT');
    console.log('   - ai_usage_tracking.user_id changed to TEXT');
    console.log('   - Foreign key constraints removed');
    console.log('   - Indexes created for performance\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
