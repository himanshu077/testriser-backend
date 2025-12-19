import { Router } from 'express';
import * as aiChatController from '../controllers/aiChatController';
import * as publicChaptersController from '../controllers/publicChaptersController';
import { authenticate } from '../middleware/authMiddleware';
import { aiRateLimiter } from '../middleware/aiRateLimiter';

const router = Router();

// ============================================================================
// PROTECTED ROUTES (Require authentication)
// ============================================================================

/**
 * Get chapters filtered by subject and grade
 * Used by AI bot page for chapter selection (requires login)
 */
router.get('/chapters', authenticate, publicChaptersController.getPublicChapters);

/**
 * Get active subjects
 * Used by AI bot page for subject selection (requires login)
 */
router.get('/subjects', authenticate, publicChaptersController.getActiveSubjects);

/**
 * Get or create chat session for authenticated user
 */
router.post('/session', authenticate, aiChatController.getChatSession);

/**
 * Get chat history for a specific session
 */
router.get('/session/:sessionId', authenticate, aiChatController.getChatHistory);

/**
 * Send message and get AI response (with rate limiting)
 */
router.post(
  '/message',
  authenticate,
  aiRateLimiter, // Check tier-based daily limits
  aiChatController.sendMessage
);

/**
 * Clear chat history for a session
 */
router.delete('/session/:sessionId', authenticate, aiChatController.clearChatSession);

/**
 * Get all sessions for authenticated user
 */
router.get('/my-sessions', authenticate, aiChatController.getUserSessions);

/**
 * Get daily usage stats for authenticated user
 */
router.get('/usage', authenticate, aiChatController.getDailyUsage);

/**
 * Get recent questions asked by user for quick access
 */
router.get('/recent-questions', authenticate, aiChatController.getRecentQuestions);

/**
 * Get message counts for user's chat sessions
 */
router.get('/message-counts', authenticate, aiChatController.getMessageCounts);

export default router;
