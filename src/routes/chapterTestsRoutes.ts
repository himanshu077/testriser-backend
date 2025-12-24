import { Router } from 'express';
import { generateChapterTest, submitChapterTest } from '../controllers/chapterTestsController';
import { dualAuthenticate } from '../middleware/dualAuthMiddleware';

const router = Router();

/**
 * Chapter Tests Routes (All require authentication)
 * For generating and submitting chapter-wise tests
 */

// Generate chapter test (Test 1, 2, or 3)
// GET /api/chapter-tests/generate?chapterId=X&testNumber=1&mode=test
/**
 * @swagger
 * /api/generate:
 *   get:
 *     summary: Retrieve generate
 *     tags: [Chapter Tests]
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

router.get('/generate', dualAuthenticate, generateChapterTest);

// Submit chapter test
// POST /api/chapter-tests/submit
/**
 * @swagger
 * /api/submit:
 *   post:
 *     summary: Create submit
 *     tags: [Chapter Tests]
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

router.post('/submit', dualAuthenticate, submitChapterTest);

export default router;
