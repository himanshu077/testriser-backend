import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import fs from 'fs';
import { s3Client, s3Config, shouldUseS3 } from '../config/s3';

// Ensure uploads directories exist (for local development)
const uploadsDir = path.join(process.cwd(), 'uploads', 'books');
const diagramsDir = path.join(process.cwd(), 'uploads', 'diagram-images');

if (!shouldUseS3()) {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(diagramsDir)) {
    fs.mkdirSync(diagramsDir, { recursive: true });
  }
}

// Configure multer storage (S3 for production, local for development)
const storage = shouldUseS3()
  ? multerS3({
      s3: s3Client,
      bucket: s3Config.bucket,
      acl: 'public-read', // Make uploaded files publicly accessible
      metadata: (req: any, file: any, cb: any) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req: any, file: any, cb: any) => {
        // Generate unique filename: books/originalname-timestamp.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        cb(null, `books/${nameWithoutExt}-${uniqueSuffix}${ext}`);
      },
    })
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadsDir);
      },
      filename: (req, file, cb) => {
        // Generate unique filename: timestamp-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
      },
    });

// File filter to only allow PDF files
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'));
  }
};

// Configure multer upload for PDFs
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// Upload middleware for single PDF file
export const uploadPDFBook = upload.single('pdfFile');

// Configure multer storage for diagram images
// Use memory storage - we'll upload to S3 in the controller with question ID in path
const diagramStorage = multer.memoryStorage();

// File filter for images
const imageFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
  }
};

// Configure multer upload for diagrams
export const diagramUpload = multer({
  storage: diagramStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size for images
  },
});

// Upload middleware for single diagram image
export const uploadDiagramImage = diagramUpload.single('diagramImage');
