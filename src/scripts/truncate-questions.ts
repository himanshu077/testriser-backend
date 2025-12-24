import { db } from '../config/database';
import { questions } from '../models/schema';
import { sql } from 'drizzle-orm';

/**
 * Script to truncate all questions from the database
 *
 * WARNING: This will delete ALL questions and related data:
 * - All questions
 * - All student answers
 * - All question practice records
 * - All mock test question mappings
 *
 * This action is IRREVERSIBLE!
 *
 * Usage: npx tsx src/scripts/truncate-questions.ts
 */

async function truncateQuestions() {
  try {
    console.log('\n⚠️  WARNING: This will delete ALL questions and related data!');
    console.log('⚠️  This action is IRREVERSIBLE!\n');

    // Count questions before deletion
    const countResult = await db.select({ count: sql<number>`COUNT(*)::int` }).from(questions);
    const totalQuestions = countResult[0]?.count || 0;

    console.log(`📊 Total questions in database: ${totalQuestions}`);

    if (totalQuestions === 0) {
      console.log('✅ No questions to delete. Database is already empty.');
      process.exit(0);
    }

    console.log('\n🗑️  Truncating questions table...\n');

    // Execute TRUNCATE CASCADE using raw SQL
    await db.execute(sql`TRUNCATE questions CASCADE;`);

    console.log('✅ Successfully truncated questions table!');
    console.log(`✅ Deleted ${totalQuestions} questions and all related data.`);
    console.log('\n✨ Database is now clean.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error truncating questions:', error);
    console.error('\nError details:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Execute the script
truncateQuestions();
