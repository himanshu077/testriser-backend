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
router.get('/generate', dualAuthenticate, generateYearTest);

// Submit year-wise test
// POST /api/year-tests/submit
router.post('/submit', dualAuthenticate, submitYearTest);

export default router;
