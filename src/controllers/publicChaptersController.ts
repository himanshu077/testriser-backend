import { Request, Response } from 'express';
import { db } from '../config/database';
import { curriculumChapters, subjects } from '../models/schema';
import { eq, and, asc } from 'drizzle-orm';
import { cacheService } from '../services/cacheService';

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

const CACHE_TTL = 300; // 5 minutes in seconds

/**
 * Get chapters filtered by subject and grade level
 * Public endpoint - returns only active/published chapters
 */
export async function getPublicChapters(req: Request, res: Response) {
  try {
    const { subject, grade } = req.query;

    if (!subject) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Subject code is required',
      });
    }

    // Check cache first
    const cacheKey = `chapters:${subject}:${grade || 'all'}`;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: cachedData,
        cached: true,
      });
    }

    // Build filter conditions
    const conditions = [
      eq(subjects.code, subject as string),
      eq(curriculumChapters.isActive, true),
      eq(curriculumChapters.isPublished, true),
    ];

    // Add grade filter if provided
    if (grade) {
      conditions.push(eq(curriculumChapters.gradeLevel, grade as '11' | '12'));
    }

    // Build query with filters
    const chapters = await db
      .select({
        id: curriculumChapters.id,
        name: curriculumChapters.name,
        slug: curriculumChapters.slug,
        description: curriculumChapters.description,
        chapterNumber: curriculumChapters.chapterNumber,
        gradeLevel: curriculumChapters.gradeLevel,
        totalQuestions: curriculumChapters.totalQuestions,
        displayOrder: curriculumChapters.displayOrder,
        subjectId: curriculumChapters.subjectId,
        subject: subjects,
      })
      .from(curriculumChapters)
      .leftJoin(subjects, eq(curriculumChapters.subjectId, subjects.id))
      .where(and(...conditions))
      .orderBy(asc(curriculumChapters.displayOrder), asc(curriculumChapters.chapterNumber));

    // Group by grade level
    const grouped = {
      class11: chapters
        .filter((c) => c.gradeLevel === '11')
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          chapterNumber: c.chapterNumber,
          totalQuestions: c.totalQuestions,
          displayOrder: c.displayOrder,
        })),
      class12: chapters
        .filter((c) => c.gradeLevel === '12')
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          chapterNumber: c.chapterNumber,
          totalQuestions: c.totalQuestions,
          displayOrder: c.displayOrder,
        })),
    };

    // Cache the result
    await cacheService.set(cacheKey, grouped, CACHE_TTL);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: grouped,
    });
  } catch (error: any) {
    console.error('Get public chapters error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch chapters',
      message: error.message,
    });
  }
}

/**
 * Get all active subjects (for AI bot subject selection)
 */
export async function getActiveSubjects(req: Request, res: Response) {
  try {
    // Check cache first
    const cacheKey = 'subjects:active';
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: cachedData,
        cached: true,
      });
    }

    const activeSubjects = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
        description: subjects.description,
        icon: subjects.icon,
        displayOrder: subjects.displayOrder,
      })
      .from(subjects)
      .where(eq(subjects.isActive, true))
      .orderBy(asc(subjects.displayOrder), asc(subjects.name));

    // Cache the result
    await cacheService.set(cacheKey, activeSubjects, CACHE_TTL);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: activeSubjects,
    });
  } catch (error: any) {
    console.error('Get active subjects error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      success: false,
      error: 'Failed to fetch subjects',
      message: error.message,
    });
  }
}
