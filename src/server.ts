// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Now import everything else
import express, { Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import studentRoutes from './routes/studentRoutes';
import studentsRoutes from './routes/studentsRoutes';
import examRoutes from './routes/examRoutes';
import practiceRoutes from './routes/practiceRoutes';
import contactRoutes from './routes/contactRoutes';
import booksRoutes from './routes/booksRoutes';
import subjectsRoutes from './routes/subjectsRoutes';
import { BRANDING } from './config/branding';

// Version: 1.0.6 - Database health check and smart migrations
// Deployment: 2025-01-14 - RDS database setup with auto-verification

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - CORS Configuration
// Production setup: Backend is proxied through ALB/Nginx at /api path
// Set CORS_ORIGIN in .env for production (e.g., ALB URL or custom domain)
const allowedOrigins = [
  'http://localhost:3000', // Frontend local development
  'http://localhost:5000', // Backend itself (for Swagger UI)
];

// Add production origin from environment variable (REQUIRED for production)
// This should be set to your ALB URL or custom domain
if (process.env.CORS_ORIGIN) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
  console.log(`🌐 Production CORS origin added: ${process.env.CORS_ORIGIN}`);
} else if (process.env.NODE_ENV === 'production') {
  console.warn('⚠️  WARNING: CORS_ORIGIN not set in production! Set it to your ALB URL.');
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, curl, Swagger UI)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static('uploads'));
app.use('/temp-vision', express.static('temp-vision'));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Check if the API server is running
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *                   example: LeadGen AI Backend
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: BRANDING.SERVICE_NAME,
  });
});

// Swagger API Documentation
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: `${BRANDING.APP_NAME_FULL} - API Docs`,
  })
);

// Swagger JSON spec
app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/books', booksRoutes); // Books management (admin only) - MUST come before /api/admin
app.use('/api/admin', adminRoutes);
app.use('/api/students', studentsRoutes); // Students management (admin only)
app.use('/api/student', studentRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/subjects', subjectsRoutes); // Public subjects endpoint

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 JWT Authentication: Enabled`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`🌐 CORS Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log(`\n✅ Available Routes:`);
  console.log(`   POST /api/auth/sign-in      - Login (Active)`);
  console.log(`   GET  /api/auth/session      - Get current session (Active)`);
  console.log(`   POST /api/auth/sign-out     - Logout (Active)`);
  console.log(`   POST /api/auth/sign-up      - Register new student (Active)`);
  console.log(`   GET  /api/admin/*           - Admin routes (requires admin role)`);
  console.log(`   POST /api/admin/books/upload - Upload PDF book for question extraction`);
  console.log(`   GET  /api/admin/books       - List all books with status`);
  console.log(`   POST /api/admin/questions/upload-pdf - Upload PDF to extract questions directly`);
  console.log(`   GET  /api/student/*         - Student routes (requires student role)`);
  console.log(`   GET  /api/exam/*            - Exam routes (papers, mock tests)`);
  console.log(`   GET  /api/practice/*        - Practice routes (questionwise)`);
  console.log(`   POST /api/contact           - Contact form submission`);
});

export default app;
