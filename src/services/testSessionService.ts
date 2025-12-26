import { cacheService } from './cacheService';
import crypto from 'crypto';

interface TestSession {
  sessionId: string;
  chapterId: string;
  testNumber: number;
  mode: 'test' | 'practice';
  questions: any[]; // Full questions with answers
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL = 30 * 60; // 30 minutes in seconds

export const testSessionService = {
  /**
   * Create a new test session
   * Stores full questions (with answers) in cache and returns sessionId
   */
  async createSession(
    chapterId: string,
    testNumber: number,
    mode: 'test' | 'practice',
    questions: any[]
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const session: TestSession = {
      sessionId,
      chapterId,
      testNumber,
      mode,
      questions,
      createdAt: now,
      expiresAt: now + SESSION_TTL * 1000,
    };

    // Store in cache with TTL
    await cacheService.set(`test:session:${sessionId}`, session, SESSION_TTL);

    return sessionId;
  },

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<TestSession | null> {
    return await cacheService.get(`test:session:${sessionId}`);
  },

  /**
   * Check if session has been submitted
   */
  async isSubmitted(sessionId: string): Promise<boolean> {
    const submitted = await cacheService.get(`test:session:${sessionId}:submitted`);
    return !!submitted;
  },

  /**
   * Mark session as submitted (prevents re-submission)
   */
  async markSubmitted(sessionId: string): Promise<void> {
    await cacheService.set(`test:session:${sessionId}:submitted`, true, 3600); // 1 hour
  },

  /**
   * Invalidate session (delete from cache)
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await cacheService.delete(`test:session:${sessionId}`);
  },

  /**
   * Strip answers from questions for client response
   */
  stripAnswers(questions: any[]): any[] {
    return questions.map((q) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const {
        correctAnswer: _correctAnswer,
        explanation: _explanation,
        ...questionWithoutAnswers
      } = q;
      return questionWithoutAnswers;
    });
  },
};
