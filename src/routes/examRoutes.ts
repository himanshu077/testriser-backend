import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { db } from '../config/database';
import { papers, mockTests, questions, mockTestQuestions } from '../models/schema';
import { eq, and } from 'drizzle-orm';
import { HTTP_STATUS } from '../config/constants';

const router = Router();

/**
 * Get all published papers
 * @route GET /api/exam/papers
 */
/**
 * @swagger
 * /api/exam/papers:
 *   get:
 *     summary: Retrieve papers
 *     tags: [Exams]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/papers', async (req, res) => {
  try {
    const publishedPapers = await db.select().from(papers).where(eq(papers.status, 'published'));

    res.json({
      success: true,
      data: publishedPapers,
    });
  } catch (error) {
    console.error('Error fetching papers:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch papers',
    });
  }
});

/**
 * Get paper with questions (authenticated students only)
 * @route GET /api/exam/papers/:id
 */
/**
 * @swagger
 * /api/exam/papers/{id}:
 *   get:
 *     summary: Retrieve papers
 *     tags: [Exams]
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

router.get('/papers/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const [paper] = await db
      .select()
      .from(papers)
      .where(and(eq(papers.id, id), eq(papers.status, 'published')))
      .limit(1);

    if (!paper) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Paper not found',
      });
    }

    // Get questions for the paper
    const paperQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.paperId, id))
      .orderBy(questions.questionNumber);

    res.json({
      success: true,
      data: {
        ...paper,
        questions: paperQuestions,
      },
    });
  } catch (error) {
    console.error('Error fetching paper:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch paper',
    });
  }
});

/**
 * Get all published mock tests
 * @route GET /api/exam/mock-tests
 */
/**
 * @swagger
 * /api/exam/mock-tests:
 *   get:
 *     summary: Retrieve mock-tests
 *     tags: [Exams]
 *     responses:
 *       200:
 *         description: Success
 *       500:
 *         description: Server error
 */

router.get('/mock-tests', async (req, res) => {
  try {
    const publishedMockTests = await db
      .select()
      .from(mockTests)
      .where(eq(mockTests.status, 'published'));

    res.json({
      success: true,
      data: publishedMockTests,
    });
  } catch (error) {
    console.error('Error fetching mock tests:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch mock tests',
    });
  }
});

/**
 * Get mock test with questions (authenticated students only)
 * @route GET /api/exam/mock-tests/:id
 */
/**
 * @swagger
 * /api/exam/mock-tests/{id}:
 *   get:
 *     summary: Retrieve mock-tests
 *     tags: [Exams]
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

router.get('/mock-tests/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const [mockTest] = await db
      .select()
      .from(mockTests)
      .where(and(eq(mockTests.id, id), eq(mockTests.status, 'published')))
      .limit(1);

    if (!mockTest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Mock test not found',
      });
    }

    // Get questions for the mock test
    const testQuestions = await db
      .select({
        question: questions,
        order: mockTestQuestions.questionOrder,
      })
      .from(mockTestQuestions)
      .innerJoin(questions, eq(mockTestQuestions.questionId, questions.id))
      .where(eq(mockTestQuestions.mockTestId, id))
      .orderBy(mockTestQuestions.questionOrder);

    res.json({
      success: true,
      data: {
        ...mockTest,
        questions: testQuestions.map((q) => q.question),
      },
    });
  } catch (error) {
    console.error('Error fetching mock test:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch mock test',
    });
  }
});

export default router;
