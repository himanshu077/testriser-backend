import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../config/database';
import { users } from '../models/schema';
import { eq } from 'drizzle-orm';
import {
  JWT_CONFIG,
  HTTP_STATUS,
  ERROR_MESSAGES,
  BCRYPT_CONFIG,
  VALIDATION,
} from '../config/constants';
// Email imports (DISABLED - will enable later)
// import { sendPasswordResetEmail, sendPasswordChangeConfirmation } from '../utils/mailer';

/**
 * Sign up a new user
 */
export async function signUp(req: Request, res: Response) {
  try {
    const { email, password, name, phone, role } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: ERROR_MESSAGES.REQUIRED_FIELDS,
      });
    }

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existingUser.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: ERROR_MESSAGES.USER_EXISTS,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_CONFIG.SALT_ROUNDS);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        name,
        phone: phone || null,
        role: role || 'student', // Default role is student
        emailVerified: false,
      })
      .returning();

    // Generate JWT token
    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
      JWT_CONFIG.SECRET,
      { expiresIn: JWT_CONFIG.EXPIRES_IN } as SignOptions
    );

    // Return user and token
    res.status(HTTP_STATUS.CREATED).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
      token,
    });
  } catch (error: any) {
    console.error('Sign up error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Sign in an existing user
 */
export async function signIn(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    // Verify password
    if (!user.password) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_CONFIG.SECRET,
      { expiresIn: JWT_CONFIG.EXPIRES_IN } as SignOptions
    );

    // Return user and token
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error: any) {
    console.error('Sign in error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Get current user session
 */
export async function getSession(req: Request, res: Response) {
  try {
    // User is already authenticated by middleware
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No active session',
      });
    }

    // Get fresh user data
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Get session error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Sign out (client-side token removal)
 */
export async function signOut(req: Request, res: Response) {
  // JWT is stateless, so sign out is handled on client side
  // by removing the token from storage
  res.status(200).json({
    success: true,
    message: 'Signed out successfully',
  });
}

/**
 * Forgot password - Send reset email
 */
export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Email is required',
      });
    }

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'If an account exists, a password reset email has been sent',
      });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, BCRYPT_CONFIG.SALT_ROUNDS);
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    await db
      .update(users)
      .set({
        resetPasswordToken: hashedToken,
        resetPasswordExpiry: tokenExpiry,
      })
      .where(eq(users.id, user.id));

    // Send email (DISABLED - will enable later)
    // await sendPasswordResetEmail(user.email, resetToken);
    console.log('📧 [EMAIL DISABLED] Password reset token for', user.email, ':', resetToken);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'If an account exists, a password reset email has been sent',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process password reset request',
    });
  }
}

/**
 * Reset password using token
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Token and new password are required',
      });
    }

    if (newPassword.length < VALIDATION.PASSWORD_MIN_LENGTH) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`,
      });
    }

    // Find all users with reset tokens
    const allUsers = await db.select().from(users);
    let matchedUser = null;

    // Find user with matching token
    for (const user of allUsers) {
      if (user.resetPasswordToken && user.resetPasswordExpiry) {
        const isTokenValid = await bcrypt.compare(token, user.resetPasswordToken);
        if (isTokenValid) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Invalid or expired reset token',
      });
    }

    // Check if token is expired
    if (new Date() > new Date(matchedUser.resetPasswordExpiry!)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Reset token has expired',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_CONFIG.SALT_ROUNDS);

    // Update password and clear reset token
    await db
      .update(users)
      .set({
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      })
      .where(eq(users.id, matchedUser.id));

    // Send confirmation email (DISABLED - will enable later)
    // await sendPasswordChangeConfirmation(matchedUser.email);
    console.log('📧 [EMAIL DISABLED] Password changed successfully for', matchedUser.email);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reset password',
    });
  }
}

/**
 * Change password for authenticated user
 */
export async function changePassword(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < VALIDATION.PASSWORD_MIN_LENGTH) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`,
      });
    }

    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user || !user.password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'User not found',
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_CONFIG.SALT_ROUNDS);

    // Update password
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));

    // Send confirmation email (DISABLED - will enable later)
    // await sendPasswordChangeConfirmation(user.email);
    console.log('📧 [EMAIL DISABLED] Password changed successfully for', user.email);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to change password',
    });
  }
}
