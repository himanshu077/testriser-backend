import { Router } from 'express';
import { getPublicChapters, getActiveSubjects } from '../controllers/publicChaptersController';
import { dualAuthenticate } from '../middleware/dualAuthMiddleware';

const router = Router();

/**
 * Chapters Routes (Requires Authentication)
 * For authenticated students to access curriculum chapters for PYQ
 */

// Get chapters by subject and grade (requires authentication)
// GET /api/chapters?subject=physics&grade=11
router.get('/', dualAuthenticate, getPublicChapters);

// Get all active subjects (requires authentication)
// GET /api/chapters/subjects
router.get('/subjects', dualAuthenticate, getActiveSubjects);

export default router;
