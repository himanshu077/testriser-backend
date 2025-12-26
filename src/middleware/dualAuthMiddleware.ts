import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/constants';
import { verifyFirebaseToken } from '../config/firebase-admin';
import { db } from '../config/database';
import { users } from '../models/schema';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'student';
    authType: 'jwt' | 'firebase';
  };
}

/**
 * Dual authentication middleware
 * Supports both JWT (for admins) and Firebase (for students)
 */
export const dualAuthenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No authentication token provided',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Try to determine token type
    // JWT tokens have 3 parts separated by dots
    // Firebase tokens are longer and have different structure
    const tokenParts = token.split('.');

    if (tokenParts.length !== 3) {
      res.status(401).json({
        success: false,
        message: 'Invalid token format',
      });
      return;
    }

    // Try Firebase first (Firebase tokens are typically longer)
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

        next();
        return;
      } catch {
        // Not a valid Firebase token, try JWT
        console.log('Firebase verification failed, trying JWT');
      }
    }

    // Try JWT authentication
    try {
      const decoded = jwt.verify(token, JWT_CONFIG.SECRET as string) as {
        userId: string;
        email: string;
        role: string;
      };

      // Get user from database
      const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // JWT user authenticated
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'admin' | 'student',
        authType: 'jwt',
      };

      next();
      return;
    } catch {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }
  } catch (error: any) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

/**
 * Require specific authentication type
 */
export const requireAuthType = (authType: 'jwt' | 'firebase') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (req.user.authType !== authType) {
      res.status(403).json({
        success: false,
        message: `This endpoint requires ${authType} authentication`,
      });
      return;
    }

    next();
  };
};

/**
 * Require specific role (works with both auth types)
 */
export const requireDualRole = (roles: Array<'admin' | 'student'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};

/**
 * Admin only (JWT auth required)
 */
export const requireDualAdmin = [dualAuthenticate, requireDualRole(['admin'])];

/**
 * Student only (Firebase auth preferred)
 */
export const requireDualStudent = [dualAuthenticate, requireDualRole(['student'])];
