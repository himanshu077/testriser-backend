import { Request, Response } from 'express';
import { db } from '../config/database';
import { mockTests, mockTestQuestions, questions } from '../models/schema';
import { eq, desc, sql, count } from 'drizzle-orm';
import { HTTP_STATUS } from '../config/constants';
import * as mockTestGenerator from '../services/mockTestGeneratorService';

/**
 * Get all mock tests with question counts
 * @route GET /api/admin/mock-tests
 */
export async function getAllMockTests(req: Request, res: Response) {
  try {
    // Get all mock tests
    const allMockTests = await db.select().from(mockTests).orderBy(desc(mockTests.createdAt));

    // Get question counts for each mock test
    const testsWithCounts = await Promise.all(
      allMockTests.map(async (test) => {
        const [{ value: questionCount }] = await db
          .select({ value: count() })
          .from(mockTestQuestions)
          .where(eq(mockTestQuestions.mockTestId, test.id));

        return {
          ...test,
          actualQuestionCount: questionCount || 0,
        };
      })
    );

    res.json({
      success: true,
      data: testsWithCounts,
    });
  } catch (error) {
    console.error('Error fetching mock tests:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch mock tests',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get mock test statistics (for dashboard/creation)
 * @route GET /api/admin/mock-tests/stats
 */
export async function getMockTestStats(req: Request, res: Response) {
  try {
    // Get question availability stats
    const questionStats = await mockTestGenerator.getQuestionStats();

    // Get mock test counts by type and status
    const testsByType = await db
      .select({
        testType: mockTests.testType,
        status: mockTests.status,
        count: sql<number>`count(*)::int`,
      })
      .from(mockTests)
      .groupBy(mockTests.testType, mockTests.status);

    const stats = {
      questions: questionStats,
      mockTests: {
        total: testsByType.reduce((sum, t) => sum + t.count, 0),
        byType: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
      },
    };

    for (const test of testsByType) {
      stats.mockTests.byType[test.testType] =
        (stats.mockTests.byType[test.testType] || 0) + test.count;
      stats.mockTests.byStatus[test.status] =
        (stats.mockTests.byStatus[test.status] || 0) + test.count;
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching mock test stats:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch mock test stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get mock test by ID with questions
 * @route GET /api/admin/mock-tests/:id
 */
export async function getMockTestById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [mockTest] = await db.select().from(mockTests).where(eq(mockTests.id, id)).limit(1);

    if (!mockTest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Mock test not found',
      });
    }

    // Get associated questions
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
        questions: testQuestions,
      },
    });
  } catch (error) {
    console.error('Error fetching mock test:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch mock test',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create a new mock test
 * @route POST /api/admin/mock-tests
 */
export async function createMockTest(req: Request, res: Response) {
  try {
    const { title, description, testType, subject, duration, totalMarks, totalQuestions, status } =
      req.body;

    if (!title || !testType || !duration || !totalMarks || !totalQuestions) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Missing required fields',
        required: ['title', 'testType', 'duration', 'totalMarks', 'totalQuestions'],
      });
    }

    const [newMockTest] = await db
      .insert(mockTests)
      .values({
        title,
        description,
        testType,
        subject,
        duration,
        totalMarks,
        totalQuestions,
        status: status || 'draft',
      })
      .returning();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Mock test created successfully',
      data: newMockTest,
    });
  } catch (error) {
    console.error('Error creating mock test:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to create mock test',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Add questions to mock test
 * @route POST /api/admin/mock-tests/:id/questions
 */
export async function addQuestionsToMockTest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { questionIds } = req.body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid question IDs',
        message: 'Expected an array of question IDs',
      });
    }

    // Create mock test question associations
    const mockTestQuestionsData = questionIds.map((questionId, index) => ({
      mockTestId: id,
      questionId,
      questionOrder: index + 1,
    }));

    await db.insert(mockTestQuestions).values(mockTestQuestionsData);

    res.json({
      success: true,
      message: `${questionIds.length} questions added to mock test`,
    });
  } catch (error) {
    console.error('Error adding questions to mock test:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to add questions to mock test',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update mock test
 * @route PUT /api/admin/mock-tests/:id
 */
export async function updateMockTest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const [updatedMockTest] = await db
      .update(mockTests)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(mockTests.id, id))
      .returning();

    if (!updatedMockTest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Mock test not found',
      });
    }

    res.json({
      success: true,
      message: 'Mock test updated successfully',
      data: updatedMockTest,
    });
  } catch (error) {
    console.error('Error updating mock test:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to update mock test',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete mock test
 * @route DELETE /api/admin/mock-tests/:id
 */
export async function deleteMockTest(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [deletedMockTest] = await db.delete(mockTests).where(eq(mockTests.id, id)).returning();

    if (!deletedMockTest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Mock test not found',
      });
    }

    res.json({
      success: true,
      message: 'Mock test deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting mock test:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to delete mock test',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Publish mock test
 * @route POST /api/admin/mock-tests/:id/publish
 */
export async function publishMockTest(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [publishedMockTest] = await db
      .update(mockTests)
      .set({
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mockTests.id, id))
      .returning();

    if (!publishedMockTest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Mock test not found',
      });
    }

    res.json({
      success: true,
      message: 'Mock test published successfully',
      data: publishedMockTest,
    });
  } catch (error) {
    console.error('Error publishing mock test:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to publish mock test',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Auto-generate mock test with shuffled questions
 * @route POST /api/admin/mock-tests/generate
 */
export async function generateMockTest(req: Request, res: Response) {
  try {
    const {
      title,
      description,
      testType,
      subject,
      preferPYQ = false,
      excludeUsedQuestions = true,
    } = req.body;

    if (!title || !testType) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Missing required fields',
        required: ['title', 'testType'],
      });
    }

    // Get questions to exclude (from other tests)
    const excludeIds = excludeUsedQuestions ? await mockTestGenerator.getUsedQuestionIds() : [];

    let generatedTest;

    // Generate based on test type
    switch (testType) {
      case 'full_test':
        generatedTest = await mockTestGenerator.generateFullTest(excludeIds, preferPYQ);
        break;

      case 'subject_wise':
        if (!subject) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Subject is required for subject-wise tests',
          });
        }
        generatedTest = await mockTestGenerator.generateSubjectWiseTest(
          subject,
          excludeIds,
          preferPYQ
        );
        break;

      default:
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Invalid test type',
          validTypes: ['full_test', 'subject_wise'],
        });
    }

    if (generatedTest.questionIds.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Not enough questions available',
        message: 'There are not enough questions in the database to generate this test type.',
      });
    }

    // Create the mock test
    const [newMockTest] = await db
      .insert(mockTests)
      .values({
        title,
        description,
        testType,
        subject: testType === 'subject_wise' ? subject : null,
        duration: generatedTest.duration,
        totalMarks: generatedTest.totalMarks,
        totalQuestions: generatedTest.totalQuestions,
        status: 'draft',
      })
      .returning();

    // Add questions to the mock test
    const mockTestQuestionsData = generatedTest.questionIds.map((questionId, index) => ({
      mockTestId: newMockTest.id,
      questionId,
      questionOrder: index + 1,
    }));

    await db.insert(mockTestQuestions).values(mockTestQuestionsData);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Mock test generated successfully',
      data: {
        mockTest: newMockTest,
        distribution: generatedTest.distribution,
        questionsAdded: generatedTest.questionIds.length,
      },
    });
  } catch (error) {
    console.error('Error generating mock test:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to generate mock test',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Regenerate questions for an existing mock test
 * @route POST /api/admin/mock-tests/:id/regenerate
 */
export async function regenerateMockTestQuestions(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { preferPYQ = false, excludeUsedQuestions = true } = req.body;

    // Get existing mock test
    const [mockTest] = await db.select().from(mockTests).where(eq(mockTests.id, id)).limit(1);

    if (!mockTest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Mock test not found',
      });
    }

    // Delete existing questions
    await db.delete(mockTestQuestions).where(eq(mockTestQuestions.mockTestId, id));

    // Get questions to exclude (from other tests, excluding current)
    const excludeIds = excludeUsedQuestions ? await mockTestGenerator.getUsedQuestionIds(id) : [];

    let generatedTest;

    // Generate based on test type
    if (mockTest.testType === 'full_test') {
      generatedTest = await mockTestGenerator.generateFullTest(excludeIds, preferPYQ);
    } else if (mockTest.testType === 'subject_wise' && mockTest.subject) {
      generatedTest = await mockTestGenerator.generateSubjectWiseTest(
        mockTest.subject,
        excludeIds,
        preferPYQ
      );
    } else {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Cannot regenerate questions for this test type',
      });
    }

    // Add new questions
    const mockTestQuestionsData = generatedTest.questionIds.map((questionId, index) => ({
      mockTestId: id,
      questionId,
      questionOrder: index + 1,
    }));

    await db.insert(mockTestQuestions).values(mockTestQuestionsData);

    // Update mock test with new counts
    await db
      .update(mockTests)
      .set({
        totalQuestions: generatedTest.totalQuestions,
        totalMarks: generatedTest.totalMarks,
        duration: generatedTest.duration,
        updatedAt: new Date(),
      })
      .where(eq(mockTests.id, id));

    res.json({
      success: true,
      message: 'Mock test questions regenerated successfully',
      data: {
        distribution: generatedTest.distribution,
        questionsAdded: generatedTest.questionIds.length,
      },
    });
  } catch (error) {
    console.error('Error regenerating mock test questions:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to regenerate mock test questions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Clear questions from a mock test
 * @route DELETE /api/admin/mock-tests/:id/questions
 */
export async function clearMockTestQuestions(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if mock test exists
    const [mockTest] = await db.select().from(mockTests).where(eq(mockTests.id, id)).limit(1);

    if (!mockTest) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Mock test not found',
      });
    }

    // Delete all questions
    await db.delete(mockTestQuestions).where(eq(mockTestQuestions.mockTestId, id));

    res.json({
      success: true,
      message: 'Mock test questions cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing mock test questions:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to clear mock test questions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
