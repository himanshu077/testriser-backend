import * as dotenv from 'dotenv';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

// Bcrypt configuration (same as auth controller)
const BCRYPT_SALT_ROUNDS = 10;

// Helper function to create slug from name
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
}

// Curriculum data structure
interface ChapterData {
  subject: string;
  grade: '11' | '12';
  chapters: Array<{
    number: number;
    name: string;
    weightage?: number;
    estimatedHours?: number;
  }>;
}

const curriculumData: ChapterData[] = [
  // ============================================================================
  // PHYSICS - 29 chapters
  // ============================================================================
  {
    subject: 'physics',
    grade: '11',
    chapters: [
      { number: 1, name: 'Units and Measurement', weightage: 2, estimatedHours: 8 },
      { number: 2, name: 'Motion in a Straight Line', weightage: 2, estimatedHours: 10 },
      { number: 3, name: 'Motion in a Plane', weightage: 2, estimatedHours: 10 },
      { number: 4, name: 'Laws of Motion', weightage: 3, estimatedHours: 12 },
      { number: 5, name: 'Work, Energy and Power', weightage: 3, estimatedHours: 12 },
      {
        number: 6,
        name: 'System of Particles and Rotational Motion',
        weightage: 3,
        estimatedHours: 14,
      },
      { number: 7, name: 'Gravitation', weightage: 2, estimatedHours: 10 },
      { number: 8, name: 'Mechanical Properties of Solids', weightage: 2, estimatedHours: 8 },
      { number: 9, name: 'Mechanical Properties of Fluids', weightage: 2, estimatedHours: 10 },
      { number: 10, name: 'Thermal Properties of Matter', weightage: 2, estimatedHours: 10 },
      { number: 11, name: 'Thermodynamics', weightage: 3, estimatedHours: 12 },
      { number: 12, name: 'Kinetic Theory', weightage: 2, estimatedHours: 8 },
      { number: 13, name: 'Oscillations', weightage: 2, estimatedHours: 10 },
      { number: 14, name: 'Waves', weightage: 3, estimatedHours: 12 },
    ],
  },
  {
    subject: 'physics',
    grade: '12',
    chapters: [
      { number: 1, name: 'Electric Charges and Fields', weightage: 3, estimatedHours: 12 },
      {
        number: 2,
        name: 'Electrostatic Potential and Capacitance',
        weightage: 3,
        estimatedHours: 12,
      },
      { number: 3, name: 'Current Electricity', weightage: 4, estimatedHours: 14 },
      { number: 4, name: 'Moving Charges and Magnetism', weightage: 3, estimatedHours: 12 },
      { number: 5, name: 'Magnetism and Matter', weightage: 2, estimatedHours: 8 },
      { number: 6, name: 'Electromagnetic Induction', weightage: 3, estimatedHours: 12 },
      { number: 7, name: 'Alternating Current', weightage: 2, estimatedHours: 10 },
      { number: 8, name: 'Electromagnetic Waves', weightage: 2, estimatedHours: 8 },
      { number: 9, name: 'Ray Optics', weightage: 3, estimatedHours: 12 },
      { number: 10, name: 'Wave Optics', weightage: 3, estimatedHours: 10 },
      { number: 11, name: 'Dual Nature of Matter & Radiation', weightage: 2, estimatedHours: 10 },
      { number: 12, name: 'Atoms', weightage: 2, estimatedHours: 8 },
      { number: 13, name: 'Nuclei', weightage: 3, estimatedHours: 10 },
      {
        number: 14,
        name: 'Semiconductor Electronics-Materials, Devices & Simple Circuits',
        weightage: 3,
        estimatedHours: 12,
      },
      { number: 15, name: 'Experimental Skills', weightage: 1, estimatedHours: 6 },
    ],
  },

  // ============================================================================
  // CHEMISTRY - 21 chapters
  // ============================================================================
  {
    subject: 'chemistry',
    grade: '11',
    chapters: [
      { number: 1, name: 'Some Basic Concepts of Chemistry', weightage: 2, estimatedHours: 8 },
      { number: 2, name: 'Structure of Atom', weightage: 3, estimatedHours: 12 },
      {
        number: 3,
        name: 'Classification of Elements & Periodicity in Properties',
        weightage: 2,
        estimatedHours: 10,
      },
      {
        number: 4,
        name: 'Chemical Bonding and Molecular Structure',
        weightage: 3,
        estimatedHours: 14,
      },
      { number: 5, name: 'Thermodynamics', weightage: 2, estimatedHours: 10 },
      { number: 6, name: 'Equilibrium', weightage: 3, estimatedHours: 12 },
      { number: 7, name: 'Redox Reactions', weightage: 2, estimatedHours: 8 },
      {
        number: 8,
        name: 'Organic Chemistry – Some Basic Principles & Techniques',
        weightage: 3,
        estimatedHours: 12,
      },
      { number: 9, name: 'Hydrocarbons', weightage: 3, estimatedHours: 12 },
    ],
  },
  {
    subject: 'chemistry',
    grade: '12',
    chapters: [
      { number: 1, name: 'Solutions', weightage: 2, estimatedHours: 10 },
      { number: 2, name: 'Electrochemistry', weightage: 3, estimatedHours: 12 },
      { number: 3, name: 'Chemical Kinetics', weightage: 2, estimatedHours: 10 },
      { number: 4, name: 'The d– and f–Block Elements', weightage: 3, estimatedHours: 12 },
      { number: 5, name: 'Coordination Compounds', weightage: 3, estimatedHours: 12 },
      { number: 6, name: 'Haloalkanes and Haloarenes', weightage: 2, estimatedHours: 10 },
      { number: 7, name: 'Alcohols, Phenols & Ethers', weightage: 3, estimatedHours: 12 },
      {
        number: 8,
        name: 'Aldehydes, Ketones & Carboxylic Acids',
        weightage: 3,
        estimatedHours: 14,
      },
      { number: 9, name: 'Amines', weightage: 2, estimatedHours: 10 },
      { number: 10, name: 'Biomolecules', weightage: 3, estimatedHours: 12 },
      {
        number: 11,
        name: 'The p-Block Elements',
        weightage: 3,
        estimatedHours: 12,
      },
      {
        number: 12,
        name: 'Principles Related to Practical Chemistry',
        weightage: 1,
        estimatedHours: 6,
      },
    ],
  },

  // ============================================================================
  // BOTANY - 17 chapters
  // ============================================================================
  {
    subject: 'botany',
    grade: '11',
    chapters: [
      { number: 1, name: 'The Living World', weightage: 1, estimatedHours: 6 },
      { number: 2, name: 'Biological Classification', weightage: 2, estimatedHours: 8 },
      { number: 3, name: 'Plant Kingdom', weightage: 3, estimatedHours: 12 },
      { number: 4, name: 'Morphology of Flowering Plants', weightage: 2, estimatedHours: 10 },
      { number: 5, name: 'Anatomy of Flowering Plants', weightage: 2, estimatedHours: 10 },
      { number: 6, name: 'Cell – The Unit of Life', weightage: 3, estimatedHours: 12 },
      { number: 7, name: 'Cell Cycle & Cell Division', weightage: 2, estimatedHours: 10 },
      { number: 8, name: 'Photosynthesis in Higher Plants', weightage: 3, estimatedHours: 12 },
      { number: 9, name: 'Respiration in Plants', weightage: 2, estimatedHours: 10 },
      { number: 10, name: 'Plant Growth and Development', weightage: 2, estimatedHours: 10 },
    ],
  },
  {
    subject: 'botany',
    grade: '12',
    chapters: [
      {
        number: 1,
        name: 'Sexual Reproduction in Flowering Plants',
        weightage: 3,
        estimatedHours: 12,
      },
      {
        number: 2,
        name: 'Principles of Inheritance and Variation',
        weightage: 4,
        estimatedHours: 14,
      },
      { number: 3, name: 'Molecular Basis of Inheritance', weightage: 4, estimatedHours: 14 },
      { number: 4, name: 'Microbes in Human Welfare', weightage: 2, estimatedHours: 8 },
      { number: 5, name: 'Organisms and Populations', weightage: 3, estimatedHours: 12 },
      { number: 6, name: 'Ecosystem', weightage: 3, estimatedHours: 12 },
      { number: 7, name: 'Biodiversity and Conservation', weightage: 2, estimatedHours: 10 },
    ],
  },

  // ============================================================================
  // ZOOLOGY - 15 chapters
  // ============================================================================
  {
    subject: 'zoology',
    grade: '11',
    chapters: [
      { number: 1, name: 'Animal Kingdom', weightage: 3, estimatedHours: 12 },
      { number: 2, name: 'Biomolecules', weightage: 3, estimatedHours: 12 },
      { number: 3, name: 'Structural Organisation in Animals', weightage: 2, estimatedHours: 8 },
      { number: 4, name: 'Breathing and Exchange of Gases', weightage: 2, estimatedHours: 10 },
      { number: 5, name: 'Body Fluids and Circulation', weightage: 3, estimatedHours: 12 },
      {
        number: 6,
        name: 'Excretory Products and Their Elimination',
        weightage: 2,
        estimatedHours: 10,
      },
      { number: 7, name: 'Locomotion and Movement', weightage: 2, estimatedHours: 8 },
      { number: 8, name: 'Neural Control and Coordination', weightage: 3, estimatedHours: 14 },
      {
        number: 9,
        name: 'Chemical Coordination and Integration',
        weightage: 3,
        estimatedHours: 12,
      },
    ],
  },
  {
    subject: 'zoology',
    grade: '12',
    chapters: [
      { number: 1, name: 'Human Reproduction', weightage: 3, estimatedHours: 12 },
      { number: 2, name: 'Reproductive Health', weightage: 2, estimatedHours: 8 },
      { number: 3, name: 'Evolution', weightage: 3, estimatedHours: 12 },
      { number: 4, name: 'Human Health and Diseases', weightage: 3, estimatedHours: 12 },
      {
        number: 5,
        name: 'Biotechnology – Principles and Processes',
        weightage: 3,
        estimatedHours: 12,
      },
      { number: 6, name: 'Biotechnology – Applications', weightage: 3, estimatedHours: 12 },
    ],
  },
];

/**
 * Direct SQL Seed Script for TestRiser
 * Uses direct SQL queries instead of Drizzle ORM
 * Idempotent - safe to run multiple times
 */
async function seed() {
  console.log('🌱 Starting database seeding...');
  console.log('📍 Environment:', process.env.NODE_ENV || 'development');
  console.log(
    '🔗 Database URL:',
    process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@') || 'NOT SET'
  );

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: process.env.NODE_ENV === 'production' ? 'require' : 'prefer',
    max: 1,
  });

  try {
    console.log('\n✓ Connected to database successfully');

    // Check if database is already seeded
    const existingUsers = await sql`SELECT COUNT(*) as count FROM users`;
    const userCount = parseInt(existingUsers[0].count);

    if (userCount > 0) {
      console.log(`ℹ️  Database already seeded (${userCount} users found)`);
      console.log('   Skipping seed to prevent duplicates');
      console.log('   Use FORCE_SEED=true to force re-seeding');

      // Show existing users
      const allUsers = await sql`SELECT email, role FROM users ORDER BY role`;
      console.log('\n📊 Current users in database:');
      allUsers.forEach((user) => {
        console.log(`  - ${user.email} (${user.role})`);
      });

      // Only proceed if FORCE_SEED is set
      if (process.env.FORCE_SEED !== 'true') {
        await sql.end();
        process.exit(0);
      } else {
        console.log('\n⚠️  FORCE_SEED enabled - proceeding with seed...');
      }
    }

    console.log('🔐 Hashing passwords with bcrypt (salt rounds: ' + BCRYPT_SALT_ROUNDS + ')...');

    const hashedAdminPassword = await bcrypt.hash('admin123', BCRYPT_SALT_ROUNDS);
    const hashedStudentPassword = await bcrypt.hash('student123', BCRYPT_SALT_ROUNDS);

    // Create admin user (with dummy registration number for unique constraint)
    const adminResult = await sql`
      INSERT INTO users (email, password, name, role, email_verified, registration_number, created_at, updated_at)
      VALUES (
        'admin@testriser.com',
        ${hashedAdminPassword},
        'Admin User',
        'admin',
        true,
        'ADMIN001',
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING email
    `;

    if (adminResult && adminResult[0]?.email) {
      console.log('✅ Admin user created:', adminResult[0].email);
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create demo student user
    const studentResult = await sql`
      INSERT INTO users (email, password, name, role, email_verified, registration_number, created_at, updated_at)
      VALUES (
        'student@testriser.com',
        ${hashedStudentPassword},
        'Demo Student',
        'student',
        true,
        'NEET2024001',
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING email
    `;

    if (studentResult && studentResult[0]?.email) {
      console.log('✅ Student user created:', studentResult[0].email);
    } else {
      console.log('ℹ️  Student user already exists');
    }

    // Verify users were created by querying
    const allUsers = await sql`SELECT email, role FROM users ORDER BY role`;
    console.log('\n📊 Current users in database:');
    allUsers.forEach((user) => {
      console.log(`  - ${user.email} (${user.role})`);
    });

    console.log('\n📋 Demo Credentials (Use these to login):');
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│ Admin:   admin@testriser.com / admin123         │');
    console.log('│ Student: student@testriser.com / student123     │');
    console.log('└─────────────────────────────────────────────────┘');

    // ============================================================================
    // SEED SUBJECTS
    // ============================================================================
    console.log('\n📚 Seeding subjects...');

    const subjectsData = [
      { name: 'Physics', code: 'PHYSICS', description: 'NEET Physics Syllabus', icon: '⚛️' },
      { name: 'Chemistry', code: 'CHEMISTRY', description: 'NEET Chemistry Syllabus', icon: '🧪' },
      { name: 'Botany', code: 'BOTANY', description: 'NEET Biology (Botany) Syllabus', icon: '🌱' },
      {
        name: 'Zoology',
        code: 'ZOOLOGY',
        description: 'NEET Biology (Zoology) Syllabus',
        icon: '🔬',
      },
    ];

    const subjectIdMap = new Map<string, string>();

    for (const subject of subjectsData) {
      const existing = await sql`
        SELECT id, code FROM subjects WHERE code = ${subject.code}
      `;

      if (existing && existing[0]) {
        console.log(`  ℹ️  Subject already exists: ${subject.name}`);
        subjectIdMap.set(subject.code.toLowerCase(), existing[0].id);
      } else {
        const result = await sql`
          INSERT INTO subjects (name, code, description, icon, is_active, created_at, updated_at)
          VALUES (
            ${subject.name},
            ${subject.code},
            ${subject.description},
            ${subject.icon},
            true,
            NOW(),
            NOW()
          )
          RETURNING id, code
        `;
        console.log(`  ✅ Subject created: ${subject.name}`);
        subjectIdMap.set(subject.code.toLowerCase(), result[0].id);
      }
    }

    console.log(`✅ Subjects seeded successfully (${subjectIdMap.size} subjects)\n`);

    // ============================================================================
    // SEED CURRICULUM CHAPTERS
    // ============================================================================
    console.log('📖 Seeding curriculum chapters...');

    // Check if chapters already exist
    const existingChapters = await sql`SELECT COUNT(*) as count FROM curriculum_chapters`;
    const chapterCount = parseInt(existingChapters[0].count);

    if (chapterCount > 0) {
      console.log(`  ℹ️  Chapters already seeded (${chapterCount} chapters found)`);
      console.log('  Skipping chapter seeding to prevent duplicates');
    } else {
      let totalChaptersInserted = 0;
      let displayOrder = 0;

      for (const curriculumItem of curriculumData) {
        const subjectId = subjectIdMap.get(curriculumItem.subject);

        if (!subjectId) {
          console.error(`  ❌ Subject not found: ${curriculumItem.subject}`);
          continue;
        }

        console.log(
          `\n  📚 Seeding ${curriculumItem.subject.toUpperCase()} - Grade ${curriculumItem.grade}...`
        );

        for (const chapter of curriculumItem.chapters) {
          const slug = createSlug(chapter.name);

          await sql`
            INSERT INTO curriculum_chapters (
              subject_id,
              chapter_number,
              name,
              slug,
              grade_level,
              status,
              is_active,
              is_published,
              syllabus_year,
              estimated_hours,
              weightage,
              display_order,
              total_questions,
              pyq_count,
              easy_count,
              medium_count,
              hard_count,
              created_at,
              updated_at
            )
            VALUES (
              ${subjectId},
              ${chapter.number},
              ${chapter.name},
              ${slug},
              ${curriculumItem.grade},
              'active',
              true,
              true,
              2024,
              ${chapter.estimatedHours || 10},
              ${chapter.weightage || 2},
              ${displayOrder++},
              0,
              0,
              0,
              0,
              0,
              NOW(),
              NOW()
            )
            ON CONFLICT (subject_id, grade_level, chapter_number) DO NOTHING
          `;

          totalChaptersInserted++;
          console.log(`    ✓ Ch ${chapter.number}: ${chapter.name}`);
        }
      }

      console.log(
        `\n  ✅ Curriculum chapters seeded successfully (${totalChaptersInserted} chapters)`
      );

      // Verification by subject
      console.log('\n  📈 Verification by subject:');
      for (const [code, subjectId] of subjectIdMap) {
        const count = await sql`
          SELECT COUNT(*) as count
          FROM curriculum_chapters
          WHERE subject_id = ${subjectId}
        `;
        console.log(`    ${code.padEnd(10)}: ${count[0].count} chapters`);
      }
    }

    console.log('\n✨ Seeding complete!');

    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed!');
    console.error('Error details:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    await sql.end();
    process.exit(1);
  }
}

seed();
