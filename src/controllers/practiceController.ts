import { Request, Response } from 'express';
import { db } from '../config/database';
import { questionPractice, questions } from '../models/schema';
import { eq, and, desc } from 'drizzle-orm';
import { HTTP_STATUS } from '../config/constants';

/**
 * Get questions for practice by subject/topic
 * @route GET /api/practice/questions
 */
export async function getPracticeQuestions(req: Request, res: Response) {
  try {
    const { subject, topic, limit = '50' } = req.query;

    const conditions = [];

    if (subject) {
      conditions.push(eq(questions.subject, subject as any));
    }
    if (topic) {
      conditions.push(eq(questions.topic, topic as string));
    }

    let query = db.select().from(questions);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const practiceQuestions = await query.limit(parseInt(limit as string));

    res.json({
      success: true,
      data: practiceQuestions,
    });
  } catch (error) {
    console.error('Error fetching practice questions:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch practice questions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Submit practice answer
 * @route POST /api/practice/answer
 */
export async function submitPracticeAnswer(req: Request, res: Response) {
  try {
    const studentId = req.user?.id;
    const { questionId, selectedAnswer } = req.body;

    if (!studentId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
      });
    }

    if (!questionId || !selectedAnswer) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Missing required fields',
        required: ['questionId', 'selectedAnswer'],
      });
    }

    // Get question details
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    const isCorrect = selectedAnswer === question.correctAnswer;

    // Check if practice record exists
    const existingPractice = await db
      .select()
      .from(questionPractice)
      .where(
        and(eq(questionPractice.studentId, studentId), eq(questionPractice.questionId, questionId))
      )
      .limit(1);

    let practice;
    if (existingPractice.length > 0) {
      // Update existing practice record
      [practice] = await db
        .update(questionPractice)
        .set({
          selectedAnswer,
          isCorrect,
          attemptCount: (existingPractice[0].attemptCount ?? 0) + 1,
          lastAttemptedAt: new Date(),
        })
        .where(eq(questionPractice.id, existingPractice[0].id))
        .returning();
    } else {
      // Create new practice record
      [practice] = await db
        .insert(questionPractice)
        .values({
          studentId,
          questionId,
          subject: question.subject,
          topic: question.topic,
          selectedAnswer,
          isCorrect,
          attemptCount: 1,
        })
        .returning();
    }

    res.json({
      success: true,
      message: 'Practice answer saved successfully',
      data: {
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        explanationImage: question.explanationImage,
        attemptCount: practice.attemptCount,
      },
    });
  } catch (error) {
    console.error('Error submitting practice answer:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to submit practice answer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get student's practice history
 * @route GET /api/practice/history
 */
export async function getPracticeHistory(req: Request, res: Response) {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
      });
    }

    const practiceHistory = await db
      .select()
      .from(questionPractice)
      .where(eq(questionPractice.studentId, studentId))
      .orderBy(desc(questionPractice.lastAttemptedAt));

    res.json({
      success: true,
      data: practiceHistory,
    });
  } catch (error) {
    console.error('Error fetching practice history:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch practice history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get practice statistics
 * @route GET /api/practice/stats
 */
export async function getPracticeStats(req: Request, res: Response) {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
      });
    }

    const practiceRecords = await db
      .select()
      .from(questionPractice)
      .where(eq(questionPractice.studentId, studentId));

    // Calculate statistics
    const totalQuestions = practiceRecords.length;
    const correctAnswers = practiceRecords.filter((r) => r.isCorrect).length;
    const incorrectAnswers = totalQuestions - correctAnswers;
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    // Subject-wise stats
    const subjectStats = practiceRecords.reduce(
      (acc, record) => {
        const subject = record.subject;
        if (!acc[subject]) {
          acc[subject] = { total: 0, correct: 0, accuracy: 0 };
        }
        acc[subject].total++;
        if (record.isCorrect) {
          acc[subject].correct++;
        }
        acc[subject].accuracy = (acc[subject].correct / acc[subject].total) * 100;
        return acc;
      },
      {} as Record<string, { total: number; correct: number; accuracy: number }>
    );

    res.json({
      success: true,
      data: {
        overall: {
          totalQuestions,
          correctAnswers,
          incorrectAnswers,
          accuracy: accuracy.toFixed(2),
        },
        bySubject: subjectStats,
      },
    });
  } catch (error) {
    console.error('Error fetching practice stats:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch practice stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
