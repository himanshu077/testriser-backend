import { db } from '../config/database';
import { books, questions } from '../models/schema';

async function clearBooksAndQuestions() {
  console.log('🗑️  Clearing books and questions tables...');

  try {
    // Delete questions first (has foreign key to books)
    await db.delete(questions);
    console.log('✅ Deleted all questions');

    // Delete books
    await db.delete(books);
    console.log('✅ Deleted all books');

    console.log('\n✅ Done! Tables cleared successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearBooksAndQuestions();
