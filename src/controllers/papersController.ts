import { Request, Response } from 'express';
import { db } from '../config/database';
import { papers, questions } from '../models/schema';
import { eq, desc, isNotNull, sql, and } from 'drizzle-orm';
import { HTTP_STATUS } from '../config/constants';

/**
 * Get all papers (with optional filters)
 * @route GET /api/admin/papers
 */
export async function getAllPapers(req: Request, res: Response) {
  try {
    const allPapers = await db.select().from(papers).orderBy(desc(papers.year));

    res.json({
      success: true,
      data: allPapers,
    });
  } catch (error) {
    console.error('Error fetching papers:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch papers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get single paper by ID
 * @route GET /api/admin/papers/:id
 */
export async function getPaperById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [paper] = await db.select().from(papers).where(eq(papers.id, id)).limit(1);

    if (!paper) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Paper not found',
      });
    }

    res.json({
      success: true,
      data: paper,
    });
  } catch (error) {
    console.error('Error fetching paper:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch paper',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create a new paper
 * @route POST /api/admin/papers
 */
export async function createPaper(req: Request, res: Response) {
  try {
    const { title, description, year, duration, totalMarks, totalQuestions, status } = req.body;

    if (!title || !year || !duration || !totalMarks || !totalQuestions) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Missing required fields',
        required: ['title', 'year', 'duration', 'totalMarks', 'totalQuestions'],
      });
    }

    const [newPaper] = await db
      .insert(papers)
      .values({
        title,
        description,
        year,
        duration,
        totalMarks,
        totalQuestions,
        status: status || 'draft',
      })
      .returning();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Paper created successfully',
      data: newPaper,
    });
  } catch (error) {
    console.error('Error creating paper:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to create paper',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update paper
 * @route PUT /api/admin/papers/:id
 */
export async function updatePaper(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const [updatedPaper] = await db
      .update(papers)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(papers.id, id))
      .returning();

    if (!updatedPaper) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Paper not found',
      });
    }

    res.json({
      success: true,
      message: 'Paper updated successfully',
      data: updatedPaper,
    });
  } catch (error) {
    console.error('Error updating paper:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to update paper',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete paper
 * @route DELETE /api/admin/papers/:id
 */
export async function deletePaper(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [deletedPaper] = await db.delete(papers).where(eq(papers.id, id)).returning();

    if (!deletedPaper) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Paper not found',
      });
    }

    res.json({
      success: true,
      message: 'Paper deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting paper:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to delete paper',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get questions for a paper
 * @route GET /api/admin/papers/:id/questions
 */
export async function getPaperQuestions(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const paperQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.paperId, id))
      .orderBy(questions.questionNumber);

    res.json({
      success: true,
      data: paperQuestions,
    });
  } catch (error) {
    console.error('Error fetching paper questions:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch paper questions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Publish paper (make it available to students)
 * @route POST /api/admin/papers/:id/publish
 */
export async function publishPaper(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [publishedPaper] = await db
      .update(papers)
      .set({
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(papers.id, id))
      .returning();

    if (!publishedPaper) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Paper not found',
      });
    }

    res.json({
      success: true,
      message: 'Paper published successfully',
      data: publishedPaper,
    });
  } catch (error) {
    console.error('Error publishing paper:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to publish paper',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get PYQ papers aggregated from questions by examYear
 * @route GET /api/admin/papers/pyq
 */
export async function getPYQPapers(req: Request, res: Response) {
  try {
    // Get questions grouped by examYear and examType with counts and subject breakdown
    const pyqStats = await db
      .select({
        examYear: questions.examYear,
        examType: questions.examType,
        totalQuestions: sql<number>`count(*)::int`,
        physicsCount: sql<number>`count(*) filter (where ${questions.subject} = 'physics')::int`,
        chemistryCount: sql<number>`count(*) filter (where ${questions.subject} = 'chemistry')::int`,
        botanyCount: sql<number>`count(*) filter (where ${questions.subject} = 'botany')::int`,
        zoologyCount: sql<number>`count(*) filter (where ${questions.subject} = 'zoology')::int`,
        biologyCount: sql<number>`count(*) filter (where ${questions.subject} IN ('botany', 'zoology', 'biology'))::int`,
        withDiagramCount: sql<number>`count(*) filter (where ${questions.hasDiagram} = true)::int`,
        withImageCount: sql<number>`count(*) filter (where ${questions.questionImage} is not null)::int`,
      })
      .from(questions)
      .where(isNotNull(questions.examYear))
      .groupBy(questions.examYear, questions.examType)
      .orderBy(sql`${questions.examYear} DESC`);

    // Transform to paper-like structure
    const pyqPapers = pyqStats.map((stat) => ({
      id: `pyq-${stat.examYear}-${stat.examType?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`,
      year: stat.examYear,
      examType: stat.examType || 'NEET',
      title: `${stat.examType || 'NEET'} ${stat.examYear}`,
      totalQuestions: stat.totalQuestions,
      subjectBreakdown: {
        physics: stat.physicsCount,
        chemistry: stat.chemistryCount,
        botany: stat.botanyCount,
        zoology: stat.zoologyCount,
        biology: stat.biologyCount,
      },
      withDiagram: stat.withDiagramCount,
      withImage: stat.withImageCount,
      // NEET standard values
      duration: 200, // 3 hours 20 minutes
      totalMarks: stat.totalQuestions * 4, // Assuming +4 per question
      status: stat.totalQuestions >= 180 ? 'complete' : 'partial',
    }));

    // Calculate totals
    const totals = {
      totalPapers: pyqPapers.length,
      totalQuestions: pyqPapers.reduce((sum, p) => sum + p.totalQuestions, 0),
      completePapers: pyqPapers.filter((p) => p.status === 'complete').length,
      partialPapers: pyqPapers.filter((p) => p.status === 'partial').length,
      yearRange:
        pyqPapers.length > 0
          ? {
              oldest: Math.min(...pyqPapers.map((p) => p.year!)),
              newest: Math.max(...pyqPapers.map((p) => p.year!)),
            }
          : null,
    };

    res.json({
      success: true,
      data: {
        papers: pyqPapers,
        totals,
      },
    });
  } catch (error) {
    console.error('Error fetching PYQ papers:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch PYQ papers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get questions for a specific PYQ paper (by year and examType)
 * @route GET /api/admin/papers/pyq/:year/questions
 */
export async function getPYQPaperQuestions(req: Request, res: Response) {
  try {
    const { year } = req.params;
    const { examType = 'NEET', subject } = req.query;

    const conditions = [eq(questions.examYear, parseInt(year))];

    if (examType) {
      conditions.push(eq(questions.examType, examType as string));
    }

    if (subject && subject !== 'all') {
      conditions.push(eq(questions.subject, subject as string));
    }

    const pyqQuestions = await db
      .select()
      .from(questions)
      .where(and(...conditions))
      .orderBy(questions.questionNumber);

    res.json({
      success: true,
      data: pyqQuestions,
      pagination: {
        total: pyqQuestions.length,
      },
    });
  } catch (error) {
    console.error('Error fetching PYQ paper questions:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch PYQ paper questions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
