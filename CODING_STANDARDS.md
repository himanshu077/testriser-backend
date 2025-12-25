# Test Riser - Coding Standards & Best Practices

**Last Updated**: 2025-12-25
**Purpose**: Authoritative reference for development standards based on actual codebase analysis

> **IMPORTANT**: All standards in this document are based on ACTUAL code from the repository, with source citations. This is the single source of truth for development practices.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Type Safety](#type-safety)
3. [Authentication & Security](#authentication--security)
4. [API Development (REST)](#api-development-rest)
5. [Database Patterns](#database-patterns)
6. [File Organization](#file-organization)
7. [UI Components](#ui-components)
8. [Code Quality Rules](#code-quality-rules)
9. [State Management](#state-management)
10. [Performance Optimization](#performance-optimization)

---

## Technology Stack

All versions verified from `backend/package.json` and `frontend/package.json`.

### Backend Stack

| Technology | Version | Purpose | Source |
|------------|---------|---------|--------|
| **Express.js** | 4.21.1 | Web framework | `backend/package.json:31` |
| **TypeScript** | 5.6.3 | Type safety | `backend/package.json:53` |
| **PostgreSQL** | - | Primary database | Production |
| **postgres.js** | 3.4.5 | Database driver | `backend/package.json:44` |
| **Drizzle ORM** | 0.36.4 | Database ORM | `backend/package.json:29` |
| **Drizzle Kit** | 0.29.1 | Database migrations | `backend/package.json:30` |

**Architecture**: RESTful API with Express.js + TypeScript
**Source**: `backend/src/server.ts:1-150`

### Authentication & Security

| Technology | Version | Purpose | Source |
|------------|---------|---------|--------|
| **jsonwebtoken** | 9.0.2 | JWT authentication | `backend/package.json:37` |
| **Firebase Admin** | 13.6.0 | Firebase auth server-side | `backend/package.json:33` |
| **Firebase** (Frontend) | 12.7.0 | Firebase auth client | `frontend/package.json:31` |
| **bcryptjs** | 2.4.3 | Password hashing | `backend/package.json:23` |
| **CORS** | 2.8.5 | Cross-origin security | `backend/package.json:27` |

**CRITICAL**: Dual authentication system - JWT for admin, Firebase for students.
**Source**: `backend/src/middleware/authMiddleware.ts:1-150`

### AI Integration

| Technology | Version | Purpose | Source |
|------------|---------|---------|--------|
| **@anthropic-ai/sdk** | 0.71.1 | Claude AI | `backend/package.json:19` |
| **@google/generative-ai** | 0.24.1 | Gemini AI | `backend/package.json:20` |
| **openai** | 6.10.0 | OpenAI GPT | `backend/package.json:42` |

### File Processing

| Technology | Version | Purpose | Source |
|------------|---------|---------|--------|
| **multer** | 2.0.2 | File upload middleware | `backend/package.json:41` |
| **multer-s3** | Latest | S3 storage engine for multer | `backend/package.json` |
| **@aws-sdk/client-s3** | 3.958.0 | AWS S3 SDK for file storage | `backend/package.json:48` |
| **pdf-parse** | 1.1.1 | PDF text extraction | `backend/package.json:43` |
| **pdf2pic** | 3.1.3 | PDF to image conversion | `backend/package.json:78` |
| **sharp** | 0.34.5 | Image processing | `backend/package.json:48` |

### Frontend Stack

| Technology | Version | Purpose | Source |
|------------|---------|---------|--------|
| **Next.js** | 16.0.8 | React framework (App Router) | `frontend/package.json:42` |
| **React** | 19.2.1 | UI library | `frontend/package.json:48` |
| **TypeScript** | 5.6.3 | Type safety | `frontend/package.json:59` |
| **Tailwind CSS** | 3.4.15 | Utility-first CSS | `frontend/package.json:56` |
| **Redux Toolkit** | 2.2.8 | Global state management | `frontend/package.json:50` |
| **TanStack React Query** | 5.59.20 | Server state management | `frontend/package.json:17` |
| **Radix UI** | ~2.1.x | Accessible UI primitives | `frontend/package.json:18-35` |
| **Zod** | 3.23.8 | Schema validation | `frontend/package.json:60` |

### Utilities & Libraries

| Technology | Version | Purpose | Source |
|------------|---------|---------|--------|
| **date-fns** | 4.1.0 | Date manipulation | `frontend/package.json:28` |
| **Framer Motion** | 12.23.25 | Animation library | `frontend/package.json:32` |
| **Lucide React** | 0.460.0 | Icon library | `frontend/package.json:37` |
| **React Hook Form** | 7.53.2 | Form management | `frontend/package.json:49` |
| **Sonner** | 2.0.7 | Toast notifications | `frontend/package.json:52` |
| **ioredis** | 5.8.2 | Redis caching (backend) | `backend/package.json:36` |
| **nodemailer** | 7.0.10 | Email service | `backend/package.json:82` |

---

## Type Safety

### Rule 1: Strict TypeScript Mode

**CRITICAL**: TypeScript strict mode is ENABLED in both frontend and backend.

**Backend Configuration**:
**Source**: `backend/tsconfig.json:8`

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

**Frontend Configuration**:
**Source**: `frontend/tsconfig.json:10`

```json
{
  "compilerOptions": {
    "strict": true,
    "lib": ["dom", "dom.iterable", "esnext"],
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Implications**:
- No implicit `any`
- Strict null checks
- Strict function types
- Strict property initialization

### Rule 2: Database Type Inference from Drizzle

**Pattern**: Use Drizzle's built-in type inference for all database operations.

**Schema Definition**:
**Source**: `backend/src/models/schema.ts:1-678`

```typescript
import { pgTable, uuid, varchar, timestamp, text, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';

// Define enum first
export const userRoleEnum = pgEnum('user_role', ['admin', 'student']);

// Define table with schema
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: userRoleEnum('role').default('student').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Export inferred types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

**Usage in Controllers**:
**Source**: `backend/src/controllers/authController.ts`

```typescript
import { User, NewUser } from '../models/schema';

export async function signUp(req: Request, res: Response) {
  const newUser: NewUser = {
    name: req.body.name,
    email: req.body.email,
    passwordHash: await hashPassword(req.body.password),
    role: 'student',
  };

  const [user] = await db.insert(users).values(newUser).returning();
  // user is typed as User automatically
}
```

### Rule 3: Request Type Extensions

**Pattern**: Extend Express Request type for authenticated requests.

**Type Definition**:
**Source**: `backend/src/middleware/authMiddleware.ts:1-20`

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: 'admin' | 'student';
        authType: 'jwt' | 'firebase';
      };
    }
  }
}
```

**Usage**:
```typescript
export async function getProfile(req: Request, res: Response) {
  // req.user is now typed and available
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
```

### Rule 4: Zod Validation Schemas (Frontend)

**Pattern**: Define Zod schemas for form validation and type inference.

**Example Implementation**:
```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginForm = z.infer<typeof loginSchema>;
```

**Best Practice**: Keep validation schemas close to components that use them.

### Rule 5: Avoid `any` Type

**CRITICAL**: Do not use `any` type. Use proper types or `unknown` with type guards.

❌ **WRONG**:
```typescript
function processData(data: any) {
  return data.value;
}
```

✅ **CORRECT**:
```typescript
interface DataInput {
  value: string;
}

function processData(data: DataInput) {
  return data.value;
}
```

---

## Authentication & Security

### Rule 6: Dual Authentication System

**CRITICAL**: The project uses TWO authentication systems - understand when to use each.

**Authentication Flow**:
**Source**: `backend/src/middleware/authMiddleware.ts:20-100`

```typescript
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Firebase tokens are longer (>500 chars)
    if (token.length > 500) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);

        req.user = {
          id: decodedToken.uid,
          email: decodedToken.email || '',
          name: decodedToken.name || '',
          role: 'student',
          authType: 'firebase',
        };

        return next();
      } catch (firebaseError) {
        return res.status(401).json({ error: 'Invalid Firebase token' });
      }
    }

    // JWT authentication (admin users)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      const [user] = await db.select().from(users).where(eq(users.id, decoded.id));

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        authType: 'jwt',
      };

      next();
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid JWT token' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
```

**When to Use Each**:

| Auth Type | Use Case | User Type | Token Length | Source |
|-----------|----------|-----------|--------------|--------|
| **JWT** | Admin dashboard, backend operations | Admin | <500 chars | `backend/src/utils/jwt.util.ts` |
| **Firebase** | Student app, social login | Student | >500 chars | `backend/config/firebase-admin.ts` |

### Rule 7: Role-Based Access Control

**Pattern**: Use role middleware to protect admin routes.

**Middleware Implementation**:
```typescript
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

export function requireStudent(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ error: 'Forbidden: Student access required' });
  }
  next();
}
```

**Route Protection**:
**Source**: `backend/src/routes/adminRoutes.ts`

```typescript
import { authenticate, requireAdmin } from '../middleware/authMiddleware';

router.post('/books/upload', authenticate, requireAdmin, uploadBook);
router.get('/questions', authenticate, requireAdmin, getAllQuestions);
router.put('/curriculum-chapters/:id', authenticate, requireAdmin, updateChapter);
```

### Rule 8: Password Security

**CRITICAL**: Always hash passwords with bcrypt.

**Hash Generation**:
**Source**: `backend/src/utils/password.util.ts`

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
```

**Usage in Sign Up**:
```typescript
export async function signUp(req: Request, res: Response) {
  const passwordHash = await hashPassword(req.body.password);

  const [user] = await db.insert(users).values({
    email: req.body.email,
    passwordHash, // Store hash, never plain text
    role: 'student',
  }).returning();
}
```

❌ **NEVER DO THIS**:
```typescript
// WRONG - Storing plain text password
await db.insert(users).values({ password: req.body.password });
```

### Rule 9: JWT Token Configuration

**Pattern**: Use consistent JWT signing and verification.

**Source**: `backend/src/utils/jwt.util.ts`

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = '7d';

export interface JWTPayload {
  id: string;
  email: string;
  role: 'admin' | 'student';
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}
```

**Requirements**:
1. ✅ Always set expiration (default: 7 days)
2. ✅ Use environment variable for secret
3. ✅ Include minimal user data in payload
4. ✅ Verify token on every protected route

### Rule 10: Frontend Auth Provider

**Pattern**: Centralized authentication state management.

**Source**: `frontend/src/components/providers/AuthProvider.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        // Store token for API calls
        localStorage.setItem('authToken', token);
      } else {
        localStorage.removeItem('authToken');
      }
      setIsInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  if (!isInitialized) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}
```

**Usage in Root Layout**:
```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Rule 11: Protected Routes (Frontend)

**Pattern**: Use route protection components for authenticated pages.

**Source**: `frontend/src/components/auth/ProtectedRoute.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return <>{children}</>;
}
```

**Usage**:
```typescript
// app/student/page.tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function StudentDashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
```

---

## API Development (REST)

### Rule 12: RESTful Route Structure

**Pattern**: Organize routes by feature/resource with clear HTTP methods.

**Source**: `backend/src/server.ts:80-120`

```typescript
import express from 'express';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import studentRoutes from './routes/studentRoutes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);

// Protected routes
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/chapters', chaptersRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/ai-chat', aiChatRoutes);

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

### Rule 13: Controller Pattern

**CRITICAL**: All route handlers must follow the standard controller pattern.

**Standard Controller Structure**:
**Source**: `backend/src/controllers/practiceController.ts:1-80`

```typescript
import { Request, Response } from 'express';
import { db } from '../config/database';
import { eq, and, desc } from 'drizzle-orm';
import { questions } from '../models/schema';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants';

/**
 * Get practice questions for a user
 * @route GET /api/practice/questions
 */
export async function getPracticeQuestions(req: Request, res: Response) {
  try {
    // 1. Extract and validate input
    const { subject, topic, limit = '50' } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.UNAUTHORIZED,
      });
    }

    // 2. Build query
    let query = db.select().from(questions);

    if (subject) {
      query = query.where(eq(questions.subject, subject as string));
    }

    // 3. Execute query
    const results = await query.limit(parseInt(limit as string));

    // 4. Success response
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: results,
    });
  } catch (error) {
    // 5. Error handling
    console.error('Error fetching practice questions:', error);
    return res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: ERROR_MESSAGES.SERVER_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

**Requirements**:
1. ✅ JSDoc comment with route description
2. ✅ Try-catch error handling
3. ✅ Input validation
4. ✅ Authorization check (if protected)
5. ✅ Use constants for status codes
6. ✅ Consistent response format
7. ✅ Typed Request and Response
8. ✅ Error logging to console

### Rule 14: Consistent Response Format

**Pattern**: All API responses must follow standard formats.

**Success Response**:
```typescript
return res.status(200).json({
  success: true,
  data: results,
  meta: {
    total: count,
    page: pageNumber,
  },
});
```

**Error Response**:
```typescript
return res.status(400).json({
  error: 'Bad Request',
  message: 'Specific error description',
});
```

**Validation Error**:
```typescript
return res.status(422).json({
  error: 'Validation Error',
  details: [
    { field: 'email', message: 'Invalid email format' },
    { field: 'password', message: 'Password too short' },
  ],
});
```

### Rule 15: HTTP Status Code Constants

**CRITICAL**: Always use constants for HTTP status codes.

**Source**: `backend/src/config/constants.ts:1-30`

```typescript
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  SERVER_ERROR: 500,
} as const;

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Insufficient permissions',
  SERVER_ERROR: 'Internal server error',
  VALIDATION_ERROR: 'Validation failed',
  NOT_FOUND: 'Resource not found',
  QUESTION_NOT_FOUND: 'Question not found',
  USER_EXISTS: 'User already exists',
} as const;
```

❌ **WRONG**:
```typescript
return res.status(401).json({ error: 'Unauthorized' });
```

✅ **CORRECT**:
```typescript
return res.status(HTTP_STATUS.UNAUTHORIZED).json({
  error: ERROR_MESSAGES.UNAUTHORIZED,
});
```

### Rule 16: API Documentation with Swagger

**Pattern**: Document all API endpoints with JSDoc for Swagger.

**Source**: `backend/src/config/swagger.ts`

```typescript
/**
 * @swagger
 * /api/auth/sign-in:
 *   post:
 *     summary: User sign in
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Sign in successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 */
export async function signIn(req: Request, res: Response) {
  // Implementation
}
```

**Requirements**:
1. ✅ Include route path and HTTP method
2. ✅ Add summary and tags
3. ✅ Document request body schema
4. ✅ Document all possible responses
5. ✅ Use $ref for shared schemas

### Rule 17: Frontend API Client

**Pattern**: Centralized API client with authentication.

**Source**: `frontend/src/lib/api-client.ts`

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';

interface RequestOptions extends RequestInit {
  token?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}

// Helper methods
export const api = {
  get: <T>(endpoint: string, token?: string) =>
    apiRequest<T>(endpoint, { method: 'GET', token }),

  post: <T>(endpoint: string, data: any, token?: string) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  put: <T>(endpoint: string, data: any, token?: string) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  delete: <T>(endpoint: string, token?: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE', token }),
};
```

**Usage**:
```typescript
import { api } from '@/lib/api-client';

// In a component
const token = await getAuthToken();
const data = await api.get<Question[]>('/api/practice/questions', token);
```

---

## Database Patterns

### Rule 18: Database Connection with Drizzle

**CRITICAL**: Use the centralized database connection with proper pooling.

**Connection Configuration**:
**Source**: `backend/src/config/database.ts:1-50`

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../models/schema';

const connectionString = process.env.DATABASE_URL!;

// Production connection with pooling
const client = postgres(connectionString, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  max: 20,                  // Max connections in pool
  idle_timeout: 20,         // Close idle connections after 20s
  connect_timeout: 10,      // Connection timeout
  max_lifetime: 1800,       // Max connection lifetime (30 min)
  prepare: false,           // Disable for transaction poolers (Supabase)
});

export const db = drizzle(client, { schema });

// Graceful shutdown
process.on('SIGTERM', async () => {
  await client.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await client.end();
  process.exit(0);
});
```

**Requirements**:
1. ✅ Use environment variable for connection string
2. ✅ Enable SSL in production
3. ✅ Configure connection pooling
4. ✅ Implement graceful shutdown
5. ✅ Disable prepared statements for Supabase/Neon

### Rule 19: Schema Definition with Drizzle

**Pattern**: Define database schema with proper types and enums.

**Source**: `backend/src/models/schema.ts:1-100`

```typescript
import { pgTable, uuid, varchar, timestamp, text, integer, boolean, pgEnum, json } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Define enums first
export const userRoleEnum = pgEnum('user_role', ['admin', 'student']);
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);
export const examStatusEnum = pgEnum('exam_status', [
  'not_started',
  'in_progress',
  'submitted',
  'evaluated',
]);

// 2. Define tables
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: userRoleEnum('role').default('student').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  questionText: text('question_text').notNull(),
  optionA: text('option_a').notNull(),
  optionB: text('option_b').notNull(),
  optionC: text('option_c').notNull(),
  optionD: text('option_d').notNull(),
  correctOption: varchar('correct_option', { length: 1 }).notNull(), // 'A', 'B', 'C', 'D'
  explanation: text('explanation'),
  subject: varchar('subject', { length: 100 }).notNull(),
  topic: varchar('topic', { length: 255 }),
  difficulty: difficultyEnum('difficulty').default('medium'),
  year: integer('year'), // NEET year (2015-2024)
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Define relations
export const questionsRelations = relations(questions, ({ many }) => ({
  studentAnswers: many(studentAnswers),
}));

export const usersRelations = relations(users, ({ many }) => ({
  exams: many(studentExams),
  answers: many(studentAnswers),
}));

// 4. Export inferred types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
```

**Schema Requirements**:
1. ✅ Use UUIDs for primary keys (uuid().defaultRandom())
2. ✅ Add timestamps (createdAt, updatedAt)
3. ✅ Use pgEnum for status/role fields
4. ✅ Add .notNull() for required fields
5. ✅ Add .unique() for unique constraints
6. ✅ Define relations for type-safe joins
7. ✅ Export inferred types ($inferSelect, $inferInsert)

### Rule 20: Query Patterns with Drizzle

**Pattern**: Use type-safe Drizzle queries with proper filtering.

**Basic SELECT**:
```typescript
import { db } from '../config/database';
import { eq, and, or, desc, asc } from 'drizzle-orm';
import { questions } from '../models/schema';

// Simple select
const allQuestions = await db.select().from(questions);

// With WHERE clause
const physicsQuestions = await db
  .select()
  .from(questions)
  .where(eq(questions.subject, 'Physics'));

// Multiple conditions
const hardPhysics = await db
  .select()
  .from(questions)
  .where(
    and(
      eq(questions.subject, 'Physics'),
      eq(questions.difficulty, 'hard')
    )
  );

// OR conditions
const easyOrMedium = await db
  .select()
  .from(questions)
  .where(
    or(
      eq(questions.difficulty, 'easy'),
      eq(questions.difficulty, 'medium')
    )
  );

// Ordering and limiting
const recentQuestions = await db
  .select()
  .from(questions)
  .orderBy(desc(questions.createdAt))
  .limit(50);
```

**INSERT**:
```typescript
import { NewQuestion } from '../models/schema';

const newQuestion: NewQuestion = {
  questionText: 'What is the formula for water?',
  optionA: 'H2O',
  optionB: 'CO2',
  optionC: 'O2',
  optionD: 'N2',
  correctOption: 'A',
  subject: 'Chemistry',
  difficulty: 'easy',
};

const [inserted] = await db
  .insert(questions)
  .values(newQuestion)
  .returning();
```

**UPDATE**:
```typescript
const [updated] = await db
  .update(questions)
  .set({ difficulty: 'hard' })
  .where(eq(questions.id, questionId))
  .returning();
```

**DELETE**:
```typescript
await db
  .delete(questions)
  .where(eq(questions.id, questionId));
```

**JOINS**:
```typescript
import { studentExams, users } from '../models/schema';

const examsWithUsers = await db
  .select({
    examId: studentExams.id,
    examScore: studentExams.score,
    userName: users.name,
    userEmail: users.email,
  })
  .from(studentExams)
  .leftJoin(users, eq(studentExams.userId, users.id));
```

### Rule 21: Database Migrations

**Pattern**: Use Drizzle Kit for database migrations.

**Migration Commands**:
```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Open Drizzle Studio (database GUI)
npm run db:studio
```

**Source**: `backend/package.json:8-10`

**Migration File Structure**:
```
backend/drizzle/
├── 0000_initial_schema.sql
├── 0001_add_books_table.sql
├── 0002_add_ai_chat.sql
└── meta/
    └── _journal.json
```

**Requirements**:
1. ✅ Never modify schema.ts directly in production
2. ✅ Always generate migration first
3. ✅ Review generated SQL before applying
4. ✅ Test migrations on staging environment
5. ✅ Commit migration files to version control

### Rule 22: Separation of Queries and Mutations

**Pattern**: Organize database operations by read vs write.

**Recommended Structure**:
```
backend/src/
├── db/
│   ├── queries/          # Read operations
│   │   ├── questions.ts
│   │   ├── users.ts
│   │   └── exams.ts
│   └── mutations/        # Write operations
│       ├── questions.ts
│       ├── users.ts
│       └── exams.ts
```

**Example - Queries (Read)**:
```typescript
// db/queries/questions.ts
import { db } from '../../config/database';
import { eq } from 'drizzle-orm';
import { questions } from '../../models/schema';

export async function getQuestionById(id: string) {
  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, id))
    .limit(1);
  return question;
}

export async function getQuestionsBySubject(subject: string, limit = 50) {
  return await db
    .select()
    .from(questions)
    .where(eq(questions.subject, subject))
    .limit(limit);
}
```

**Example - Mutations (Write)**:
```typescript
// db/mutations/questions.ts
import { db } from '../../config/database';
import { eq } from 'drizzle-orm';
import { questions, NewQuestion } from '../../models/schema';

export async function createQuestion(data: NewQuestion) {
  const [created] = await db
    .insert(questions)
    .values(data)
    .returning();
  return created;
}

export async function updateQuestion(id: string, data: Partial<NewQuestion>) {
  const [updated] = await db
    .update(questions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(questions.id, id))
    .returning();
  return updated;
}

export async function deleteQuestion(id: string) {
  await db.delete(questions).where(eq(questions.id, id));
}
```

**Why This Matters**:
- Clear separation of concerns
- Easier to audit writes
- Better caching strategies (read-heavy)
- Simpler permission checks

---

## Cloud Storage & File Uploads

### Rule 22A: Environment-Based Storage Strategy

**CRITICAL**: Use local filesystem for development, S3 for production.

**Configuration**:
**Source**: `backend/src/config/s3.ts`

```typescript
import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export const shouldUseS3 = (): boolean => {
  return process.env.NODE_ENV === 'production';
};
```

**Upload Middleware Pattern**:
**Source**: `backend/src/middleware/upload.ts`

```typescript
import multer from 'multer';
import multerS3 from 'multer-s3';
import { s3Client, s3Config, shouldUseS3 } from '../config/s3';

const storage = shouldUseS3()
  ? multerS3({
      s3: s3Client,
      bucket: s3Config.bucket,
      metadata: (req: any, file: any, cb: any) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req: any, file: any, cb: any) => {
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
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${file.originalname}-${uniqueSuffix}`);
      },
    });
```

**Benefits**:
- Seamless local development (no AWS credentials needed)
- Automatic S3 in production
- Single codebase for both environments

### Rule 22B: File Storage Abstraction

**Pattern**: Use utility functions to abstract file operations across local and S3 storage.

**File Storage Utilities**:
**Source**: `backend/src/utils/fileStorage.util.ts`

```typescript
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, s3Config, shouldUseS3 } from '../config/s3';

/**
 * Get file path from multer upload
 * Works for both local and S3 uploads
 */
export function getUploadedFilePath(file: Express.Multer.File): string {
  if (shouldUseS3()) {
    return (file as any).key || (file as any).location || file.path;
  }
  return file.path;
}

/**
 * Get local file path for processing
 * Downloads from S3 if needed
 */
export async function getLocalFilePath(filePath: string): Promise<string> {
  if (isS3Path(filePath)) {
    return await downloadS3File(filePath);
  }
  return filePath;
}

/**
 * Delete file from local filesystem or S3
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (isS3Path(filePath)) {
    const command = new DeleteObjectCommand({
      Bucket: s3Config.bucket,
      Key: extractS3Key(filePath),
    });
    await s3Client.send(command);
  } else {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
```

**Usage in Controllers**:
```typescript
import { getUploadedFilePath, getLocalFilePath, deleteFile } from '../utils/fileStorage.util';

export async function uploadBook(req: Request, res: Response) {
  try {
    // Get file path (works for both local and S3)
    const uploadedFilePath = getUploadedFilePath(req.file);

    // Get local path for processing (downloads from S3 if needed)
    const localFilePath = await getLocalFilePath(uploadedFilePath);

    // Process file...
    const result = await processFile(localFilePath);

    // Store the uploaded path in database
    await db.insert(books).values({
      filePath: uploadedFilePath, // Can be local path or S3 key
    });

    // Clean up temp file if downloaded from S3
    cleanupTempFile(localFilePath);
  } catch (error) {
    // Clean up on error
    if (req.file) {
      await deleteFile(getUploadedFilePath(req.file));
    }
  }
}
```

**Requirements**:
1. ✅ Always use `getUploadedFilePath()` instead of `req.file.path`
2. ✅ Use `getLocalFilePath()` when processing files
3. ✅ Use `deleteFile()` for cleanup (handles both local and S3)
4. ✅ Clean up temp files after processing
5. ✅ Store S3 URLs/keys in database, not local paths in production

### Rule 22C: S3 File Organization

**Pattern**: Organize files in S3 buckets with clear folder structure.

**Standard S3 Structure**:
```
s3://bucket-name/
├── books/
│   └── book-name-timestamp-random.pdf
├── diagrams/
│   └── diagram-timestamp-random.png
└── temp-uploads/
    └── test-files (auto-deleted)
```

**Naming Convention**:
- Books: `books/{originalname}-{timestamp}-{random}.pdf`
- Diagrams: `diagrams/diagram-{timestamp}-{random}.{ext}`
- Always include timestamp for uniqueness
- Always include random suffix to prevent collisions

---

## File Organization

### Rule 23: Backend Directory Structure

**Standard Backend Organization**:

```
backend/src/
├── config/
│   ├── database.ts           # Database connection
│   ├── firebase-admin.ts     # Firebase initialization
│   ├── s3.ts                 # AWS S3 configuration
│   ├── constants.ts          # App-wide constants
│   ├── swagger.ts            # API documentation
│   └── branding.ts           # App branding
│
├── middleware/
│   ├── authMiddleware.ts     # Authentication
│   ├── dualAuthMiddleware.ts # Dual auth support
│   ├── upload.ts             # Multer file upload
│   ├── aiRateLimiter.ts      # Rate limiting
│   └── performance-monitor.ts
│
├── models/
│   └── schema.ts             # Drizzle schema (all tables)
│
├── controllers/              # Business logic
│   ├── authController.ts
│   ├── questionsController.ts
│   ├── practiceController.ts
│   ├── studentsController.ts
│   ├── aiChatController.ts
│   └── adminController.ts
│
├── routes/                   # Express routes
│   ├── authRoutes.ts
│   ├── practiceRoutes.ts
│   ├── studentRoutes.ts
│   ├── adminRoutes.ts
│   └── aiChatRoutes.ts
│
├── services/                 # Business logic services
│   ├── pdfParserService.ts
│   ├── visionExtractionService.ts
│   ├── mockTestGeneratorService.ts
│   ├── cacheService.ts
│   └── testSessionService.ts
│
├── utils/                    # Helper functions
│   ├── jwt.util.ts
│   ├── password.util.ts
│   ├── fileStorage.util.ts   # S3/local file operations
│   ├── fileHash.util.ts
│   ├── response.util.ts
│   ├── validation.util.ts
│   └── mailer.ts
│
├── scripts/                  # Admin & migration scripts
│   └── seed-database.ts
│
└── server.ts                 # Express app entry
```

**Source**: Verified from `backend/src/` directory structure

### Rule 24: Frontend Directory Structure (Next.js App Router)

**Standard Frontend Organization**:

```
frontend/src/
├── app/                      # Next.js App Router
│   ├── (public)/             # Public route group
│   │   ├── ai-bot/
│   │   ├── practice/
│   │   ├── neet-pyq/
│   │   ├── pricing/
│   │   └── layout.tsx        # Public layout
│   │
│   ├── student/              # Student dashboard
│   │   ├── dashboard/
│   │   ├── practice/
│   │   ├── tests/
│   │   └── layout.tsx
│   │
│   ├── admin/                # Admin dashboard
│   │   ├── questions/
│   │   ├── users/
│   │   └── layout.tsx
│   │
│   ├── auth/                 # Auth pages
│   │   ├── login/
│   │   └── signup/
│   │
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page
│   └── globals.css           # Global styles
│
├── components/
│   ├── ui/                   # Radix UI components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   └── ... (25+ components)
│   │
│   ├── auth/                 # Auth components
│   │   ├── ProtectedRoute.tsx
│   │   └── DualProtectedRoute.tsx
│   │
│   ├── test/                 # Test interface
│   │   ├── TestInterface.tsx
│   │   ├── QuestionPalette.tsx
│   │   └── AnswerSheet.tsx
│   │
│   ├── landing/              # Landing page
│   │   ├── Navigation.tsx
│   │   └── HeroSection.tsx
│   │
│   ├── providers/            # Context providers
│   │   └── AuthProvider.tsx
│   │
│   └── providers.tsx         # Root providers
│
├── lib/
│   ├── firebase/
│   │   ├── config.ts         # Firebase config
│   │   └── auth-service.ts
│   │
│   ├── constants/            # App constants
│   │   ├── api.ts
│   │   ├── routes.ts
│   │   ├── branding.ts
│   │   └── subscription.ts
│   │
│   ├── hooks/                # Custom hooks
│   │   └── usePushNotifications.ts
│   │
│   ├── api-client.ts         # API client
│   ├── auth-client.ts        # Auth client
│   ├── analytics.ts
│   └── utils.ts              # Utility functions
│
├── store/                    # Redux store
│   ├── slices/
│   │   └── authSlice.ts
│   ├── store.ts
│   └── hooks.ts
│
└── types/                    # TypeScript types
    ├── api.ts
    ├── question.ts
    └── user.ts
```

**Source**: Verified from `frontend/src/` directory structure

### Rule 25: Route Group Pattern (Next.js)

**Pattern**: Use route groups to organize pages with shared layouts.

**Example - Public Routes**:
**Source**: `frontend/src/app/(public)/layout.tsx`

```typescript
import { Navigation } from '@/components/landing/Navigation';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>{children}</main>
    </div>
  );
}
```

**Directory Structure**:
```
app/
├── (public)/              # Route group - doesn't affect URL
│   ├── layout.tsx         # Shared public layout
│   ├── ai-bot/
│   │   └── page.tsx       # URL: /ai-bot
│   ├── practice/
│   │   └── page.tsx       # URL: /practice
│   └── pricing/
│       └── page.tsx       # URL: /pricing
```

**Benefits**:
- Shared layouts without URL nesting
- Clear visual organization
- Easier to apply middleware/auth

---

## UI Components

### Rule 26: Use Radix UI Primitives

**CRITICAL**: Always use Radix UI components for complex UI patterns.

**Available Components**:
**Source**: `frontend/package.json:18-35` (17 Radix packages installed)

- **Overlays**: Dialog, Alert Dialog, Sheet, Popover, Dropdown Menu
- **Forms**: Select, Checkbox, Radio Group, Switch, Slider
- **Navigation**: Tabs, Accordion, Collapsible
- **Feedback**: Toast (via Sonner), Progress
- **Layout**: Scroll Area, Separator, Aspect Ratio
- **Utilities**: Label, Avatar, Tooltip

**Example - Dialog Component**:
**Source**: `frontend/src/components/ui/dialog.tsx`

```typescript
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));

export { Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogContent, DialogClose };
```

**Usage**:
```typescript
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function MyComponent() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
        </DialogHeader>
        <p>This action cannot be undone.</p>
      </DialogContent>
    </Dialog>
  );
}
```

### Rule 27: Component Variants with CVA

**Pattern**: Use `class-variance-authority` for type-safe component variants.

**Example - Button Component**:
**Source**: `frontend/src/components/ui/button.tsx`

```typescript
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation active:scale-95 will-change-transform',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-lg hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90',
        outline: 'border-2 border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
```

**Usage**:
```typescript
import { Button } from '@/components/ui/button';

<Button>Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline" size="lg">Large Outline</Button>
<Button variant="ghost" size="icon"><TrashIcon /></Button>
```

**Benefits**:
- Type-safe variants
- IntelliSense autocomplete
- Consistent API
- Easy to extend

### Rule 28: Tailwind Utility Helper

**Pattern**: Use `cn()` helper for merging Tailwind classes.

**Source**: `frontend/src/lib/utils.ts`

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Why This Exists**:
- Merges Tailwind classes intelligently
- Removes conflicting classes
- Handles conditional classes

**Usage**:
```typescript
import { cn } from '@/lib/utils';

// Conditional classes
<div className={cn(
  'base-class',
  isActive && 'active-class',
  isError && 'error-class'
)} />

// Override variants
<Button className={cn('custom-padding', className)} />

// Merge complex conditions
<div className={cn(
  'flex items-center gap-2',
  {
    'bg-red-500': isError,
    'bg-green-500': isSuccess,
    'opacity-50': isDisabled,
  }
)} />
```

### Rule 29: Responsive Design Patterns

**Tailwind Breakpoints**:
**Source**: `frontend/tailwind.config.ts:15-22`

```typescript
screens: {
  xs: '320px',    // Smallest phones
  sm: '480px',    // Large mobile
  md: '768px',    // Tablet portrait
  lg: '1024px',   // Desktop
  xl: '1280px',   // Large desktop
  '2xl': '1400px',
}
```

**Mobile-First Approach**:
```typescript
<div className={cn(
  // Mobile (default)
  'flex flex-col gap-2 p-4',
  // Tablet
  'md:flex-row md:gap-4 md:p-6',
  // Desktop
  'lg:gap-6 lg:p-8',
  // Large desktop
  '2xl:max-w-7xl 2xl:mx-auto'
)} />
```

**Touch Optimization**:
```typescript
<Button className={cn(
  'touch-manipulation',     // Disable double-tap zoom
  'active:scale-95',        // Touch feedback
  'min-h-[44px] min-w-[44px]', // Minimum tap target
)} />
```

### Rule 30: Animation Patterns

**Framer Motion for Complex Animations**:
```typescript
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      Content
    </motion.div>
  )}
</AnimatePresence>
```

**Tailwind for Micro-Interactions**:
```typescript
<button className={cn(
  'transition-all duration-200',
  'hover:scale-105',
  'active:scale-95',
  'focus:ring-2 focus:ring-primary'
)} />
```

**Custom Animations**:
**Source**: `frontend/tailwind.config.ts:40-55`

```typescript
extend: {
  keyframes: {
    'fade-in': {
      '0%': { opacity: '0' },
      '100%': { opacity: '1' },
    },
    'slide-up': {
      '0%': { transform: 'translateY(20px)', opacity: '0' },
      '100%': { transform: 'translateY(0)', opacity: '1' },
    },
  },
  animation: {
    'fade-in': 'fade-in 0.5s ease-out',
    'slide-up': 'slide-up 0.4s ease-out',
  },
}
```

---

## Code Quality Rules

### Rule 31: ESLint and Prettier Configuration

**Backend ESLint**:
**Source**: `backend/.eslintrc.json`

```json
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "warn"
  }
}
```

**Frontend ESLint**:
**Source**: `frontend/.eslintrc.json`

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"]
}
```

**Prettier Configuration**:
**Source**: `backend/.prettierrc` and `frontend/.prettierrc`

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### Rule 32: Git Hooks with Husky

**Pre-commit Hook**:
**Source**: `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
```

**Lint-staged Configuration**:
**Source**: `package.json:66-72`

```json
"lint-staged": {
  "*.{js,jsx,ts,tsx}": [
    "prettier --write",
    "eslint --fix"
  ],
  "*.{json,md}": [
    "prettier --write"
  ]
}
```

**What This Does**:
1. Runs on `git commit`
2. Formats staged files with Prettier
3. Lints and fixes with ESLint
4. Prevents commit if errors exist

### Rule 33: Environment Variables

**Pattern**: All secrets and configuration in environment files.

**Backend .env Structure**:
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# JWT
JWT_SECRET=your-secret-key

# Firebase (Admin SDK)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# AI APIs
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
GOOGLE_GENERATIVE_AI_KEY=your-google-key

# AWS S3 (File Storage - Production Only)
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket-name

# Server
PORT=8888
NODE_ENV=production

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Frontend .env.local Structure**:
```env
# API
NEXT_PUBLIC_API_URL=http://localhost:8888

# Firebase (Client)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc
```

**Requirements**:
1. ✅ Never commit .env files to git
2. ✅ Provide .env.example templates
3. ✅ Use NEXT_PUBLIC_ prefix for client-side variables
4. ✅ Validate required env vars on startup
5. ✅ Use different .env files for dev/staging/prod

### Rule 34: Error Handling Best Practices

**Backend Error Handling**:
```typescript
// Controller level - always use try-catch
export async function controllerName(req: Request, res: Response) {
  try {
    // Business logic
    const result = await someOperation();
    return res.json({ success: true, data: result });
  } catch (error) {
    // Log error for debugging
    console.error('[controllerName] Error:', error);

    // Return user-friendly error
    return res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: ERROR_MESSAGES.SERVER_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Service level - throw specific errors
export async function serviceFunction() {
  const data = await fetchData();

  if (!data) {
    throw new Error('Data not found');
  }

  return data;
}
```

**Frontend Error Handling**:
```typescript
import { toast } from 'sonner';

// API calls
try {
  const data = await api.get('/endpoint');
  toast.success('Operation successful');
} catch (error) {
  console.error('API Error:', error);
  toast.error(error instanceof Error ? error.message : 'Something went wrong');
}

// React Query error handling
const { data, error, isError } = useQuery({
  queryKey: ['key'],
  queryFn: async () => {
    const result = await api.get('/endpoint');
    return result;
  },
  onError: (error) => {
    toast.error('Failed to fetch data');
  },
});

if (isError) {
  return <ErrorState message={error.message} />;
}
```

### Rule 35: Code Comments and Documentation

**When to Comment**:
```typescript
// ✅ GOOD - Explain WHY, not WHAT
// Using setTimeout to debounce rapid consecutive calls
setTimeout(() => saveData(), 300);

// ✅ GOOD - Document complex business logic
/**
 * Calculate NEET exam score based on marking scheme:
 * - Correct answer: +4 marks
 * - Wrong answer: -1 mark
 * - Unattempted: 0 marks
 */
export function calculateScore(answers: Answer[]): number {
  // Implementation
}

// ✅ GOOD - API documentation
/**
 * Get practice questions for a specific subject
 * @route GET /api/practice/questions
 * @param {string} subject - Physics, Chemistry, or Biology
 * @param {number} limit - Maximum questions to return
 * @returns {Question[]} Array of question objects
 */

// ❌ BAD - Stating the obvious
// Increment counter by 1
counter++;

// ❌ BAD - Commented-out code (delete it instead)
// const oldFunction = () => {
//   // ...
// };
```

**JSDoc for Public Functions**:
```typescript
/**
 * Generate a mock test based on NEET pattern
 * @param {Object} options - Test configuration
 * @param {string[]} options.subjects - Subjects to include
 * @param {number} options.questionCount - Total questions
 * @param {string} options.difficulty - easy | medium | hard
 * @returns {Promise<MockTest>} Generated mock test
 * @throws {Error} If question count exceeds available questions
 */
export async function generateMockTest(options: MockTestOptions): Promise<MockTest> {
  // Implementation
}
```

---

## State Management

### Rule 36: Redux Toolkit Configuration

**Store Setup**:
**Source**: `frontend/src/store/store.ts`

```typescript
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore Firebase user object
        ignoredActions: ['auth/setUser'],
        ignoredPaths: ['auth.user'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

**Typed Hooks**:
**Source**: `frontend/src/store/hooks.ts`

```typescript
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

**Slice Pattern**:
**Source**: `frontend/src/store/slices/authSlice.ts`

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setUser, setToken, logout } = authSlice.actions;
export default authSlice.reducer;
```

**Usage**:
```typescript
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setUser, logout } from '@/store/slices/authSlice';

function MyComponent() {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();

  const handleLogin = (userData: User) => {
    dispatch(setUser(userData));
  };

  const handleLogout = () => {
    dispatch(logout());
  };
}
```

### Rule 37: React Query for Server State

**Query Client Setup**:
**Source**: `frontend/src/components/providers.tsx`

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { ThemeProvider } from './theme-provider';
import { Toaster } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  );
}
```

**Query Patterns**:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

// Simple query
function useQuestions(subject: string) {
  return useQuery({
    queryKey: ['questions', subject],
    queryFn: async () => {
      const token = getAuthToken();
      return await api.get<Question[]>(`/api/practice/questions?subject=${subject}`, token);
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Mutation with optimistic update
function useSubmitAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (answer: SubmitAnswerData) => {
      const token = getAuthToken();
      return await api.post('/api/practice/answer', answer, token);
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['practice-history'] });
    },
    onError: (error) => {
      toast.error('Failed to submit answer');
    },
  });
}

// Usage in component
function PracticeComponent() {
  const { data: questions, isLoading, error } = useQuestions('Physics');
  const submitAnswer = useSubmitAnswer();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage />;

  return (
    <div>
      {questions?.map((q) => (
        <QuestionCard
          key={q.id}
          question={q}
          onSubmit={(answer) => submitAnswer.mutate(answer)}
        />
      ))}
    </div>
  );
}
```

### Rule 38: State Management Decision Tree

**When to use what**:

| State Type | Solution | Example |
|------------|----------|---------|
| **Server State** | React Query | Questions, exams, user data |
| **Global UI State** | Redux Toolkit | Auth status, theme, sidebar open |
| **Local Component State** | useState | Form inputs, toggles, local UI |
| **Form State** | React Hook Form | Login, signup, complex forms |
| **URL State** | Next.js searchParams | Filters, pagination, tabs |
| **Computed State** | useMemo | Derived calculations |

**Example Decision**:
```typescript
// ✅ Server state - use React Query
const { data: exams } = useQuery(['exams']);

// ✅ Global state - use Redux
const user = useAppSelector((state) => state.auth.user);

// ✅ Local state - use useState
const [isOpen, setIsOpen] = useState(false);

// ✅ Form state - use React Hook Form
const { register, handleSubmit } = useForm();

// ✅ URL state - use searchParams
const searchParams = useSearchParams();
const subject = searchParams.get('subject');

// ✅ Computed state - use useMemo
const score = useMemo(() => calculateScore(answers), [answers]);
```

---

## Performance Optimization

### Rule 39: Next.js Image Optimization

**Always use Next.js Image component**:
```typescript
import Image from 'next/image';

// ✅ CORRECT - Optimized
<Image
  src="/question-image.png"
  alt="Question diagram"
  width={500}
  height={300}
  priority={false} // Set true for above-the-fold images
  quality={85}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>

// ❌ WRONG - Not optimized
<img src="/question-image.png" alt="Question diagram" />
```

### Rule 40: Code Splitting and Lazy Loading

**Dynamic Imports for Heavy Components**:
```typescript
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Lazy load heavy component
const TestInterface = dynamic(() => import('@/components/test/TestInterface'), {
  loading: () => <Skeleton />,
  ssr: false, // Disable SSR for client-only components
});

// Lazy load with Suspense
const AnalyticsChart = dynamic(() => import('@/components/analytics/Chart'));

function Dashboard() {
  return (
    <div>
      <Suspense fallback={<ChartSkeleton />}>
        <AnalyticsChart />
      </Suspense>
    </div>
  );
}
```

### Rule 41: Database Query Optimization

**Always use indexes**:
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_questions_subject ON questions(subject);
CREATE INDEX idx_questions_year ON questions(year);
CREATE INDEX idx_student_exams_user_id ON student_exams(user_id);
CREATE INDEX idx_student_answers_exam_id ON student_answers(exam_id);
```

**Limit queries**:
```typescript
// ✅ CORRECT - Always use limit
const questions = await db
  .select()
  .from(questions)
  .limit(50);

// ❌ WRONG - Can return millions of rows
const questions = await db.select().from(questions);
```

**Use select specific columns**:
```typescript
// ✅ CORRECT - Select only needed columns
const exams = await db
  .select({
    id: studentExams.id,
    score: studentExams.score,
    createdAt: studentExams.createdAt,
  })
  .from(studentExams);

// ❌ LESS EFFICIENT - Selects all columns
const exams = await db.select().from(studentExams);
```

### Rule 42: Caching Strategies

**Redis Caching (Backend)**:
**Source**: `backend/src/services/cacheService.ts`

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

export async function getCached<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function setCache(key: string, value: any, ttl = 3600): Promise<void> {
  await redis.setex(key, ttl, JSON.stringify(value));
}

export async function invalidateCache(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

**Usage in Controllers**:
```typescript
export async function getSubjects(req: Request, res: Response) {
  try {
    // Check cache first
    const cacheKey = 'subjects:all';
    const cached = await getCached<Subject[]>(cacheKey);

    if (cached) {
      return res.json({ success: true, data: cached });
    }

    // Fetch from database
    const subjects = await db.select().from(subjectsTable);

    // Cache for 1 hour
    await setCache(cacheKey, subjects, 3600);

    return res.json({ success: true, data: subjects });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch subjects' });
  }
}
```

**React Query Caching (Frontend)**:
```typescript
// Configure stale time based on data volatility
const { data } = useQuery({
  queryKey: ['subjects'],
  queryFn: fetchSubjects,
  staleTime: 1000 * 60 * 60, // 1 hour - subjects rarely change
});

const { data: exams } = useQuery({
  queryKey: ['my-exams'],
  queryFn: fetchMyExams,
  staleTime: 1000 * 60 * 5, // 5 minutes - moderately dynamic
});

const { data: liveScore } = useQuery({
  queryKey: ['exam-score', examId],
  queryFn: () => fetchScore(examId),
  staleTime: 0, // Always fresh
  refetchInterval: 10000, // Refetch every 10 seconds
});
```

---

## Dependency Management

### Rule 43: Check Existing Packages Before Installing

**CRITICAL**: Before running `npm install`, check if a similar package already exists.

**Existing Packages by Category**:

#### Date/Time Utilities
- ✅ **date-fns** (4.1.0) - Already installed
  **Source**: `frontend/package.json:28`
- ❌ **moment.js** - DO NOT INSTALL (use date-fns)
- ❌ **dayjs** - DO NOT INSTALL (use date-fns)

#### Validation
- ✅ **Zod** (3.23.8) - Already installed
  **Source**: `frontend/package.json:60`
- ❌ **yup** - DO NOT INSTALL (use Zod)
- ❌ **joi** - DO NOT INSTALL (use Zod)

#### HTTP Clients
- ✅ **fetch** (native) - Use built-in fetch
- ✅ **axios** (1.13.2) - Already installed (backend)
  **Source**: `backend/package.json:22`
- ❌ **request** - DEPRECATED, do not use

#### UI Components
- ✅ **Radix UI** (17 packages) - Already installed
  **Source**: `frontend/package.json:18-35`
- ❌ **Headless UI** - DO NOT INSTALL (use Radix)
- ❌ **Material UI** - DO NOT INSTALL (use Radix + Tailwind)

#### Icons
- ✅ **Lucide React** (0.460.0) - Already installed
  **Source**: `frontend/package.json:37`
- ❌ **React Icons** - DO NOT INSTALL (use Lucide)
- ❌ **FontAwesome** - DO NOT INSTALL (use Lucide)

#### Animation
- ✅ **Framer Motion** (12.23.25) - Already installed
  **Source**: `frontend/package.json:32`
- ✅ **Tailwind transitions** - Use for simple animations
- ❌ **React Spring** - DO NOT INSTALL (use Framer Motion)

#### Forms
- ✅ **React Hook Form** (7.53.2) - Already installed
  **Source**: `frontend/package.json:49`
- ❌ **Formik** - DO NOT INSTALL (use React Hook Form)

#### State Management
- ✅ **Redux Toolkit** (2.2.8) - Already installed
  **Source**: `frontend/package.json:50`
- ✅ **TanStack React Query** (5.59.20) - Already installed
  **Source**: `frontend/package.json:17`
- ❌ **Zustand** - DO NOT INSTALL (use Redux Toolkit)
- ❌ **Jotai** - DO NOT INSTALL (use Redux Toolkit)

---

## Checklist: Before Creating New Features

- [ ] Review existing codebase for similar patterns
- [ ] Check if UI components exist in `components/ui/`
- [ ] Verify database schema can support feature
- [ ] Plan API endpoints following RESTful conventions
- [ ] Identify authentication requirements (JWT/Firebase/Admin)
- [ ] Create Zod validation schemas
- [ ] Plan error handling strategy
- [ ] Consider caching requirements
- [ ] Document API endpoints with Swagger
- [ ] Add TypeScript types

## Checklist: Before Installing Dependencies

- [ ] Search `backend/package.json` for alternatives
- [ ] Search `frontend/package.json` for existing packages
- [ ] Check "Existing Packages by Category" section above
- [ ] Verify package is actively maintained
- [ ] Check bundle size impact
- [ ] Review security advisories
- [ ] Document reason for new dependency

---

## Enforcement

**Priority**: HIGH - These standards prevent:
1. ❌ Security vulnerabilities (auth bypass, SQL injection)
2. ❌ Type safety issues (runtime errors)
3. ❌ Inconsistent architecture (maintenance burden)
4. ❌ Duplicate dependencies (bundle bloat)
5. ❌ Poor performance (slow queries, large bundles)

**Review Process**: All PRs must comply with these standards before merge.

---

## Document Maintenance

**Last Verified**: 2025-12-25
**Verification Method**: Direct codebase analysis with source citations
**Update Frequency**: After major architecture changes or new patterns emerge

**To Update This Document**:
1. Read actual source files (never assumptions)
2. Cite exact file paths and line numbers where applicable
3. Verify versions from package.json files
4. Test patterns against current codebase
5. Update "Last Verified" date

---

## Appendix: Source File Index

All standards in this document are based on these verified source files:

### Package Configuration
- `backend/package.json:1-100` - Backend dependencies and scripts
- `frontend/package.json:1-100` - Frontend dependencies and scripts
- `backend/tsconfig.json:1-20` - Backend TypeScript configuration
- `frontend/tsconfig.json:1-30` - Frontend TypeScript configuration

### Core Architecture
- `backend/src/server.ts:1-150` - Express app setup
- `backend/src/config/database.ts:1-50` - Database connection
- `backend/src/models/schema.ts:1-678` - Complete database schema
- `backend/src/middleware/authMiddleware.ts:1-150` - Dual authentication

### Example Implementations
- `backend/src/controllers/practiceController.ts:1-100` - Controller example
- `backend/src/routes/authRoutes.ts` - Route definition
- `frontend/src/components/ui/button.tsx` - UI component example
- `frontend/src/lib/api-client.ts` - API client
- `frontend/src/store/store.ts` - Redux setup
- `frontend/src/components/providers.tsx` - Provider pattern

### Configuration Files
- `backend/.eslintrc.json` - ESLint configuration
- `frontend/.eslintrc.json` - Next.js ESLint
- `.prettierrc` - Code formatting
- `.husky/pre-commit` - Git hooks
- `drizzle.config.ts` - Database configuration

**Total Source Files Referenced**: 25+ core files + complete project structure

---

*End of Coding Standards Document*
