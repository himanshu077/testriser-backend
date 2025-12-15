import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

interface TableInfo {
  tableName: string;
  rowCount: number;
}

/**
 * Database Health Check Script
 * - Checks database connectivity
 * - Verifies tables exist
 * - Shows row counts
 * - Reports overall database status
 */
async function healthCheck() {
  console.log('🏥 Database Health Check');
  console.log('='.repeat(60));
  console.log('📍 Environment:', process.env.NODE_ENV || 'development');
  console.log(
    '🔗 Database URL:',
    process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@') || 'NOT SET'
  );
  console.log('');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in environment variables');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;

  // Determine SSL mode based on connection string
  const requireSSL =
    connectionString.includes('supabase.com') ||
    connectionString.includes('amazonaws.com') ||
    connectionString.includes('rds.amazonaws.com');

  const sql = postgres(connectionString, {
    ssl: requireSSL ? 'require' : 'prefer',
    max: 1,
    connect_timeout: 10,
  });

  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    await sql`SELECT 1 as test`;
    console.log('✅ Database connection successful');
    console.log('');

    // Get database info
    const dbInfo = await sql`
      SELECT
        current_database() as database,
        current_user as user,
        version() as version
    `;
    console.log('📊 Database Information:');
    console.log(`  Database: ${dbInfo[0].database}`);
    console.log(`  User: ${dbInfo[0].user}`);
    console.log(`  Version: ${dbInfo[0].version.split(',')[0]}`);
    console.log('');

    // Check if schema tables exist
    console.log('📋 Checking database state...');
    const existingTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const tableNames = existingTables.map((t) => t.table_name);

    // Database is completely empty
    if (tableNames.length === 0) {
      console.log('❌ Database is EMPTY (no tables found)');
      console.log('');
      console.log('💡 Next steps:');
      console.log('  1. Run migrations: npm run db:push');
      console.log('  2. Seed database: npm run seed');
      await sql.end();
      process.exit(1);
    }

    console.log(`✅ Found ${tableNames.length} tables`);
    console.log('');

    // Get row counts for each table
    console.log('📈 Table Row Counts:');
    const tableCounts: TableInfo[] = [];

    for (const table of tableNames) {
      try {
        const result = await sql.unsafe(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result[0].count);
        tableCounts.push({ tableName: table, rowCount: count });

        const icon = count > 0 ? '✓' : '○';
        console.log(`  ${icon} ${table.padEnd(25)} ${count.toString().padStart(6)} rows`);
      } catch (error) {
        console.log(`  ✗ ${table.padEnd(25)} (error reading)`);
      }
    }
    console.log('');

    // Determine database state
    const userCount = tableCounts.find((t) => t.tableName === 'users')?.rowCount || 0;

    console.log('');
    console.log('='.repeat(60));

    if (userCount === 0) {
      console.log('⚠️  DATABASE STATUS: Tables exist but NO DATA');
      console.log('');
      console.log('💡 Next step: Run seeding');
      console.log('   npm run seed');
    } else {
      console.log('✅ DATABASE STATUS: Ready and operational');
      console.log('');

      // Show user summary
      const users = await sql`
        SELECT email, role
        FROM users
        ORDER BY role, email
      `;
      console.log('👥 Active users:');
      users.forEach((user) => {
        const roleIcon = user.role === 'admin' ? '👑' : '👤';
        console.log(`  ${roleIcon} ${user.email} (${user.role})`);
      });
    }

    console.log('');
    console.log('Health check completed successfully');

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Health check failed');
    console.error('');

    if (error instanceof Error) {
      if (error.message.includes('CONNECT_TIMEOUT')) {
        console.error('⚠️  Connection timeout - possible causes:');
        console.error('  - Database host is unreachable');
        console.error('  - Firewall blocking port 5432');
        console.error('  - Security group not configured');
        console.error('  - VPC/network configuration issue');
      } else if (error.message.includes('authentication failed')) {
        console.error('⚠️  Authentication failed - check credentials:');
        console.error('  - Username');
        console.error('  - Password');
        console.error('  - Database name');
      } else if (error.message.includes('does not exist')) {
        console.error('⚠️  Database or table does not exist');
        console.error('  - Run migrations: npm run db:push');
      } else {
        console.error('Error:', error.message);
      }
    }

    await sql.end();
    process.exit(1);
  }
}

// Run health check
healthCheck();
