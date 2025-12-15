import { Request, Response } from 'express';
import { db } from '../config/database';
import { studentExams, studentAnswers, questions, papers, mockTests } from '../models/schema';
import { eq, and, desc } from 'drizzle-orm';
import { HTTP_STATUS } from '../config/constants';

/**
 * Start an exam (paper or mock test)
 * @route POST /api/student/exams/start
 */
export async function startExam(req: Request, res: Response) {
  try {
    const studentId = req.user?.id;
    const { paperId, mockTestId } = req.body;

    if (!studentId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        message: 'Student ID not found',
      });
    }

    if (!paperId && !mockTestId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Missing required field',
        message: 'Either paperId or mockTestId is required',
      });
    }

    const [newStudentExam] = await db
      .insert(studentExams)
      .values({
        studentId,
        paperId: paperId || null,
        mockTestId: mockTestId || null,
        status: 'in_progress',
        startTime: new Date(),
      })
      .returning();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Exam started successfully',
      data: newStudentExam,
    });
  } catch (error) {
    console.error('Error starting exam:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to start exam',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Submit an answer
 * @route POST /api/student/exams/:examId/answer
 */
export async function submitAnswer(req: Request, res: Response) {
  try {
    const studentId = req.user?.id;
    const { examId } = req.params;
    const { questionId, selectedAnswer, isMarkedForReview, timeSpent } = req.body;

    if (!studentId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
      });
    }

    // Verify exam belongs to student
    const [exam] = await db
      .select()
      .from(studentExams)
      .where(
        and(
          eq(studentExams.id, examId),
          eq(studentExams.studentId, studentId)
        )
      )
      .limit(1);

    if (!exam) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Exam not found',
      });
    }

    if (exam.status === 'submitted' || exam.status === 'evaluated') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Exam already submitted',
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

    // Calculate if answer is correct and marks
    const isCorrect = selectedAnswer === question.correctAnswer;
    const marksObtained = isCorrect
      ? parseFloat(question.marksPositive)
      : selectedAnswer
      ? -parseFloat(question.marksNegative)
      : 0;

    // Check if answer already exists (update) or create new
    const existingAnswer = await db
      .select()
      .from(studentAnswers)
      .where(
        and(
          eq(studentAnswers.studentExamId, examId),
          eq(studentAnswers.questionId, questionId)
        )
      )
      .limit(1);

    let answer;
    if (existingAnswer.length > 0) {
      // Update existing answer
      [answer] = await db
        .update(studentAnswers)
        .set({
          selectedAnswer,
          isCorrect,
          marksObtained: marksObtained.toString(),
          isMarkedForReview: isMarkedForReview || false,
          timeSpent,
          answeredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(studentAnswers.id, existingAnswer[0].id))
        .returning();
    } else {
      // Create new answer
      [answer] = await db
        .insert(studentAnswers)
        .values({
          studentExamId: examId,
          questionId,
          selectedAnswer,
          isCorrect,
          marksObtained: marksObtained.toString(),
          isMarkedForReview: isMarkedForReview || false,
          timeSpent,
          answeredAt: new Date(),
        })
        .returning();
    }

    res.json({
      success: true,
      message: 'Answer saved successfully',
      data: {
        answerId: answer.id,
        isCorrect: answer.isCorrect,
        marksObtained: answer.marksObtained,
      },
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to submit answer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Submit/finish exam
 * @route POST /api/student/exams/:examId/submit
 */
export async function submitExam(req: Request, res: Response) {
  try {
    const studentId = req.user?.id;
    const { examId } = req.params;

    if (!studentId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
      });
    }

    // Get exam details
    const [exam] = await db
      .select()
      .from(studentExams)
      .where(
        and(
          eq(studentExams.id, examId),
          eq(studentExams.studentId, studentId)
        )
      )
      .limit(1);

    if (!exam) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Exam not found',
      });
    }

    if (exam.status === 'submitted' || exam.status === 'evaluated') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Exam already submitted',
      });
    }

    // Get all answers for this exam
    const answers = await db
      .select()
      .from(studentAnswers)
      .where(eq(studentAnswers.studentExamId, examId));

    // Calculate statistics
    const correctAnswers = answers.filter((a) => a.isCorrect).length;
    const incorrectAnswers = answers.filter((a) => !a.isCorrect && a.selectedAnswer).length;
    const unanswered = answers.filter((a) => !a.selectedAnswer).length;
    const markedForReview = answers.filter((a) => a.isMarkedForReview).length;
    const totalScore = answers.reduce(
      (sum, a) => sum + parseFloat(a.marksObtained || '0'),
      0
    );
    const totalTimeSpent = answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0);

    // Update exam with results
    const [updatedExam] = await db
      .update(studentExams)
      .set({
        status: 'evaluated',
        endTime: new Date(),
        submittedAt: new Date(),
        totalScore: totalScore.toString(),
        correctAnswers,
        incorrectAnswers,
        unanswered,
        markedForReview,
        timeSpent: totalTimeSpent,
        updatedAt: new Date(),
      })
      .where(eq(studentExams.id, examId))
      .returning();

    res.json({
      success: true,
      message: 'Exam submitted successfully',
      data: {
        examId: updatedExam.id,
        totalScore: updatedExam.totalScore,
        correctAnswers: updatedExam.correctAnswers,
        incorrectAnswers: updatedExam.incorrectAnswers,
        unanswered: updatedExam.unanswered,
      },
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to submit exam',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get student's exam history
 * @route GET /api/student/exams/history
 */
export async function getExamHistory(req: Request, res: Response) {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
      });
    }

    const exams = await db
      .select()
      .from(studentExams)
      .where(eq(studentExams.studentId, studentId))
      .orderBy(desc(studentExams.createdAt));

    res.json({
      success: true,
      data: exams,
    });
  } catch (error) {
    console.error('Error fetching exam history:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch exam history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get exam result details
 * @route GET /api/student/exams/:examId/result
 */
export async function getExamResult(req: Request, res: Response) {
  try {
    const studentId = req.user?.id;
    const { examId } = req.params;

    if (!studentId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
      });
    }

    const [exam] = await db
      .select()
      .from(studentExams)
      .where(
        and(
          eq(studentExams.id, examId),
          eq(studentExams.studentId, studentId)
        )
      )
      .limit(1);

    if (!exam) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Exam not found',
      });
    }

    // Get all answers with questions
    const answersWithQuestions = await db
      .select({
        answer: studentAnswers,
        question: questions,
      })
      .from(studentAnswers)
      .innerJoin(questions, eq(studentAnswers.questionId, questions.id))
      .where(eq(studentAnswers.studentExamId, examId));

    res.json({
      success: true,
      data: {
        exam,
        answers: answersWithQuestions,
      },
    });
  } catch (error) {
    console.error('Error fetching exam result:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch exam result',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
