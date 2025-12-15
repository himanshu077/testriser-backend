import { Request, Response } from 'express';
import { db } from '../config/database';
import { books, questions } from '../models/schema';
import { eq, desc, and, count } from 'drizzle-orm';
import { HTTP_STATUS } from '../config/constants';
import { VisionExtractionService } from '../services/visionExtractionService';
import fs from 'fs';

/**
 * Upload PDF book and start processing
 * POST /api/admin/books/upload
 */
export async function uploadBook(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'No PDF file uploaded',
      });
    }

    const { title, description, subject, bookType, pyqType } = req.body;

    if (!title) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Book title is required',
      });
    }

    // Subject validation is optional - subjects are now dynamic
    // Subject codes should match entries in the subjects table

    // Validate bookType
    if (bookType && !['pyq', 'standard'].includes(bookType)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'Invalid book type. Must be pyq or standard',
      });
    }

    // Validate pyqType (only required if bookType is 'pyq')
    if (bookType === 'pyq') {
      if (!pyqType) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          message: 'PYQ type is required when book type is PYQ',
        });
      }
      if (!['subject_wise', 'full_length'].includes(pyqType)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Bad Request',
          message: 'Invalid PYQ type. Must be subject_wise or full_length',
        });
      }
    }

    // If bookType is 'standard', pyqType should not be set
    const finalPyqType = bookType === 'pyq' ? pyqType : null;

    // Create book record
    const [book] = await db
      .insert(books)
      .values({
        title,
        description: description || null,
        filename: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        subject: subject || null,
        bookType: (bookType as 'pyq' | 'standard') || 'standard',
        pyqType: finalPyqType as 'subject_wise' | 'full_length' | null,
        uploadStatus: 'pending',
        uploadedBy: userId,
      })
      .returning();

    // Start async processing
    VisionExtractionService.processBookAsync(book.id);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message:
        'Book uploaded successfully. Processing will start shortly. Please check back in 5 minutes.',
      book: {
        id: book.id,
        title: book.title,
        filename: book.filename,
        fileSize: book.fileSize,
        subject: book.subject,
        bookType: book.bookType,
        pyqType: book.pyqType,
        uploadStatus: book.uploadStatus,
        createdAt: book.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Upload book error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Get all books with filtering and pagination
 * GET /api/admin/books
 */
export async function getBooks(req: Request, res: Response) {
  try {
    const { status, subject, page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build query conditions
    const conditions = [];
    if (status) {
      conditions.push(eq(books.uploadStatus, status as any));
    }
    if (subject) {
      conditions.push(eq(books.subject, subject as any));
    }

    // Get books
    const booksData = await db
      .select()
      .from(books)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(books.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Get total count
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(books)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: booksData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get books error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Get single book by ID
 * GET /api/admin/books/:id
 */
export async function getBookById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);

    if (!book) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Book not found',
      });
    }

    // Get question count for this book
    const [{ value: questionCount }] = await db
      .select({ value: count() })
      .from(questions)
      .where(eq(questions.bookId, id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ...book,
        questionCount: questionCount || 0,
      },
    });
  } catch (error: any) {
    console.error('Get book by ID error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Get questions for a specific book
 * GET /api/admin/books/:id/questions
 */
export async function getBookQuestions(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Check if book exists
    const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);

    if (!book) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Book not found',
      });
    }

    // Get questions
    const questionsData = await db
      .select()
      .from(questions)
      .where(eq(questions.bookId, id))
      .orderBy(questions.questionNumber)
      .limit(limitNum)
      .offset(offset);

    // Get total count
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(questions)
      .where(eq(questions.bookId, id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: questionsData,
      book: {
        id: book.id,
        title: book.title,
        subject: book.subject,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get book questions error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Update book details
 * PATCH /api/admin/books/:id
 */
export async function updateBook(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { title, description, subject } = req.body;

    // Check if book exists
    const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);

    if (!book) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Book not found',
      });
    }

    // Subject validation is optional - subjects are now dynamic
    // Subject codes should match entries in the subjects table

    // Update book
    const [updatedBook] = await db
      .update(books)
      .set({
        title: title || book.title,
        description: description !== undefined ? description : book.description,
        subject: subject !== undefined ? subject : book.subject,
        updatedAt: new Date(),
      })
      .where(eq(books.id, id))
      .returning();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Book updated successfully',
      data: updatedBook,
    });
  } catch (error: any) {
    console.error('Update book error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Delete book and associated questions
 * DELETE /api/admin/books/:id
 */
export async function deleteBook(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if book exists
    const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);

    if (!book) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Book not found',
      });
    }

    // Delete physical file
    if (fs.existsSync(book.filePath)) {
      fs.unlinkSync(book.filePath);
    }

    // Delete book (cascade will delete associated questions)
    await db.delete(books).where(eq(books.id, id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Book and associated questions deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete book error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Retry processing a failed book
 * POST /api/admin/books/:id/retry
 */
export async function retryProcessing(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if book exists
    const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);

    if (!book) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Book not found',
      });
    }

    // Check if book is in failed or completed status
    if (book.uploadStatus !== 'failed' && book.uploadStatus !== 'completed') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: `Cannot retry processing. Book status is: ${book.uploadStatus}`,
      });
    }

    // Reset book status
    await db
      .update(books)
      .set({
        uploadStatus: 'pending',
        errorMessage: null,
        processingStartedAt: null,
        processingCompletedAt: null,
      })
      .where(eq(books.id, id));

    // Start async processing
    VisionExtractionService.processBookAsync(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Processing restarted. Please check back in 5 minutes.',
    });
  } catch (error: any) {
    console.error('Retry processing error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
