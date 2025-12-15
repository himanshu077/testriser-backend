/**
 * JWT Utilities
 * @module utils/jwt
 * @description Utility functions for JWT token operations
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/constants';

export interface JWTPayload {
  id: string;
  email: string;
  role: 'admin' | 'buyer';
  exp?: number; // JWT expiration timestamp
  iat?: number; // JWT issued at timestamp
}

/**
 * Generates a JWT token for a user
 * @param payload - User data to encode in token
 * @returns JWT token string
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign({ id: payload.id, email: payload.email, role: payload.role }, JWT_CONFIG.SECRET, {
    expiresIn: JWT_CONFIG.EXPIRES_IN,
  } as SignOptions);
}

/**
 * Verifies and decodes a JWT token
 * @param token - JWT token to verify
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Decodes a JWT token without verification (use with caution)
 * @param token - JWT token to decode
 * @returns Decoded payload or null if invalid format
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Checks if a token is expired
 * @param token - JWT token to check
 * @returns True if expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return true;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}
