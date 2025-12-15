import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Cleanup script to remove orphaned temporary directories
 * Run this manually with: npx tsx src/scripts/cleanup-temp-dirs.ts
 */

async function cleanupDirectory(dirPath: string): Promise<void> {
  try {
    // Check if directory exists
    await fs.access(dirPath);

    // Read directory contents
    const files = await fs.readdir(dirPath);

    // Delete all files in directory
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        // Recursively delete subdirectory
        await cleanupDirectory(filePath);
      } else {
        // Delete file
        await fs.unlink(filePath);
        console.log(`   ✅ Deleted file: ${filePath}`);
      }
    }

    // Remove the now-empty directory
    await fs.rmdir(dirPath);
    console.log(`   🧹 Removed directory: ${dirPath}`);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      const err = error as { code: string; message: string };
      console.error(`   ❌ Error cleaning ${dirPath}:`, err.message);
    }
  }
}

async function cleanupAllTempDirs() {
  console.log('🧹 Starting cleanup of temporary directories...\n');

  const dirsToClean = [
    // Vision extraction temp directories
    path.join(__dirname, '../../temp-vision'),

    // Diagram extraction temp directories
    path.join(__dirname, '../../uploads/diagram-images'),
  ];

  for (const baseDir of dirsToClean) {
    try {
      console.log(`📁 Checking: ${baseDir}`);

      // Check if base directory exists
      await fs.access(baseDir);

      // Read directory contents
      const items = await fs.readdir(baseDir);

      // Find temp directories (directories starting with 'temp-' or UUID pattern)
      const tempDirs = items.filter((item) => {
        // Match temp-* or UUID pattern (8-4-4-4-12 hex chars)
        return (
          item.startsWith('temp-') ||
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)
        );
      });

      if (tempDirs.length === 0) {
        console.log(`   ✅ No temp directories found\n`);
        continue;
      }

      console.log(`   📋 Found ${tempDirs.length} temp directories to clean:`);
      tempDirs.forEach((dir) => console.log(`      - ${dir}`));
      console.log('');

      // Clean up each temp directory
      for (const tempDir of tempDirs) {
        const fullPath = path.join(baseDir, tempDir);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await cleanupDirectory(fullPath);
        }
      }

      console.log(`   ✅ Cleaned ${tempDirs.length} directories\n`);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as { code: string; message: string };
        if (err.code === 'ENOENT') {
          console.log(`   ℹ️  Directory doesn't exist (skipping)\n`);
        } else {
          console.error(`   ❌ Error:`, err.message, '\n');
        }
      }
    }
  }

  console.log('✅ Cleanup complete!');
}

cleanupAllTempDirs().catch((error) => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});
