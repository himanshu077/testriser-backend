import { Request, Response } from 'express';
import { db } from '../config/database';
import { subjects, questions } from '../models/schema';
import { eq, count } from 'drizzle-orm';
import { HTTP_STATUS } from '../config/constants';

/**
 * Get all active subjects (for public/student use)
 * GET /api/subjects
 */
export async function getActiveSubjects(req: Request, res: Response) {
  try {
    const activeSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.isActive, true))
      .orderBy(subjects.displayOrder, subjects.name);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: activeSubjects,
    });
  } catch (error: any) {
    console.error('Get active subjects error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Get all subjects including inactive (for admin use)
 * GET /api/admin/subjects
 */
export async function getAllSubjects(req: Request, res: Response) {
  try {
    const allSubjects = await db
      .select()
      .from(subjects)
      .orderBy(subjects.displayOrder, subjects.name);

    // Get question count for each subject
    const subjectsWithCounts = await Promise.all(
      allSubjects.map(async (subject) => {
        const [{ value: questionCount }] = await db
          .select({ value: count() })
          .from(questions)
          .where(eq(questions.subject, subject.code));

        return {
          ...subject,
          questionCount: questionCount || 0,
        };
      })
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: subjectsWithCounts,
    });
  } catch (error: any) {
    console.error('Get all subjects error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Get single subject by ID
 * GET /api/admin/subjects/:id
 */
export async function getSubjectById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [subject] = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);

    if (!subject) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Subject not found',
      });
    }

    // Get question count for this subject
    const [{ value: questionCount }] = await db
      .select({ value: count() })
      .from(questions)
      .where(eq(questions.subject, subject.code));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ...subject,
        questionCount: questionCount || 0,
      },
    });
  } catch (error: any) {
    console.error('Get subject by ID error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Create new subject
 * POST /api/admin/subjects
 */
export async function createSubject(req: Request, res: Response) {
  try {
    const { name, code, description, icon, displayOrder } = req.body;

    if (!name || !code) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Name and code are required',
      });
    }

    // Validate code format (lowercase, no spaces, alphanumeric with underscores/hyphens)
    const codeRegex = /^[a-z0-9_-]+$/;
    if (!codeRegex.test(code)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Code must be lowercase alphanumeric with underscores or hyphens only',
      });
    }

    // Check if subject with same name or code already exists
    const existingSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.code, code))
      .limit(1);

    if (existingSubjects.length > 0) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        error: 'Conflict',
        message: 'Subject with this code already exists',
      });
    }

    // Create subject
    const [subject] = await db
      .insert(subjects)
      .values({
        name,
        code: code.toLowerCase(),
        description: description || null,
        icon: icon || null,
        displayOrder: displayOrder !== undefined ? displayOrder : 0,
        isActive: true,
      })
      .returning();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Subject created successfully',
      data: subject,
    });
  } catch (error: any) {
    console.error('Create subject error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Update subject
 * PATCH /api/admin/subjects/:id
 */
export async function updateSubject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, code, description, icon, displayOrder, isActive } = req.body;

    // Check if subject exists
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);

    if (!subject) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Subject not found',
      });
    }

    // If code is being changed, validate it
    if (code && code !== subject.code) {
      const codeRegex = /^[a-z0-9_-]+$/;
      if (!codeRegex.test(code)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          message: 'Code must be lowercase alphanumeric with underscores or hyphens only',
        });
      }

      // Check if new code already exists
      const existingSubjects = await db
        .select()
        .from(subjects)
        .where(eq(subjects.code, code.toLowerCase()))
        .limit(1);

      if (existingSubjects.length > 0 && existingSubjects[0].id !== id) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          error: 'Conflict',
          message: 'Subject with this code already exists',
        });
      }
    }

    // Update subject
    const [updatedSubject] = await db
      .update(subjects)
      .set({
        name: name || subject.name,
        code: code ? code.toLowerCase() : subject.code,
        description: description !== undefined ? description : subject.description,
        icon: icon !== undefined ? icon : subject.icon,
        displayOrder: displayOrder !== undefined ? displayOrder : subject.displayOrder,
        isActive: isActive !== undefined ? isActive : subject.isActive,
        updatedAt: new Date(),
      })
      .where(eq(subjects.id, id))
      .returning();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Subject updated successfully',
      data: updatedSubject,
    });
  } catch (error: any) {
    console.error('Update subject error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Delete subject (only if no questions use it)
 * DELETE /api/admin/subjects/:id
 */
export async function deleteSubject(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if subject exists
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);

    if (!subject) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Subject not found',
      });
    }

    // Check if any questions use this subject
    const [{ value: questionCount }] = await db
      .select({ value: count() })
      .from(questions)
      .where(eq(questions.subject, subject.code));

    if (questionCount && questionCount > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: `Cannot delete subject. ${questionCount} questions are using this subject. Please deactivate instead.`,
      });
    }

    // Delete subject
    await db.delete(subjects).where(eq(subjects.id, id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Subject deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete subject error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Reorder subjects (update display order)
 * PUT /api/admin/subjects/reorder
 */
export async function reorderSubjects(req: Request, res: Response) {
  try {
    const { subjectOrders } = req.body;

    if (!Array.isArray(subjectOrders) || subjectOrders.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'subjectOrders must be a non-empty array of {id, displayOrder}',
      });
    }

    // Update each subject's display order
    await Promise.all(
      subjectOrders.map(async ({ id, displayOrder }) => {
        await db
          .update(subjects)
          .set({
            displayOrder,
            updatedAt: new Date(),
          })
          .where(eq(subjects.id, id));
      })
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Subjects reordered successfully',
    });
  } catch (error: any) {
    console.error('Reorder subjects error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
