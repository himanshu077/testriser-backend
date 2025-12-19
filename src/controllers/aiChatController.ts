import { Request, Response } from 'express';
import { db } from '../config/database';
import { aiChatSessions, aiChatMessages } from '../models/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { openaiService } from '../services/openaiService';
import { v4 as uuidv4 } from 'uuid';

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

/**
 * Get or create chat session for a subject/chapter
 */
export async function getChatSession(req: Request, res: Response) {
  try {
    const { subject, chapter } = req.body;
    const userId = (req as any).user?.id; // From auth middleware

    if (!subject || !chapter) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Subject and chapter are required',
      });
    }

    // Check if session already exists
    const session = await db
      .select()
      .from(aiChatSessions)
      .where(
        and(
          eq(aiChatSessions.userId, userId),
          eq(aiChatSessions.subjectCode, subject),
          eq(aiChatSessions.chapterSlug, chapter)
        )
      )
      .limit(1);

    if (session.length > 0) {
      // Update last activity
      await db
        .update(aiChatSessions)
        .set({ lastActivityAt: new Date() })
        .where(eq(aiChatSessions.id, session[0].id));

      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: session[0],
      });
    }

    // Create new session
    const newSession = await db
      .insert(aiChatSessions)
      .values({
        userId,
        sessionId: uuidv4(),
        subjectCode: subject,
        chapterSlug: chapter,
        isAnonymous: false,
      })
      .returning();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: newSession[0],
    });
  } catch (error: any) {
    console.error('Get chat session error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to get chat session',
      message: error.message,
    });
  }
}

/**
 * Get chat history for a session
 */
export async function getChatHistory(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const userId = (req as any).user?.id;

    if (!sessionId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    // Verify session belongs to user
    const session = await db
      .select()
      .from(aiChatSessions)
      .where(eq(aiChatSessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Session not found',
      });
    }

    if (session[0].userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get messages
    const messages = await db
      .select()
      .from(aiChatMessages)
      .where(eq(aiChatMessages.sessionId, sessionId))
      .orderBy(aiChatMessages.createdAt);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    console.error('Get chat history error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to get chat history',
      message: error.message,
    });
  }
}

/**
 * Send message and get AI response
 */
export async function sendMessage(req: Request, res: Response) {
  try {
    const { sessionId, subject, chapter, message } = req.body;
    const userId = (req as any).user?.id;
    const userTier = (req as any).user?.subscriptionTier || 'free';

    if (!sessionId || !subject || !chapter || !message) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Session ID, subject, chapter, and message are required',
      });
    }

    // Verify session
    const session = await db
      .select()
      .from(aiChatSessions)
      .where(eq(aiChatSessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Session not found',
      });
    }

    if (session[0].userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get recent chat history for context
    const recentMessages = await db
      .select()
      .from(aiChatMessages)
      .where(eq(aiChatMessages.sessionId, sessionId))
      .orderBy(desc(aiChatMessages.createdAt))
      .limit(5);

    // Reverse to chronological order
    const contextMessages = recentMessages.reverse().map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Add current user message
    contextMessages.push({
      role: 'user',
      content: message,
    });

    // Save user message
    const userMessage = await db
      .insert(aiChatMessages)
      .values({
        sessionId,
        role: 'user',
        content: message,
      })
      .returning();

    // Generate AI response
    const aiResponse = await openaiService.generateChatResponse({
      messages: contextMessages,
      subject,
      chapter,
      userTier,
      userId,
    });

    // Save AI response
    const assistantMessage = await db
      .insert(aiChatMessages)
      .values({
        sessionId,
        role: 'assistant',
        content: aiResponse.content,
        tokenCount: aiResponse.tokenCount.total,
        model: aiResponse.model,
        processingTimeMs: aiResponse.processingTimeMs,
        metadata: JSON.stringify({
          subject,
          chapter,
          cost: aiResponse.cost,
        }),
      })
      .returning();

    // Update session activity
    await db
      .update(aiChatSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(aiChatSessions.id, sessionId));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        userMessage: userMessage[0],
        assistantMessage: assistantMessage[0],
        usage: {
          tokens: aiResponse.tokenCount,
          cost: aiResponse.cost,
          processingTime: aiResponse.processingTimeMs,
        },
      },
    });
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to send message',
      message: error.message,
    });
  }
}

/**
 * Clear chat session (delete all messages)
 */
export async function clearChatSession(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const userId = (req as any).user?.id;

    if (!sessionId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    // Verify session belongs to user
    const session = await db
      .select()
      .from(aiChatSessions)
      .where(eq(aiChatSessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Session not found',
      });
    }

    if (session[0].userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Delete all messages (cascade will handle this, but explicit is better)
    await db.delete(aiChatMessages).where(eq(aiChatMessages.sessionId, sessionId));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Chat history cleared successfully',
    });
  } catch (error: any) {
    console.error('Clear chat session error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to clear chat session',
      message: error.message,
    });
  }
}

/**
 * Get all sessions for authenticated user
 */
export async function getUserSessions(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    const sessions = await db
      .select()
      .from(aiChatSessions)
      .where(eq(aiChatSessions.userId, userId))
      .orderBy(desc(aiChatSessions.lastActivityAt));

    // Get message count for each session
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (session) => {
        const messageCount = await db
          .select()
          .from(aiChatMessages)
          .where(eq(aiChatMessages.sessionId, session.id));

        return {
          ...session,
          messageCount: messageCount.length,
        };
      })
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: sessionsWithCounts,
    });
  } catch (error: any) {
    console.error('Get user sessions error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to get user sessions',
      message: error.message,
    });
  }
}

/**
 * Get daily usage stats for user
 */
export async function getDailyUsage(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const userTier = (req as any).user?.subscriptionTier || 'free';

    const usage = await openaiService.getDailyUsage(userId);

    // Define tier limits (must match openaiService.ts)
    const tierLimits: Record<string, number> = {
      free: 5,
      trial: 10,
      pro: 50,
      platinum: 100,
      elite: 999999,
    };

    const limit = tierLimits[userTier] || tierLimits.free;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ...usage,
        tier: userTier,
        limit: limit,
      },
    });
  } catch (error: any) {
    console.error('Get daily usage error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to get daily usage',
      message: error.message,
    });
  }
}

/**
 * Get recent questions asked by user for quick access
 * Returns last 4 unique user questions from the current chapter
 */
export async function getRecentQuestions(req: Request, res: Response) {
  try {
    const { subject, chapter } = req.query;
    const userId = (req as any).user?.id;

    if (!subject || !chapter) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Subject and chapter are required',
      });
    }

    // Get session for this subject/chapter
    const session = await db
      .select()
      .from(aiChatSessions)
      .where(
        and(
          eq(aiChatSessions.userId, userId),
          eq(aiChatSessions.subjectCode, subject as string),
          eq(aiChatSessions.chapterSlug, chapter as string)
        )
      )
      .limit(1);

    if (session.length === 0) {
      // No session yet, return empty array
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: [],
      });
    }

    // Get recent user messages (questions)
    const recentQuestions = await db
      .select({
        content: aiChatMessages.content,
        createdAt: aiChatMessages.createdAt,
      })
      .from(aiChatMessages)
      .where(and(eq(aiChatMessages.sessionId, session[0].id), eq(aiChatMessages.role, 'user')))
      .orderBy(desc(aiChatMessages.createdAt))
      .limit(10); // Get more to filter duplicates

    // Remove duplicates and get unique questions (case-insensitive)
    const uniqueQuestions: string[] = [];
    const seen = new Set<string>();

    for (const q of recentQuestions) {
      const normalized = q.content.toLowerCase().trim();
      if (!seen.has(normalized) && uniqueQuestions.length < 4) {
        seen.add(normalized);
        uniqueQuestions.push(q.content);
      }
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: uniqueQuestions,
    });
  } catch (error: any) {
    console.error('Get recent questions error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to get recent questions',
      message: error.message,
    });
  }
}

/**
 * Get message counts for user's chat sessions
 * Returns counts by subject and by chapter for display badges
 */
export async function getMessageCounts(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    // Optimized query: Get session info with message counts in ONE query using JOIN + GROUP BY
    const sessionCounts = await db
      .select({
        subjectCode: aiChatSessions.subjectCode,
        chapterSlug: aiChatSessions.chapterSlug,
        messageCount: sql<number>`COUNT(${aiChatMessages.id})::int`,
      })
      .from(aiChatSessions)
      .leftJoin(aiChatMessages, eq(aiChatSessions.id, aiChatMessages.sessionId))
      .where(eq(aiChatSessions.userId, userId))
      .groupBy(aiChatSessions.id, aiChatSessions.subjectCode, aiChatSessions.chapterSlug);

    // Build counts object from results
    const counts: {
      bySubject: Record<string, number>;
      byChapter: Record<string, Record<string, number>>;
    } = {
      bySubject: {},
      byChapter: {},
    };

    for (const row of sessionCounts) {
      const { subjectCode, chapterSlug, messageCount } = row;

      // Count by subject
      if (!counts.bySubject[subjectCode]) {
        counts.bySubject[subjectCode] = 0;
      }
      counts.bySubject[subjectCode] += messageCount;

      // Count by chapter
      if (!counts.byChapter[subjectCode]) {
        counts.byChapter[subjectCode] = {};
      }
      counts.byChapter[subjectCode][chapterSlug] = messageCount;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: counts,
    });
  } catch (error: any) {
    console.error('Get message counts error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to get message counts',
      message: error.message,
    });
  }
}
