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
router.get('/chapters', dualAuthenticate, publicChaptersController.getPublicChapters);

/**
 * Get active subjects
 * Used by AI bot page for subject selection (requires login)
 */
router.get('/subjects', dualAuthenticate, publicChaptersController.getActiveSubjects);

/**
 * Get or create chat session for authenticated user
 */
router.post('/session', dualAuthenticate, aiChatController.getChatSession);

/**
 * Get chat history for a specific session
 */
router.get('/session/:sessionId', dualAuthenticate, aiChatController.getChatHistory);

/**
 * Send message and get AI response (with rate limiting)
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
router.delete('/session/:sessionId', dualAuthenticate, aiChatController.clearChatSession);

/**
 * Get all sessions for authenticated user
 */
router.get('/my-sessions', dualAuthenticate, aiChatController.getUserSessions);

/**
 * Get daily usage stats for authenticated user
 */
router.get('/usage', dualAuthenticate, aiChatController.getDailyUsage);

/**
 * Get recent questions asked by user for quick access
 */
router.get('/recent-questions', dualAuthenticate, aiChatController.getRecentQuestions);

/**
 * Get message counts for user's chat sessions
 */
router.get('/message-counts', dualAuthenticate, aiChatController.getMessageCounts);

export default router;
