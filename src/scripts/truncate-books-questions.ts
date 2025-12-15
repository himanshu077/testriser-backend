import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

async function truncateTables() {
  const connectionString = process.env.DATABASE_URL!;

  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in .env');
    process.exit(1);
  }

  const sql = postgres(connectionString, {
    ssl:
      connectionString.includes('supabase.com') || connectionString.includes('amazonaws.com')
        ? 'require'
        : 'prefer',
  });

  try {
    console.log('🗑️  Truncating books and questions tables...\n');

    // Truncate questions first (has foreign key to books)
    await sql`TRUNCATE TABLE questions CASCADE`;
    console.log('✅ Questions table truncated');

    // Truncate books
    await sql`TRUNCATE TABLE books CASCADE`;
    console.log('✅ Books table truncated');

    // Also truncate related tables if they exist
    await sql`TRUNCATE TABLE mock_test_questions CASCADE`;
    console.log('✅ Mock test questions truncated');

    await sql`TRUNCATE TABLE student_answers CASCADE`;
    console.log('✅ Student answers truncated');

    await sql`TRUNCATE TABLE question_practice CASCADE`;
    console.log('✅ Question practice truncated');

    console.log('\n✨ All book and question data cleared!');
    console.log('📊 Kept: Users, subjects, curriculum chapters');
    console.log('\nYou can now upload fresh PDFs.\n');

    await sql.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    await sql.end();
    process.exit(1);
  }
}

truncateTables();
