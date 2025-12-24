import { Router } from 'express';
import { authenticate, requireStudent } from '../middleware/authMiddleware';
import * as studentExamsController from '../controllers/studentExamsController';

const router = Router();

// All routes require authentication and student role
router.use(authenticate, requireStudent);

// ============================================================================
// STUDENT EXAM ROUTES
// ============================================================================

/**
 * @swagger
 * /api/student/exams/start:
 *   post:
 *     summary: Create start
 *     tags: [Student Exams]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/exams/start', studentExamsController.startExam);
/**
 * @swagger
 * /api/student/exams/{examId}/answer:
 *   post:
 *     summary: Create answer
 *     tags: [Student Exams]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/exams/:examId/answer', studentExamsController.submitAnswer);
/**
 * @swagger
 * /api/student/exams/{examId}/submit:
 *   post:
 *     summary: Create submit
 *     tags: [Student Exams]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/exams/:examId/submit', studentExamsController.submitExam);
/**
 * @swagger
 * /api/student/exams/history:
 *   get:
 *     summary: Retrieve history
 *     tags: [Student Exams]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/exams/history', studentExamsController.getExamHistory);
/**
 * @swagger
 * /api/student/exams/{examId}/result:
 *   get:
 *     summary: Retrieve result
 *     tags: [Student Exams]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/exams/:examId/result', studentExamsController.getExamResult);

export default router;
