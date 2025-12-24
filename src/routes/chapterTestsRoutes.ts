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
router.get('/generate', dualAuthenticate, generateChapterTest);

// Submit chapter test
// POST /api/chapter-tests/submit
router.post('/submit', dualAuthenticate, submitChapterTest);

export default router;
