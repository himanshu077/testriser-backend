import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

async function addCurriculumChapterColumn() {
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
    console.log('🔧 Adding curriculum_chapter_id column to questions table...\n');

    // Add the column as nullable (won't affect existing data)
    await sql`
      ALTER TABLE questions
      ADD COLUMN IF NOT EXISTS curriculum_chapter_id UUID
      REFERENCES curriculum_chapters(id) ON DELETE SET NULL
    `;

    console.log('✅ Column added successfully!');
    console.log('📊 Existing questions will have NULL for this column');
    console.log('   New questions can link to curriculum chapters\n');

    await sql.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    await sql.end();
    process.exit(1);
  }
}

addCurriculumChapterColumn();
