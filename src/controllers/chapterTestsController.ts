import { Request, Response } from 'express';
import { db } from '../config/database';
import { questions, curriculumChapters, studentExams, studentAnswers } from '../models/schema';
import { eq, and } from 'drizzle-orm';
import { testSessionService } from '../services/testSessionService';

/**
 * Generate a chapter test
 * GET /api/chapter-tests/generate?chapterId=X&testNumber=1&mode=test
 */
export const generateChapterTest = async (req: Request, res: Response) => {
  try {
    const { chapterId, testNumber, mode = 'test' } = req.query;

    // Validation
    if (!chapterId || !testNumber) {
      return res.status(400).json({
        success: false,
        message: 'chapterId and testNumber are required',
      });
    }

    const testNum = parseInt(testNumber as string);
    if (testNum < 1 || testNum > 3) {
      return res.status(400).json({
        success: false,
        message: 'testNumber must be between 1 and 3',
      });
    }

    // Get chapter details
    const [chapter] = await db
      .select()
      .from(curriculumChapters)
      .where(eq(curriculumChapters.id, chapterId as string))
      .limit(1);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found',
      });
    }

    // Get all questions for this chapter
    const allQuestions = await db
      .select()
      .from(questions)
      .where(
        and(eq(questions.curriculumChapterId, chapterId as string), eq(questions.isActive, true))
      );

    if (allQuestions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No questions available for this chapter',
      });
    }

    // Calculate offset for test number
    // Test 1: questions 0-44, Test 2: 45-89, Test 3: 90-134
    const questionsPerTest = 45;
    const startIndex = (testNum - 1) * questionsPerTest;
    const endIndex = startIndex + questionsPerTest;

    // Get questions for this test
    let testQuestions = allQuestions.slice(startIndex, endIndex);

    // If not enough questions, take what's available
    if (testQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Not enough questions for Test ${testNum}. Available: ${allQuestions.length}`,
      });
    }

    // Shuffle questions for variety
    testQuestions = testQuestions.sort(() => Math.random() - 0.5);

    // Practice mode: return questions WITH answers
    if (mode === 'practice') {
      return res.json({
        success: true,
        mode: 'practice',
        data: {
          chapterName: chapter.name,
          testNumber: testNum,
          totalAvailable: allQuestions.length,
          questions: testQuestions.map((q, index) => ({
            id: q.id,
            questionNumber: index + 1,
            questionText: q.questionText,
            questionImage: q.questionImage,
            questionType: q.questionType,
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
            duration: 45, // 45 minutes for 45 questions
            totalMarks: testQuestions.length * 4, // 4 marks per question
          },
        },
      });
    }

    // Test mode: Create session and return questions WITHOUT answers
    const sessionId = await testSessionService.createSession(
      chapterId as string,
      testNum,
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
        subject: q.subject,
        topic: q.topic,
      }))
    );

    res.json({
      success: true,
      mode: 'test',
      data: {
        sessionId,
        chapterName: chapter.name,
        testNumber: testNum,
        totalAvailable: allQuestions.length,
        questions: questionsWithoutAnswers,
        testConfig: {
          duration: 45, // 45 minutes
          totalMarks: testQuestions.length * 4,
        },
      },
    });
  } catch (error: any) {
    console.error('Error generating chapter test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate test',
      error: error.message,
    });
  }
};

/**
 * Submit chapter test
 * POST /api/chapter-tests/submit
 */
export const submitChapterTest = async (req: Request, res: Response) => {
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

    // Calculate score and topic-wise performance
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unanswered = 0;
    let totalScore = 0;
    const topicPerformance: Record<string, { total: number; correct: number }> = {};
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

      // Track topic performance
      const topic = question.topic || 'Unknown';
      if (!topicPerformance[topic]) {
        topicPerformance[topic] = { total: 0, correct: 0 };
      }
      topicPerformance[topic].total++;
      if (isCorrect) {
        topicPerformance[topic].correct++;
      }

      results.push({
        questionId: question.id,
        questionNumber: question.questionNumber,
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        userAnswer: userAnswer || null,
        isCorrect,
        marksObtained,
        explanation: question.explanation,
      });
    });

    // Calculate topic-wise performance array
    const topicWisePerformance = Object.entries(topicPerformance).map(([topic, stats]) => ({
      topic,
      total: stats.total,
      correct: stats.correct,
      accuracy: Math.round((stats.correct / stats.total) * 100),
    }));

    // Identify weak topics (< 50% accuracy)
    const weakTopics = topicWisePerformance.filter((t) => t.accuracy < 50).map((t) => t.topic);

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
        topicWisePerformance,
        weakTopics,
        results,
      },
    });
  } catch (error: any) {
    console.error('Error submitting chapter test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit test',
      error: error.message,
    });
  }
};
