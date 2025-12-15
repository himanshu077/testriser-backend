/**
 * Backend Application Constants
 * Centralized configuration and constant values
 */

// Environment
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;

// JWT Configuration
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

export const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET as string,
  EXPIRES_IN: (process.env.JWT_EXPIRES_IN || '7d') as string | number,
};

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// NEET Exam Configuration
export const NEET_CONFIG = {
  TOTAL_QUESTIONS: 180,
  TOTAL_MARKS: 720,
  DURATION_MINUTES: 180, // 3 hours
  MARKS_POSITIVE: 4,
  MARKS_NEGATIVE: 1,
  SUBJECTS: {
    PHYSICS: 'physics',
    CHEMISTRY: 'chemistry',
    BIOLOGY: 'biology',
  },
  QUESTIONS_PER_SUBJECT: 45, // 45 questions per subject
} as const;

// Exam Status
export const EXAM_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

// Student Exam Status
export const STUDENT_EXAM_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  EVALUATED: 'evaluated',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  // Auth Errors
  UNAUTHORIZED: 'Unauthorized',
  NO_TOKEN: 'No token provided',
  INVALID_TOKEN: 'Invalid or expired token',
  FORBIDDEN: 'Forbidden',
  ACCESS_DENIED: 'Access denied',
  INVALID_CREDENTIALS: 'Invalid credentials',
  USER_EXISTS: 'User with this email already exists',
  USER_NOT_FOUND: 'User not found',

  // Validation Errors
  REQUIRED_FIELDS: 'Required fields are missing',
  INVALID_EMAIL: 'Invalid email address',
  PASSWORD_TOO_SHORT: 'Password must be at least 6 characters',

  // Server Errors
  INTERNAL_ERROR: 'Internal Server Error',
  DATABASE_ERROR: 'Database error',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  SIGN_IN_SUCCESS: 'Signed in successfully',
  SIGN_OUT_SUCCESS: 'Signed out successfully',
} as const;

// API Routes
export const API_ROUTES = {
  AUTH: '/api/auth',
  ADMIN: '/api/admin',
  STUDENT: '/api/student',
  EXAM: '/api/exam',
  PRACTICE: '/api/practice',
  CONTACT: '/api/contact',
  HEALTH: '/health',
  API_DOCS: '/api-docs',
} as const;

// Database Configuration
export const DB_CONFIG = {
  CONNECTION_STRING: process.env.DATABASE_URL,
  MAX_CONNECTIONS: 10,
  IDLE_TIMEOUT: 20,
  CONNECT_TIMEOUT: 10,
} as const;

// CORS Configuration
export const CORS_CONFIG = {
  ORIGIN: process.env.FRONTEND_URL || 'http://localhost:3000',
  CREDENTIALS: true,
} as const;

// Password Hashing
export const BCRYPT_CONFIG = {
  SALT_ROUNDS: 10,
} as const;

// Rate Limiting (for future use)
export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
} as const;

// Validation Rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 6,
  NAME_MIN_LENGTH: 2,
  EMAIL_MAX_LENGTH: 255,
  NAME_MAX_LENGTH: 255,
} as const;
