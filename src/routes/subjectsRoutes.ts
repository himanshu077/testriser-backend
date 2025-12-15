import { Router } from 'express';
import { getActiveSubjects } from '../controllers/subjectsController';

const router = Router();

/**
 * Public Subjects Routes
 * Get active subjects for students/public use
 */

// Get all active subjects (no authentication required)
// GET /api/subjects
router.get('/', getActiveSubjects);

export default router;
