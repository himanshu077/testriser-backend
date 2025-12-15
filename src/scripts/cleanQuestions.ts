import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../models/schema';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function cleanQuestions() {
  console.log('🗑️  Cleaning questions table...');

  const sql = postgres(DATABASE_URL!, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    // Delete all questions
    const result = await db.delete(schema.questions);
    console.log('✅ Questions table cleaned successfully!');

    // Also clean books table to remove uploaded PDFs
    const booksResult = await db.delete(schema.books);
    console.log('✅ Books table cleaned successfully!');

    console.log('\n📊 Database is now clean and ready for fresh upload.');
  } catch (error: any) {
    console.error('❌ Clean failed:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

cleanQuestions()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
