import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as practiceController from '../controllers/practiceController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// PRACTICE ROUTES
// ============================================================================

/**
 * @swagger
 * /api/questions:
 *   get:
 *     summary: Retrieve questions
 *     tags: [Practice]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/questions', practiceController.getPracticeQuestions);
/**
 * @swagger
 * /api/answer:
 *   post:
 *     summary: Create answer
 *     tags: [Practice]
 *     responses:
 *       201:
 *         description: Created successfully
 *       500:
 *         description: Server error
 */

router.post('/answer', practiceController.submitPracticeAnswer);
/**
 * @swagger
 * /api/history:
 *   get:
 *     summary: Retrieve history
 *     tags: [Practice]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/history', practiceController.getPracticeHistory);
/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Retrieve stats
 *     tags: [Practice]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/stats', practiceController.getPracticeStats);

export default router;
