import * as dotenv from 'dotenv';
import postgres from 'postgres';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

dotenv.config();

async function freshDatabase() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, {
    ssl:
      connectionString.includes('supabase.com') || connectionString.includes('amazonaws.com')
        ? 'require'
        : 'prefer',
  });

  try {
    console.log('🔧 Dropping all schemas...');

    // Drop the public schema and recreate it (nuclear option)
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await sql`CREATE SCHEMA public`;
    await sql`GRANT ALL ON SCHEMA public TO postgres`;
    await sql`GRANT ALL ON SCHEMA public TO public`;

    // Drop drizzle schema too
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;

    console.log('✅ All schemas dropped and recreated');

    await sql.end();

    console.log('\n🔨 Generating fresh migrations...');

    // Delete old migrations
    await execAsync('rm -rf drizzle');

    // Generate fresh migrations
    await execAsync('npx drizzle-kit generate');

    console.log('\n🔨 Applying migrations...');

    // Apply migrations
    await execAsync('npm run db:migrate');

    console.log('\n✅ Database recreated successfully');
    console.log('\nNow run: npm run seed');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

freshDatabase();
