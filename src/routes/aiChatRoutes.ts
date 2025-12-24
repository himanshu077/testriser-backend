import { Router } from 'express';
import * as aiChatController from '../controllers/aiChatController';
import * as publicChaptersController from '../controllers/publicChaptersController';
import { dualAuthenticate } from '../middleware/dualAuthMiddleware';
import { aiRateLimiter } from '../middleware/aiRateLimiter';

const router = Router();

// ============================================================================
// PROTECTED ROUTES (Require authentication)
// ============================================================================

/**
 * Get chapters filtered by subject and grade
 * Used by AI bot page for chapter selection (requires login)
 */
/**
 * @swagger
 * /api/chapters:
 *   get:
 *     summary: Retrieve chapters
 *     tags: [AI Chat]
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

router.get('/chapters', dualAuthenticate, publicChaptersController.getPublicChapters);

/**
 * Get active subjects
 * Used by AI bot page for subject selection (requires login)
 */
/**
 * @swagger
 * /api/subjects:
 *   get:
 *     summary: Retrieve subjects
 *     tags: [AI Chat]
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

router.get('/subjects', dualAuthenticate, publicChaptersController.getActiveSubjects);

/**
 * Get or create chat session for authenticated user
 */
/**
 * @swagger
 * /api/session:
 *   post:
 *     summary: Create session
 *     tags: [AI Chat]
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

router.post('/session', dualAuthenticate, aiChatController.getChatSession);

/**
 * Get chat history for a specific session
 */
/**
 * @swagger
 * /api/session/{sessionId}:
 *   get:
 *     summary: Retrieve session
 *     tags: [AI Chat]
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

router.get('/session/:sessionId', dualAuthenticate, aiChatController.getChatHistory);

/**
 * Send message and get AI response (with rate limiting)
 */
/**
 * @swagger
 * /api/message:
 *   post:
 *     summary: Create message
 *     tags: [AI Chat]
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

router.post(
  '/message',
  dualAuthenticate,
  aiRateLimiter, // Check tier-based daily limits
  aiChatController.sendMessage
);

/**
 * Clear chat history for a session
 */
/**
 * @swagger
 * /api/session/{sessionId}:
 *   delete:
 *     summary: Delete session
 *     tags: [AI Chat]
 *     security:
 *       - studentAuth: []
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */

router.delete('/session/:sessionId', dualAuthenticate, aiChatController.clearChatSession);

/**
 * Get all sessions for authenticated user
 */
/**
 * @swagger
 * /api/my-sessions:
 *   get:
 *     summary: Retrieve my-sessions
 *     tags: [AI Chat]
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

router.get('/my-sessions', dualAuthenticate, aiChatController.getUserSessions);

/**
 * Get daily usage stats for authenticated user
 */
/**
 * @swagger
 * /api/usage:
 *   get:
 *     summary: Retrieve usage
 *     tags: [AI Chat]
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

router.get('/usage', dualAuthenticate, aiChatController.getDailyUsage);

/**
 * Get recent questions asked by user for quick access
 */
/**
 * @swagger
 * /api/recent-questions:
 *   get:
 *     summary: Retrieve recent-questions
 *     tags: [AI Chat]
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

router.get('/recent-questions', dualAuthenticate, aiChatController.getRecentQuestions);

/**
 * Get message counts for user's chat sessions
 */
/**
 * @swagger
 * /api/message-counts:
 *   get:
 *     summary: Retrieve message-counts
 *     tags: [AI Chat]
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

router.get('/message-counts', dualAuthenticate, aiChatController.getMessageCounts);

export default router;
