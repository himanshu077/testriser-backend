import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { users } from '../models/schema';
import { eq } from 'drizzle-orm';
import { verifyFirebaseToken } from '../config/firebase-admin';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: 'admin' | 'student';
        authType?: 'jwt' | 'firebase';
      };
    }
  }
}

/**
 * Middleware to verify authentication token
 * Supports both JWT (admin) and Firebase (student) authentication
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
    }

    const token = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix and trim whitespace

    // Validate token format (both JWT and Firebase tokens have 3 parts)
    if (!token || token.split('.').length !== 3) {
      console.error('Invalid token format:', {
        tokenLength: token?.length,
        tokenParts: token?.split('.').length,
        tokenPreview: token?.substring(0, 20) + '...',
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token format',
      });
    }

    // Try Firebase authentication first (Firebase tokens are typically longer)
    if (token.length > 500) {
      try {
        const decodedToken = await verifyFirebaseToken(token);

        // Firebase user authenticated
        req.user = {
          id: decodedToken.uid,
          email: decodedToken.email || '',
          name: decodedToken.name || decodedToken.email?.split('@')[0] || 'Student',
          role: 'student',
          authType: 'firebase',
        };

        return next();
      } catch {
        // Not a valid Firebase token, try JWT below
        console.log('Firebase verification failed, trying JWT');
      }
    }

    // Try JWT authentication
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id?: string;
        userId?: string;
        email: string;
        role: 'admin' | 'student';
      };

      // Support both 'id' and 'userId' fields
      const userId = decoded.id || decoded.userId;
      if (!userId) {
        throw new Error('Token missing user ID');
      }

      // Get full user details from database
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        authType: 'jwt',
      };

      next();
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed',
    });
  }
}

/**
 * Middleware to check if user has required role
 * IMPORTANT: Use this after authenticate middleware
 *
 * Example usage:
 * router.get('/admin/dashboard', authenticate, requireRole(['admin']), adminController)
 */
export function requireRole(allowedRoles: Array<'admin' | 'student'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
}

/**
 * Middleware specifically for admin-only routes
 * Example: router.get('/admin/users', authenticate, requireAdmin, getUsersController)
 */
export const requireAdmin = requireRole(['admin']);

/**
 * Middleware specifically for student-only routes
 * Example: router.get('/student/exams', authenticate, requireStudent, getExamsController)
 */
export const requireStudent = requireRole(['student']);

/**
 * Middleware for SSE authentication via query parameter
 * Used for EventSource connections which cannot send custom headers
 *
 * Usage: router.get('/stream', authenticateSSE, requireRole(['admin']), handler)
 */
export async function authenticateSSE(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from query parameter
    const token = (req.query.token as string)?.trim();

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided in query parameter',
      });
    }

    // Validate token format (JWT should have 3 parts separated by dots)
    if (token.split('.').length !== 3) {
      console.error('Invalid SSE token format:', {
        tokenLength: token.length,
        tokenParts: token.split('.').length,
        tokenPreview: token.substring(0, 20) + '...',
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token format',
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: 'admin' | 'student';
    };

    // Get full user details from database
    const [user] = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('SSE Authentication error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed',
    });
  }
}
