import { Router } from 'express';
import { generateYearTest, submitYearTest } from '../controllers/yearTestsController';
import { dualAuthenticate } from '../middleware/dualAuthMiddleware';

const router = Router();

/**
 * Year-Wise Tests Routes (All require authentication)
 * For generating and submitting full-length NEET/AIPMT tests by year
 */

// Generate year-wise test (180 questions)
// GET /api/year-tests/generate?year=2025&mode=test
/**
 * @swagger
 * /api/year-tests/generate:
 *   get:
 *     summary: Retrieve generate
 *     tags: [Year Tests]
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

router.get('/generate', dualAuthenticate, generateYearTest);

// Submit year-wise test
// POST /api/year-tests/submit
/**
 * @swagger
 * /api/year-tests/submit:
 *   post:
 *     summary: Create submit
 *     tags: [Year Tests]
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

router.post('/submit', dualAuthenticate, submitYearTest);

export default router;
