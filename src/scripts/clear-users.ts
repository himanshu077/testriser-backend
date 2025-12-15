import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

async function clearUsers() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, {
    ssl:
      connectionString.includes('supabase.com') || connectionString.includes('amazonaws.com')
        ? 'require'
        : 'prefer',
  });

  try {
    await sql`DELETE FROM users`;
    console.log('✅ Users cleared');
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to clear users:', error);
    await sql.end();
    process.exit(1);
  }
}

clearUsers();
