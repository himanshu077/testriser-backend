import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as practiceController from '../controllers/practiceController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// PRACTICE ROUTES
// ============================================================================

router.get('/questions', practiceController.getPracticeQuestions);
router.post('/answer', practiceController.submitPracticeAnswer);
router.get('/history', practiceController.getPracticeHistory);
router.get('/stats', practiceController.getPracticeStats);

export default router;
