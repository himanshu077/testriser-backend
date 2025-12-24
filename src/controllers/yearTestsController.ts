import { Request, Response } from 'express';
import { db } from '../config/database';
import { questions, studentExams, studentAnswers } from '../models/schema';
import { eq, and } from 'drizzle-orm';
import { testSessionService } from '../services/testSessionService';

/**
 * Generate a year-wise full-length test (180 questions)
 * GET /api/year-tests/generate?year=2025&mode=test
 */
export const generateYearTest = async (req: Request, res: Response) => {
  try {
    const { year, mode = 'test' } = req.query;

    // Validation
    if (!year) {
      return res.status(400).json({
        success: false,
        message: 'year is required',
      });
    }

    const examYear = parseInt(year as string);
    if (examYear < 2000 || examYear > 2025) {
      return res.status(400).json({
        success: false,
        message: 'Year must be between 2000 and 2025',
      });
    }

    // Get all questions for this year
    const allQuestions = await db
      .select()
      .from(questions)
      .where(and(eq(questions.examYear, examYear), eq(questions.isActive, true)));

    if (allQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No questions available for ${examYear >= 2013 ? 'NEET' : 'AIPMT'} ${year}`,
      });
    }

    // Group questions by subject
    const physics = allQuestions.filter((q) => q.subject === 'Physics').slice(0, 45);
    const chemistry = allQuestions.filter((q) => q.subject === 'Chemistry').slice(0, 45);
    const botany = allQuestions.filter((q) => q.subject === 'Botany').slice(0, 45);
    const zoology = allQuestions.filter((q) => q.subject === 'Zoology').slice(0, 45);

    // Combine in order: Physics, Chemistry, Botany, Zoology
    const testQuestions = [...physics, ...chemistry, ...botany, ...zoology];

    if (testQuestions.length < 180) {
      return res.status(400).json({
        success: false,
        message: `Insufficient questions for full test. Available: ${testQuestions.length}/180`,
      });
    }

    // Practice mode: return questions WITH answers
    if (mode === 'practice') {
      return res.json({
        success: true,
        mode: 'practice',
        data: {
          examName: examYear >= 2013 ? `NEET ${year}` : `AIPMT ${year}`,
          year: examYear,
          totalQuestions: testQuestions.length,
          questions: testQuestions.map((q, index) => ({
            id: q.id,
            questionNumber: index + 1,
            questionText: q.questionText,
            questionImage: q.questionImage,
            questionType: q.questionType,
            subject: q.subject,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            optionAImage: q.optionAImage,
            optionBImage: q.optionBImage,
            optionCImage: q.optionCImage,
            optionDImage: q.optionDImage,
            correctAnswer: q.correctAnswer, // Include in practice mode
            explanation: q.explanation, // Include in practice mode
            difficulty: q.difficulty,
            marksPositive: q.marksPositive,
            marksNegative: q.marksNegative,
          })),
          testConfig: {
            duration: 180, // 180 minutes (3 hours)
            totalMarks: 720, // 180 questions × 4 marks
          },
        },
      });
    }

    // Test mode: Create session and return questions WITHOUT answers
    const sessionId = await testSessionService.createSession(
      `year-${year}`,
      1,
      'test',
      testQuestions
    );

    // Strip answers from questions
    const questionsWithoutAnswers = testSessionService.stripAnswers(
      testQuestions.map((q, index) => ({
        id: q.id,
        questionNumber: index + 1,
        questionText: q.questionText,
        questionImage: q.questionImage,
        questionType: q.questionType,
        subject: q.subject,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        optionAImage: q.optionAImage,
        optionBImage: q.optionBImage,
        optionCImage: q.optionCImage,
        optionDImage: q.optionDImage,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        marksPositive: q.marksPositive,
        marksNegative: q.marksNegative,
        topic: q.topic,
      }))
    );

    res.json({
      success: true,
      mode: 'test',
      data: {
        sessionId,
        examName: examYear >= 2013 ? `NEET ${year}` : `AIPMT ${year}`,
        year: examYear,
        totalQuestions: testQuestions.length,
        questions: questionsWithoutAnswers,
        testConfig: {
          duration: 180, // 180 minutes
          totalMarks: 720,
        },
      },
    });
  } catch (error: any) {
    console.error('Error generating year test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate test',
      error: error.message,
    });
  }
};

/**
 * Submit year-wise test
 * POST /api/year-tests/submit
 */
export const submitYearTest = async (req: Request, res: Response) => {
  try {
    const { sessionId, answers, timeSpent } = req.body;
    const userId = (req as any).user?.uid || (req as any).user?.id;

    // Validation
    if (!sessionId || !answers) {
      return res.status(400).json({
        success: false,
        message: 'sessionId and answers are required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Check if session exists
    const session = await testSessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired',
      });
    }

    // Check if already submitted
    const isSubmitted = await testSessionService.isSubmitted(sessionId);
    if (isSubmitted) {
      return res.status(400).json({
        success: false,
        message: 'Test already submitted',
      });
    }

    // Calculate score and subject-wise performance
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unanswered = 0;
    let totalScore = 0;
    const subjectPerformance: Record<string, { total: number; correct: number }> = {};
    const results: any[] = [];

    session.questions.forEach((question: any) => {
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correctAnswer;
      const isAnswered = userAnswer !== undefined && userAnswer !== null && userAnswer !== '';

      let marksObtained = 0;
      if (isAnswered) {
        if (isCorrect) {
          correctAnswers++;
          marksObtained = parseFloat(question.marksPositive || '4');
        } else {
          incorrectAnswers++;
          marksObtained = -parseFloat(question.marksNegative || '1');
        }
      } else {
        unanswered++;
      }

      totalScore += marksObtained;

      // Track subject performance
      const subject = question.subject || 'Unknown';
      if (!subjectPerformance[subject]) {
        subjectPerformance[subject] = { total: 0, correct: 0 };
      }
      subjectPerformance[subject].total++;
      if (isCorrect) {
        subjectPerformance[subject].correct++;
      }

      results.push({
        questionId: question.id,
        questionNumber: question.questionNumber,
        questionText: question.questionText,
        subject: question.subject,
        correctAnswer: question.correctAnswer,
        userAnswer: userAnswer || null,
        isCorrect,
        marksObtained,
        explanation: question.explanation,
      });
    });

    // Calculate subject-wise performance array
    const subjectWisePerformance = Object.entries(subjectPerformance).map(([subject, stats]) => ({
      subject,
      total: stats.total,
      correct: stats.correct,
      accuracy: Math.round((stats.correct / stats.total) * 100),
    }));

    // Identify weak subjects (< 50% accuracy)
    const weakSubjects = subjectWisePerformance
      .filter((s) => s.accuracy < 50)
      .map((s) => s.subject);

    // Save to database
    const totalQuestions = session.questions.length;
    const totalMarks = totalQuestions * 4;

    const [studentExam] = await db
      .insert(studentExams)
      .values({
        studentId: userId,
        status: 'submitted',
        startTime: new Date(session.createdAt),
        submittedAt: new Date(),
        totalScore: totalScore.toString(),
        correctAnswers,
        incorrectAnswers,
        unanswered,
        timeSpent: timeSpent || 0,
      })
      .returning();

    // Save individual answers
    for (const result of results) {
      await db.insert(studentAnswers).values({
        studentExamId: studentExam.id,
        questionId: result.questionId,
        selectedAnswer: result.userAnswer,
        isCorrect: result.isCorrect,
        marksObtained: result.marksObtained.toString(),
      });
    }

    // Mark session as submitted
    await testSessionService.markSubmitted(sessionId);

    // Return results
    res.json({
      success: true,
      data: {
        examId: studentExam.id,
        score: totalScore,
        totalMarks,
        correctAnswers,
        incorrectAnswers,
        unanswered,
        percentage: Math.round((totalScore / totalMarks) * 100),
        subjectWisePerformance,
        weakSubjects,
        results,
      },
    });
  } catch (error: any) {
    console.error('Error submitting year test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit test',
      error: error.message,
    });
  }
};
