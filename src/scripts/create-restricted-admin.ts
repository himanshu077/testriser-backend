import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { users } from '../models/schema';
import { eq } from 'drizzle-orm';
import { BCRYPT_CONFIG } from '../config/constants';

async function createRestrictedAdmin() {
  try {
    const email = 'admin@admin.com';
    const password = '123456';
    const name = 'Restricted Admin';

    console.log('Creating restricted admin user...');

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existingUser.length > 0) {
      console.log('User already exists with this email. Updating password...');
      const hashedPassword = await bcrypt.hash(password, BCRYPT_CONFIG.SALT_ROUNDS);
      await db
        .update(users)
        .set({ password: hashedPassword, role: 'admin' })
        .where(eq(users.email, email));
      console.log('User password updated successfully!');
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, BCRYPT_CONFIG.SALT_ROUNDS);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          name,
          role: 'admin',
          emailVerified: true,
        })
        .returning();

      console.log('Restricted admin user created successfully!');
      console.log('User ID:', newUser.id);
    }

    console.log('\nLogin credentials:');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log(
      '\nThis admin has restricted access - can only view questions (Add Question button hidden)'
    );

    process.exit(0);
  } catch (error) {
    console.error('Error creating restricted admin:', error);
    process.exit(1);
  }
}

createRestrictedAdmin();
