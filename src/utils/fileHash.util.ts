import crypto from 'crypto';
import fs from 'fs/promises';

/**
 * Calculate SHA-256 hash of a file for duplicate detection
 * @param filePath Absolute path to the file
 * @returns SHA-256 hash as hex string
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to calculate file hash: ${message}`);
  }
}

/**
 * Verify if a file matches a given hash
 * @param filePath Absolute path to the file
 * @param expectedHash Expected SHA-256 hash
 * @returns True if file matches the hash
 */
export async function verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
  try {
    const actualHash = await calculateFileHash(filePath);
    return actualHash === expectedHash;
  } catch {
    return false;
  }
}
