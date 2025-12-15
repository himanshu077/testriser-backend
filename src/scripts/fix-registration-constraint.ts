import * as dotenv from 'dotenv';
import postgres from 'postgres';

// Load environment variables
dotenv.config();

/**
 * Fix registration_number unique constraint issue
 * This script updates existing users to have unique registration numbers
 */
async function fixRegistrationConstraint() {
  console.log('🔧 Fixing registration_number unique constraint...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: process.env.NODE_ENV === 'production' ? 'require' : 'prefer',
    max: 1,
  });

  try {
    console.log('✓ Connected to database successfully');

    // Check if users table exists (for new databases)
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      ) as exists
    `;

    if (!tableCheck[0].exists) {
      console.log('\nℹ️  Users table does not exist yet - skipping fix');
      console.log('   This is normal for a new database');
      console.log('   Migrations will create the table with proper constraints');
      await sql.end();
      process.exit(0);
    }

    // Check existing users
    const users = await sql`SELECT id, email, role, registration_number FROM users`;
    console.log(`\n📊 Found ${users.length} users in database:`);
    users.forEach((user) => {
      console.log(
        `  - ${user.email} (${user.role}) - RegNo: ${user.registration_number || 'NULL'}`
      );
    });

    // Update users without registration numbers
    let updateCount = 0;
    for (const user of users) {
      if (!user.registration_number) {
        const regNo =
          user.role === 'admin'
            ? `ADMIN${String(updateCount + 1).padStart(3, '0')}`
            : `STUDENT${String(updateCount + 1).padStart(3, '0')}`;

        await sql`
          UPDATE users
          SET registration_number = ${regNo}
          WHERE id = ${user.id}
        `;

        console.log(`✅ Updated ${user.email} with registration_number: ${regNo}`);
        updateCount++;
      }
    }

    if (updateCount === 0) {
      console.log('\n✓ All users already have unique registration numbers');
    } else {
      console.log(`\n✅ Updated ${updateCount} users with unique registration numbers`);
    }

    // Verify final state
    const updatedUsers = await sql`SELECT email, registration_number FROM users ORDER BY role`;
    console.log('\n📋 Final state:');
    updatedUsers.forEach((user) => {
      console.log(`  - ${user.email}: ${user.registration_number}`);
    });

    console.log('\n✨ Fix complete!');

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fix failed!');
    console.error('Error details:', error);
    await sql.end();
    process.exit(1);
  }
}

fixRegistrationConstraint();
