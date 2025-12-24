import { Router } from 'express';
import { getAllStudents, getStudentById } from '../controllers/studentsController';
import { authenticate, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

/**
 * @swagger
 * /api/students:
 *   get:
 *     summary: Get all students
 *     description: Retrieve all registered students with their stats (Admin only)
 *     tags: [Students]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Students retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 students:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       testsAttempted:
 *                         type: number
 *                       avgScore:
 *                         type: number
 *                       lastActive:
 *                         type: string
 *                       performance:
 *                         type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalStudents:
 *                       type: number
 *                     activeToday:
 *                       type: number
 *                     avgScore:
 *                       type: number
 *                     testsTaken:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
/**
 * @swagger
 * /api/:
 *   get:
 *     summary: Retrieve students
 *     tags: [Students]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Server error
 */

router.get('/', authenticate, requireAdmin, getAllStudents);

/**
 * @swagger
 * /api/students/{id}:
 *   get:
 *     summary: Get student by ID
 *     description: Retrieve detailed information about a specific student (Admin only)
 *     tags: [Students]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
 *     responses:
 *       200:
 *         description: Student retrieved successfully
 *       404:
 *         description: Student not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
/**
 * @swagger
 * /api/students/{id}:
 *   get:
 *     summary: Retrieve students
 *     tags: [Students]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Server error
 */

router.get('/:id', authenticate, requireAdmin, getStudentById);

export default router;
