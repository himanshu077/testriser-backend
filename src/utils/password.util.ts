/**
 * Password Utilities
 * @module utils/password
 * @description Utility functions for password hashing and verification
 */

import bcrypt from 'bcryptjs';
import { BCRYPT_CONFIG } from '../config/constants';

/**
 * Hashes a plain text password
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_CONFIG.SALT_ROUNDS);
}

/**
 * Compares a plain text password with a hashed password
 * @param password - Plain text password
 * @param hashedPassword - Hashed password to compare against
 * @returns True if passwords match, false otherwise
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Validates password strength
 * @param password - Password to validate
 * @returns True if password meets requirements, false otherwise
 */
export function validatePasswordStrength(password: string): boolean {
  // Minimum 6 characters
  return password.length >= 6;
}

/**
 * Validates password with detailed feedback
 * @param password - Password to validate
 * @returns Object with validation result and message
 */
export function validatePasswordDetailed(password: string): {
  isValid: boolean;
  message: string;
} {
  if (password.length < 6) {
    return {
      isValid: false,
      message: 'Password must be at least 6 characters long',
    };
  }

  return {
    isValid: true,
    message: 'Password is valid',
  };
}
