import { S3Client } from '@aws-sdk/client-s3';

// Initialize S3 client with credentials from environment variables
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export const s3Config = {
  bucket: process.env.AWS_S3_BUCKET || 'testriser-uploads-prod',
  region: process.env.AWS_REGION || 'ap-south-1',
};

// Helper function to check if S3 should be used (production environment)
export const shouldUseS3 = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

// Helper function to get S3 file URL
export const getS3FileUrl = (key: string): string => {
  return `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${key}`;
};
