import { Router } from 'express';
import { getActiveSubjects } from '../controllers/subjectsController';

const router = Router();

/**
 * Public Subjects Routes
 * Get active subjects for students/public use
 */

/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: Get all active subjects
 *     description: Public endpoint to fetch all active subjects (Physics, Chemistry, Biology)
 *     tags: [Subjects]
 *     responses:
 *       200:
 *         description: List of active subjects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       code:
 *                         type: string
 *                         example: PHY
 *                       name:
 *                         type: string
 *                         example: Physics
 *                       displayOrder:
 *                         type: integer
 *                         example: 1
 *                       isActive:
 *                         type: boolean
 *                         example: true
 *       500:
 *         description: Server error
 */
router.get('/', getActiveSubjects);

export default router;
