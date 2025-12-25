import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, s3Config, shouldUseS3 } from '../config/s3';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

/**
 * Get file path from multer request
 * Returns S3 key for S3 uploads, local path for local uploads
 */
export function getUploadedFilePath(file: Express.Multer.File): string {
  if (shouldUseS3()) {
    // For S3, multer-s3 stores the key in file.key and location in file.location
    return (file as any).key || (file as any).location || file.path;
  }
  return file.path;
}

/**
 * Get full URL for accessing a file
 * Returns S3 URL for S3 files, local path for local files
 */
export function getFileUrl(filePath: string): string {
  if (isS3Path(filePath)) {
    // If it's already a full S3 URL, return it
    if (filePath.startsWith('http')) {
      return filePath;
    }
    // If it's just the key, construct the URL
    return `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${filePath}`;
  }
  return filePath;
}

/**
 * Check if a file path is an S3 path
 */
export function isS3Path(filePath: string): boolean {
  return (
    filePath.startsWith('http') || filePath.startsWith('books/') || filePath.startsWith('diagrams/')
  );
}

/**
 * Download file from S3 to local temp directory for processing
 * Returns local temp file path
 */
export async function downloadS3File(s3Key: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'temp-downloads');

  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Generate temp file path
  const fileName = path.basename(s3Key);
  const tempFilePath = path.join(tempDir, fileName);

  // Download from S3
  const command = new GetObjectCommand({
    Bucket: s3Config.bucket,
    Key: s3Key,
  });

  const response = await s3Client.send(command);

  // Convert stream to buffer and write to file
  if (response.Body) {
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);
    fs.writeFileSync(tempFilePath, buffer);
  }

  return tempFilePath;
}

/**
 * Get local file path for processing
 * Downloads from S3 if needed, returns local path otherwise
 */
export async function getLocalFilePath(filePath: string): Promise<string> {
  if (isS3Path(filePath)) {
    // Extract S3 key from URL if needed
    let s3Key = filePath;
    if (filePath.startsWith('http')) {
      const url = new URL(filePath);
      s3Key = url.pathname.substring(1); // Remove leading slash
    }
    return await downloadS3File(s3Key);
  }
  return filePath;
}

/**
 * Delete a file (from S3 or local filesystem)
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (isS3Path(filePath)) {
    // Delete from S3
    let s3Key = filePath;
    if (filePath.startsWith('http')) {
      const url = new URL(filePath);
      s3Key = url.pathname.substring(1);
    }

    const command = new DeleteObjectCommand({
      Bucket: s3Config.bucket,
      Key: s3Key,
    });

    await s3Client.send(command);
  } else {
    // Delete from local filesystem
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * Clean up temp downloaded files
 */
export function cleanupTempFile(filePath: string): void {
  const tempDir = path.join(process.cwd(), 'temp-downloads');
  if (filePath.startsWith(tempDir) && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
