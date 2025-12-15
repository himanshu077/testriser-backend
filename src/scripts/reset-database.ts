import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

async function resetDatabase() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, {
    ssl:
      connectionString.includes('supabase.com') || connectionString.includes('amazonaws.com')
        ? 'require'
        : 'prefer',
  });

  try {
    console.log('🗑️  Dropping all tables...');

    // Drop all tables in correct order (respecting foreign key constraints)
    await sql`DROP TABLE IF EXISTS student_answers CASCADE`;
    await sql`DROP TABLE IF EXISTS student_exams CASCADE`;
    await sql`DROP TABLE IF EXISTS question_practice CASCADE`;
    await sql`DROP TABLE IF EXISTS mock_test_questions CASCADE`;
    await sql`DROP TABLE IF EXISTS mock_tests CASCADE`;
    await sql`DROP TABLE IF EXISTS questions CASCADE`;
    await sql`DROP TABLE IF EXISTS papers CASCADE`;
    await sql`DROP TABLE IF EXISTS contact_submissions CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;

    // Drop enum type
    await sql`DROP TYPE IF EXISTS user_role CASCADE`;

    console.log('✅ All tables and types dropped successfully');
    console.log('');
    console.log('Now run: npm run db:push');
    console.log('Then run: npm run seed:prod');

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to reset database:', error);
    await sql.end();
    process.exit(1);
  }
}

resetDatabase();
