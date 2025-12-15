import * as dotenv from 'dotenv';
import postgres from 'postgres';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

dotenv.config();

async function recreateDatabase() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, {
    ssl:
      connectionString.includes('supabase.com') || connectionString.includes('amazonaws.com')
        ? 'require'
        : 'prefer',
  });

  try {
    console.log('🔧 Dropping all tables...');

    // Drop all tables first (including old ones)
    await sql`DROP TABLE IF EXISTS student_answers CASCADE`;
    await sql`DROP TABLE IF EXISTS student_exams CASCADE`;
    await sql`DROP TABLE IF EXISTS question_practice CASCADE`;
    await sql`DROP TABLE IF EXISTS mock_test_questions CASCADE`;
    await sql`DROP TABLE IF EXISTS mock_tests CASCADE`;
    await sql`DROP TABLE IF EXISTS questions CASCADE`;
    await sql`DROP TABLE IF EXISTS papers CASCADE`;
    await sql`DROP TABLE IF EXISTS contact_submissions CASCADE`;
    await sql`DROP TABLE IF EXISTS books CASCADE`;
    await sql`DROP TABLE IF EXISTS curriculum_chapters CASCADE`;
    await sql`DROP TABLE IF EXISTS subjects CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    // Drop old tables that were removed
    await sql`DROP TABLE IF EXISTS chapters CASCADE`;
    await sql`DROP TABLE IF EXISTS concepts CASCADE`;
    await sql`DROP TABLE IF EXISTS topics CASCADE`;

    console.log('✅ All tables dropped');

    console.log('🔧 Dropping all enum types...');

    // Drop all custom enum types
    await sql`DROP TYPE IF EXISTS user_role CASCADE`;
    await sql`DROP TYPE IF EXISTS difficulty CASCADE`;
    await sql`DROP TYPE IF EXISTS question_type CASCADE`;
    await sql`DROP TYPE IF EXISTS exam_status CASCADE`;
    await sql`DROP TYPE IF EXISTS student_exam_status CASCADE`;
    await sql`DROP TYPE IF EXISTS mock_test_type CASCADE`;
    await sql`DROP TYPE IF EXISTS book_type CASCADE`;
    await sql`DROP TYPE IF EXISTS pyq_type CASCADE`;
    await sql`DROP TYPE IF EXISTS book_upload_status CASCADE`;

    console.log('✅ All enum types dropped');

    await sql.end();

    console.log('\n🔨 Generating migrations...');

    // Generate migrations from schema
    await execAsync('npx drizzle-kit generate');

    console.log('\n🔨 Applying migrations...');

    // Run migrate to create all tables
    await execAsync('npm run db:migrate');

    console.log('\n✅ Database recreated successfully');
    console.log('\nNow run: npm run seed');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

recreateDatabase();
