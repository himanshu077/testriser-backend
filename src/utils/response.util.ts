/**
 * Response Utilities
 * @module utils/response
 * @description Utility functions for standardized API responses
 */

import { Response } from 'express';
import { HTTP_STATUS } from '../config/constants';

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: any;
}

/**
 * Sends a success response
 * @param res - Express response object
 * @param data - Data to send
 * @param message - Optional success message
 * @param statusCode - HTTP status code (default: 200)
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = HTTP_STATUS.OK
): void {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  res.status(statusCode).json(response);
}

/**
 * Sends an error response
 * @param res - Express response object
 * @param error - Error name/type
 * @param message - Error message
 * @param statusCode - HTTP status code
 * @param details - Optional error details
 */
export function sendError(
  res: Response,
  error: string,
  message: string,
  statusCode: number = HTTP_STATUS.SERVER_ERROR,
  details?: any
): void {
  const response: ErrorResponse = {
    success: false,
    error,
    message,
  };

  if (details) {
    response.details = details;
  }

  res.status(statusCode).json(response);
}

/**
 * Sends a 400 Bad Request response
 * @param res - Express response object
 * @param message - Error message
 * @param details - Optional error details
 */
export function sendBadRequest(res: Response, message: string, details?: any): void {
  sendError(res, 'Bad Request', message, HTTP_STATUS.BAD_REQUEST, details);
}

/**
 * Sends a 401 Unauthorized response
 * @param res - Express response object
 * @param message - Error message
 */
export function sendUnauthorized(res: Response, message?: string): void {
  sendError(res, 'Unauthorized', message || 'Authentication required', HTTP_STATUS.UNAUTHORIZED);
}

/**
 * Sends a 403 Forbidden response
 * @param res - Express response object
 * @param message - Error message
 */
export function sendForbidden(res: Response, message?: string): void {
  sendError(res, 'Forbidden', message || 'Insufficient permissions', HTTP_STATUS.FORBIDDEN);
}

/**
 * Sends a 404 Not Found response
 * @param res - Express response object
 * @param message - Error message
 */
export function sendNotFound(res: Response, message?: string): void {
  sendError(res, 'Not Found', message || 'Resource not found', HTTP_STATUS.NOT_FOUND);
}

/**
 * Sends a 500 Server Error response
 * @param res - Express response object
 * @param message - Error message
 * @param details - Optional error details
 */
export function sendServerError(res: Response, message?: string, details?: any): void {
  sendError(
    res,
    'Server Error',
    message || 'Internal server error',
    HTTP_STATUS.SERVER_ERROR,
    details
  );
}
