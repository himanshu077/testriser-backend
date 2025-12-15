/**
 * Validation Utilities
 * @module utils/validation
 * @description Utility functions for data validation
 */

/**
 * Validates email format
 * @param email - Email address to validate
 * @returns True if valid email format, false otherwise
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates required field
 * @param value - Value to check
 * @returns True if value exists and is not empty, false otherwise
 */
export function validateRequired(value: any): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
}

/**
 * Validates user role
 * @param role - Role to validate
 * @returns True if valid role, false otherwise
 */
export function validateRole(role: string): role is 'admin' | 'buyer' {
  return role === 'admin' || role === 'buyer';
}

/**
 * Validates UUID format
 * @param uuid - UUID to validate
 * @returns True if valid UUID format, false otherwise
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validates phone number format (basic)
 * @param phone - Phone number to validate
 * @returns True if valid phone format, false otherwise
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Validates URL format
 * @param url - URL to validate
 * @returns True if valid URL format, false otherwise
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates pagination parameters
 * @param page - Page number
 * @param limit - Items per page
 * @returns Object with validated page and limit
 */
export function validatePagination(page: number, limit: number): { page: number; limit: number } {
  const validatedPage = Math.max(1, Math.floor(page));
  const validatedLimit = Math.min(100, Math.max(1, Math.floor(limit)));

  return {
    page: validatedPage,
    limit: validatedLimit,
  };
}
