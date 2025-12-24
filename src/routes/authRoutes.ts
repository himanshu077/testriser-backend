import { Router } from 'express';
import {
  signUp,
  signIn,
  getSession,
  signOut,
  forgotPassword,
  resetPassword,
  changePassword,
} from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

/**
 * @swagger
 * /api/auth/sign-up:
 *   post:
 *     summary: Register a new student
 *     description: Create a new student account for NEET exam preparation
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newuser@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: password123
 *               name:
 *                 type: string
 *                 example: John Doe
 *               phone:
 *                 type: string
 *                 example: +91 9876543210
 *               role:
 *                 type: string
 *                 example: student
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Invalid input or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @swagger
 * /api/sign-up:
 *   post:
 *     summary: Create sign-up
 *     tags: [Authentication]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/sign-up', signUp);

/**
 * @swagger
 * /api/auth/sign-in:
 *   post:
 *     summary: Login with email and password
 *     description: Authenticate user and receive JWT token
 *     tags: [Auth]
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
 *                 example: admin@testriser.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: admin123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT token - use in Authorization header as "Bearer {token}"
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @swagger
 * /api/sign-in:
 *   post:
 *     summary: Create sign-in
 *     tags: [Authentication]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/sign-in', signIn);

/**
 * @swagger
 * /api/auth/sign-out:
 *   post:
 *     summary: Logout current user
 *     description: Invalidate the current session (client removes token)
 *     tags: [Auth]
 *     security:
 *       - adminAuth: []
 *       - buyerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Signed out successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @swagger
 * /api/sign-out:
 *   post:
 *     summary: Create sign-out
 *     tags: [Authentication]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.post('/sign-out', authenticate, signOut);

/**
 * @swagger
 * /api/auth/session:
 *   get:
 *     summary: Get current session
 *     description: Retrieve the current user session information
 *     tags: [Auth]
 *     security:
 *       - adminAuth: []
 *       - buyerAuth: []
 *     responses:
 *       200:
 *         description: Session retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - No valid session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * @swagger
 * /api/session:
 *   get:
 *     summary: Retrieve session
 *     tags: [Authentication]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.get('/session', authenticate, getSession);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: Send password reset email to user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@testriser.com
 *     responses:
 *       200:
 *         description: Password reset email sent (always returns success for security)
 */
/**
 * @swagger
 * /api/forgot-password:
 *   post:
 *     summary: Create forgot-password
 *     tags: [Authentication]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/forgot-password', forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     description: Reset user password using token from email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 example: abc123resettoken
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
/**
 * @swagger
 * /api/reset-password:
 *   post:
 *     summary: Create reset-password
 *     tags: [Authentication]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/reset-password', resetPassword);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password for authenticated user
 *     description: Change password while logged in
 *     tags: [Auth]
 *     security:
 *       - adminAuth: []
 *       - buyerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: oldpassword123
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Current password is incorrect
 *       401:
 *         description: Unauthorized
 */
/**
 * @swagger
 * /api/change-password:
 *   post:
 *     summary: Create change-password
 *     tags: [Authentication]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Server error
 */

router.post('/change-password', authenticate, changePassword);

export default router;
