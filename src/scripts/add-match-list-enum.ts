import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

async function addMatchListEnum() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, {
    ssl:
      connectionString.includes('supabase.com') || connectionString.includes('amazonaws.com')
        ? 'require'
        : 'prefer',
  });

  try {
    console.log('🔧 Adding match_list to question_type enum...');

    // Add the new enum value
    await sql`ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'match_list'`;

    console.log('✅ Successfully added match_list to question_type enum');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

addMatchListEnum();
