import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

async function checkTable() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: process.env.DATABASE_URL!.includes('supabase.com') ? 'require' : 'prefer',
  });

  try {
    // Get actual column names from the questions table
    const result = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'questions'
      ORDER BY ordinal_position
    `;

    console.log('\n📋 Columns in questions table:\n');
    result.forEach((col) => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    console.log(`\n✅ Total columns: ${result.length}\n`);

    await sql.end();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await sql.end();
  }
}

checkTable();
