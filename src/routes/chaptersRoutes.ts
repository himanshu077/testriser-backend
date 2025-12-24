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
/**
 * @swagger
 * /api/:
 *   get:
 *     summary: Retrieve chapters
 *     tags: [Chapters]
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

router.get('/', dualAuthenticate, getPublicChapters);

// Get all active subjects (requires authentication)
// GET /api/chapters/subjects
/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: Retrieve subjects
 *     tags: [Chapters]
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

router.get('/subjects', dualAuthenticate, getActiveSubjects);

export default router;
