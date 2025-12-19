import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { users } from '../models/schema';
import { eq } from 'drizzle-orm';

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
      };
    }
  }
}

/**
 * Middleware to verify authentication token
 * Validates the session token and attaches user info to request
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

    // Validate token format (JWT should have 3 parts separated by dots)
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
