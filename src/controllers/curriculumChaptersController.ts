import { Request, Response } from 'express';
import { db } from '../config/database';
import { curriculumChapters, subjects, questions } from '../models/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { chapterMappingService } from '../services/chapterMappingService';

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get all curriculum chapters with optional filters
 * GET /api/admin/curriculum-chapters
 * Query params: subject, grade, status
 */
export const getAllChapters = async (req: Request, res: Response) => {
  try {
    const { subject, grade, status } = req.query;

    let query = db
      .select({
        chapter: curriculumChapters,
        subject: subjects,
      })
      .from(curriculumChapters)
      .leftJoin(subjects, eq(curriculumChapters.subjectId, subjects.id))
      .orderBy(asc(curriculumChapters.displayOrder), asc(curriculumChapters.chapterNumber));

    // Apply filters
    const conditions: any[] = [];

    if (subject) {
      conditions.push(eq(subjects.code, subject as string));
    }

    if (grade) {
      conditions.push(eq(curriculumChapters.gradeLevel, grade as '11' | '12'));
    }

    if (status) {
      conditions.push(eq(curriculumChapters.status, status as any));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query;

    // Transform result to include subject info
    const chapters = result.map((row) => ({
      ...row.chapter,
      subject: row.subject,
    }));

    res.json({
      success: true,
      data: chapters,
      count: chapters.length,
    });
  } catch (error: any) {
    console.error('Error fetching chapters:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chapters',
      error: error.message,
    });
  }
};

/**
 * Get a single chapter by ID
 * GET /api/admin/curriculum-chapters/:id
 */
export const getChapterById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db
      .select({
        chapter: curriculumChapters,
        subject: subjects,
      })
      .from(curriculumChapters)
      .leftJoin(subjects, eq(curriculumChapters.subjectId, subjects.id))
      .where(eq(curriculumChapters.id, id))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found',
      });
    }

    const chapter = {
      ...result[0].chapter,
      subject: result[0].subject,
    };

    res.json({
      success: true,
      data: chapter,
    });
  } catch (error: any) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chapter',
      error: error.message,
    });
  }
};

/**
 * Create a new chapter
 * POST /api/admin/curriculum-chapters
 */
export const createChapter = async (req: Request, res: Response) => {
  try {
    const chapterData = req.body;

    // Validate required fields
    if (
      !chapterData.subjectId ||
      !chapterData.name ||
      !chapterData.gradeLevel ||
      !chapterData.chapterNumber
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: subjectId, name, gradeLevel, chapterNumber',
      });
    }

    // Create slug from name if not provided
    if (!chapterData.slug) {
      chapterData.slug = chapterData.name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }

    const [newChapter] = await db.insert(curriculumChapters).values(chapterData).returning();

    res.status(201).json({
      success: true,
      message: 'Chapter created successfully',
      data: newChapter,
    });
  } catch (error: any) {
    console.error('Error creating chapter:', error);

    // Check for unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'A chapter with this number already exists for this subject and grade',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create chapter',
      error: error.message,
    });
  }
};

/**
 * Update a chapter
 * PATCH /api/admin/curriculum-chapters/:id
 */
export const updateChapter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Add updated timestamp
    updateData.updatedAt = new Date();

    const [updatedChapter] = await db
      .update(curriculumChapters)
      .set(updateData)
      .where(eq(curriculumChapters.id, id))
      .returning();

    if (!updatedChapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found',
      });
    }

    res.json({
      success: true,
      message: 'Chapter updated successfully',
      data: updatedChapter,
    });
  } catch (error: any) {
    console.error('Error updating chapter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update chapter',
      error: error.message,
    });
  }
};

/**
 * Delete a chapter (only if no questions mapped)
 * DELETE /api/admin/curriculum-chapters/:id
 */
export const deleteChapter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if chapter has questions
    const questionCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(eq(questions.curriculumChapterId, id));

    if (questionCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete chapter with ${questionCount[0].count} mapped questions`,
      });
    }

    await db.delete(curriculumChapters).where(eq(curriculumChapters.id, id));

    res.json({
      success: true,
      message: 'Chapter deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting chapter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete chapter',
      error: error.message,
    });
  }
};

// ============================================================================
// QUESTION MAPPING
// ============================================================================

/**
 * Get all questions for a chapter
 * GET /api/admin/curriculum-chapters/:id/questions
 */
export const getChapterQuestions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const chapterQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.curriculumChapterId, id))
      .limit(Number(limit))
      .offset(offset);

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(eq(questions.curriculumChapterId, id));

    res.json({
      success: true,
      data: chapterQuestions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching chapter questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chapter questions',
      error: error.message,
    });
  }
};

/**
 * Map a question to a chapter
 * POST /api/admin/curriculum-chapters/:id/map-question
 * Body: { questionId: string }
 */
export const mapQuestionToChapter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: 'questionId is required',
      });
    }

    await chapterMappingService.manualMapQuestion(questionId, id);

    // Update chapter statistics
    await chapterMappingService.updateChapterStatistics(id);

    res.json({
      success: true,
      message: 'Question mapped to chapter successfully',
    });
  } catch (error: any) {
    console.error('Error mapping question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to map question',
      error: error.message,
    });
  }
};

/**
 * Unmap a question from a chapter
 * POST /api/admin/curriculum-chapters/:id/unmap-question
 * Body: { questionId: string }
 */
export const unmapQuestionFromChapter = async (req: Request, res: Response) => {
  try {
    const { questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: 'questionId is required',
      });
    }

    await chapterMappingService.unmapQuestion(questionId);

    res.json({
      success: true,
      message: 'Question unmapped from chapter successfully',
    });
  } catch (error: any) {
    console.error('Error unmapping question:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unmap question',
      error: error.message,
    });
  }
};

/**
 * Run auto-mapping for all questions
 * POST /api/admin/curriculum-chapters/auto-map
 * Body: { threshold?: number, subjectCode?: string, dryRun?: boolean }
 */
export const autoMapQuestions = async (req: Request, res: Response) => {
  try {
    const { threshold = 0.85, subjectCode, dryRun = false } = req.body;

    const result = await chapterMappingService.autoMapQuestions(threshold, subjectCode, dryRun);

    if (!dryRun) {
      // Update all chapter statistics
      await chapterMappingService.updateChapterStatistics();
    }

    res.json({
      success: true,
      message: dryRun ? 'Dry run completed' : 'Auto-mapping completed',
      data: result,
    });
  } catch (error: any) {
    console.error('Error auto-mapping questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-map questions',
      error: error.message,
    });
  }
};

/**
 * Get uncertain mappings
 * GET /api/admin/curriculum-chapters/mapping/uncertain
 */
export const getUncertainMappings = async (req: Request, res: Response) => {
  try {
    const { minScore = 0.5, maxScore = 0.85, limit = 100 } = req.query;

    const uncertainMappings = await chapterMappingService.getUncertainMappings(
      Number(minScore),
      Number(maxScore),
      Number(limit)
    );

    res.json({
      success: true,
      data: uncertainMappings,
      count: uncertainMappings.length,
    });
  } catch (error: any) {
    console.error('Error fetching uncertain mappings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch uncertain mappings',
      error: error.message,
    });
  }
};

/**
 * Generate mapping report
 * GET /api/admin/curriculum-chapters/mapping/report
 */
export const getMappingReport = async (req: Request, res: Response) => {
  try {
    const report = await chapterMappingService.generateMappingReport();

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error('Error generating mapping report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate mapping report',
      error: error.message,
    });
  }
};

// ============================================================================
// STATUS MANAGEMENT
// ============================================================================

/**
 * Publish a chapter
 * POST /api/admin/curriculum-chapters/:id/publish
 */
export const publishChapter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [updatedChapter] = await db
      .update(curriculumChapters)
      .set({
        isPublished: true,
        status: 'active',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(curriculumChapters.id, id))
      .returning();

    if (!updatedChapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found',
      });
    }

    res.json({
      success: true,
      message: 'Chapter published successfully',
      data: updatedChapter,
    });
  } catch (error: any) {
    console.error('Error publishing chapter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish chapter',
      error: error.message,
    });
  }
};

/**
 * Archive a chapter
 * POST /api/admin/curriculum-chapters/:id/archive
 */
export const archiveChapter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [updatedChapter] = await db
      .update(curriculumChapters)
      .set({
        status: 'archived',
        isPublished: false,
        updatedAt: new Date(),
      })
      .where(eq(curriculumChapters.id, id))
      .returning();

    if (!updatedChapter) {
      return res.status(404).json({
        success: false,
        message: 'Chapter not found',
      });
    }

    res.json({
      success: true,
      message: 'Chapter archived successfully',
      data: updatedChapter,
    });
  } catch (error: any) {
    console.error('Error archiving chapter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive chapter',
      error: error.message,
    });
  }
};

/**
 * Refresh chapter statistics
 * POST /api/admin/curriculum-chapters/:id/refresh-stats
 */
export const refreshChapterStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await chapterMappingService.updateChapterStatistics(id);

    // Get updated chapter
    const [updatedChapter] = await db
      .select()
      .from(curriculumChapters)
      .where(eq(curriculumChapters.id, id));

    res.json({
      success: true,
      message: 'Chapter statistics refreshed successfully',
      data: updatedChapter,
    });
  } catch (error: any) {
    console.error('Error refreshing chapter stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh chapter statistics',
      error: error.message,
    });
  }
};
