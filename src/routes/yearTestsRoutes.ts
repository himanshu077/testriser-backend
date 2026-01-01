import { Router } from 'express';
import { generateYearTest, submitYearTest, getYearStats } from '../controllers/yearTestsController';
import { dualAuthenticate } from '../middleware/dualAuthMiddleware';

const router = Router();

/**
 * Year-Wise Tests Routes
 * For generating and submitting full-length NEET/AIPMT tests by year
 */

// Get year-wise question statistics (public - for displaying available years)
// GET /api/year-tests/stats
/**
 * @swagger
 * /api/year-tests/stats:
 *   get:
 *     summary: Get year-wise question statistics
 *     tags: [Year Tests]
 *     responses:
 *       200:
 *         description: Success - Returns available years with question counts
 *       500:
 *         description: Server error
 */
router.get('/stats', getYearStats);

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
