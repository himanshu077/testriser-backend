const fs = require('fs');
const path = require('path');

/**
 * Fix Swagger Documentation Paths
 *
 * This script corrects the API paths in auto-generated Swagger docs
 * to include the proper mounting prefixes from server.ts
 */

const ROUTES_DIR = path.join(__dirname, '../src/routes');

// Route file to mounting prefix mapping (from server.ts)
const ROUTE_PREFIXES = {
  'authRoutes.ts': '/api/auth',
  'adminRoutes.ts': '/api/admin',
  'booksRoutes.ts': '/api/admin/books',
  'studentsRoutes.ts': '/api/students',
  'studentRoutes.ts': '/api/student',
  'examRoutes.ts': '/api/exam',
  'practiceRoutes.ts': '/api/practice',
  'contactRoutes.ts': '/api/contact',
  'subjectsRoutes.ts': '/api/subjects',
  'chaptersRoutes.ts': '/api/chapters',
  'chapterTestsRoutes.ts': '/api/chapter-tests',
  'yearTestsRoutes.ts': '/api/year-tests',
  'aiChatRoutes.ts': '/api/ai-chat',
};

function fixSwaggerPaths() {
  let totalFixed = 0;
  let filesProcessed = 0;

  for (const [filename, prefix] of Object.entries(ROUTE_PREFIXES)) {
    const filePath = path.join(ROUTES_DIR, filename);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${filename} - file not found`);
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fixedCount = 0;

    // Find all Swagger path declarations that need fixing
    // Pattern: * /api/something: (but should be * /api/prefix/something:)
    // We need to match paths that don't already have the correct prefix

    const lines = content.split('\n');
    const fixedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this is a Swagger path declaration line
      // Format: " * /api/route:"
      const pathMatch = line.match(/^(\s+\*\s+)(\/api\/[^:]+):/);

      if (pathMatch) {
        const indent = pathMatch[1];
        const currentPath = pathMatch[2];

        // Check if the path already has the correct prefix
        if (!currentPath.startsWith(prefix + '/') && currentPath !== prefix) {
          // Extract the route part after /api/
          const routePart = currentPath.replace(/^\/api/, '');

          // Build the correct path
          const correctPath = prefix + routePart;

          // Replace the path
          const fixedLine = line.replace(currentPath, correctPath);
          fixedLines.push(fixedLine);
          fixedCount++;

          console.log(`  ${currentPath} → ${correctPath}`);
        } else {
          fixedLines.push(line);
        }
      } else {
        fixedLines.push(line);
      }
    }

    if (fixedCount > 0) {
      content = fixedLines.join('\n');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed ${fixedCount} paths in ${filename}`);
      totalFixed += fixedCount;
      filesProcessed++;
    } else {
      console.log(`✓  No fixes needed for ${filename}`);
    }
  }

  console.log(`\n✅ Complete! Fixed ${totalFixed} paths across ${filesProcessed} files.`);
}

// Also remove duplicate Swagger docs in authRoutes.ts
function removeDuplicateAuthDocs() {
  const authFilePath = path.join(ROUTES_DIR, 'authRoutes.ts');

  if (!fs.existsSync(authFilePath)) {
    console.log('⚠️  authRoutes.ts not found');
    return;
  }

  let content = fs.readFileSync(authFilePath, 'utf8');
  let removedCount = 0;

  // Remove duplicate auto-generated docs that have generic descriptions
  // These are the ones that say things like "Create sign-up" instead of detailed descriptions
  const lines = content.split('\n');
  const filteredLines = [];
  let skipUntilRouterLine = false;
  let inAutoGenDoc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of auto-generated doc (has generic tag like [Authentication])
    if (line.includes('* @swagger') && i + 1 < lines.length) {
      // Look ahead to see if this is an auto-generated doc
      let isAutoGen = false;
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        if (
          lines[j].includes('tags: [Authentication]') ||
          (lines[j].includes('tags: [Auth]') &&
            lines[j - 5] &&
            lines[j - 5].includes('tags: [Auth]'))
        ) {
          // Check if there's already a detailed doc above this one
          if (i > 10) {
            for (let k = Math.max(0, i - 50); k < i; k++) {
              if (
                lines[k].includes('* @swagger') &&
                lines[k + 3]?.includes(lines[i + 3]?.match(/\/api\/[^:]+/)?.[0])
              ) {
                isAutoGen = true;
                break;
              }
            }
          }
        }
      }

      if (isAutoGen) {
        inAutoGenDoc = true;
        skipUntilRouterLine = true;
        removedCount++;
        continue;
      }
    }

    // Skip lines until we hit the router line
    if (skipUntilRouterLine) {
      if (line.includes('router.')) {
        skipUntilRouterLine = false;
        inAutoGenDoc = false;
        filteredLines.push(line); // Keep the router line
      }
      continue;
    }

    filteredLines.push(line);
  }

  if (removedCount > 0) {
    content = filteredLines.join('\n');
    fs.writeFileSync(authFilePath, content, 'utf8');
    console.log(`\n✅ Removed ${removedCount} duplicate docs from authRoutes.ts`);
  }
}

console.log('🔧 Fixing Swagger documentation paths...\n');
fixSwaggerPaths();
console.log('\n🔧 Checking for duplicate documentation...\n');
removeDuplicateAuthDocs();
console.log('\n✨ All done!');
