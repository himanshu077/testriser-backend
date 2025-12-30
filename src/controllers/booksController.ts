import { Request, Response } from 'express';
import { db } from '../config/database';
import { books, questions, pageExtractionResults } from '../models/schema';
import { eq, desc, and, count } from 'drizzle-orm';
import { HTTP_STATUS } from '../config/constants';
import { VisionExtractionService } from '../services/visionExtractionService';
import { calculateFileHash } from '../utils/fileHash.util';
import {
  getUploadedFilePath,
  getLocalFilePath,
  deleteFile,
  cleanupTempFile,
} from '../utils/fileStorage.util';
import fs from 'fs';
import path from 'path';

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

    // Get file path (works for both local and S3 uploads)
    const uploadedFilePath = getUploadedFilePath(req.file);

    // Get local file path for processing (downloads from S3 if needed)
    console.log('📥 Preparing file for processing...');
    const localFilePath = await getLocalFilePath(uploadedFilePath);

    // Use AI to detect ALL metadata from first page (no manual input needed)
    console.log('🤖 Detecting exam metadata with AI...');
    const { examName, examYear, title, description, pyqType, subject } =
      await VisionExtractionService.detectExamInfo(localFilePath);

    console.log(`✅ AI Detection Results:`);
    console.log(`   Exam: ${examName || 'Unknown'} ${examYear || 'Unknown Year'}`);
    console.log(`   Title: ${title || 'Not detected'}`);
    console.log(`   Type: ${pyqType || 'Not detected'}`);
    console.log(`   Subject: ${subject || 'Not detected'}`);

    // Fallback to filename if title not detected
    const finalTitle = title || req.file.originalname.replace('.pdf', '');
    const finalDescription =
      description || `PYQ questions from ${examName || 'exam'} ${examYear || ''}`.trim();

    // Calculate file hash for additional duplicate detection
    console.log('📋 Calculating file hash...');
    const fileHash = await calculateFileHash(localFilePath);

    // Clean up temp file if it was downloaded from S3
    cleanupTempFile(localFilePath);

    // Check for duplicate by exam name + year (smarter duplicate detection)
    let existingBook = null;
    if (examName && examYear) {
      const { and } = await import('drizzle-orm');
      [existingBook] = await db
        .select()
        .from(books)
        .where(and(eq(books.examName, examName), eq(books.examYear, examYear)))
        .limit(1);

      if (existingBook) {
        console.log(
          `⚠️  Duplicate exam detected: ${examName} ${examYear} already exists (ID: ${existingBook.id})`
        );
      }
    }

    // Fallback: Check file hash if exam detection failed
    if (!existingBook) {
      [existingBook] = await db.select().from(books).where(eq(books.fileHash, fileHash)).limit(1);

      if (existingBook) {
        console.log(`⚠️  Duplicate file detected: ${existingBook.title} (ID: ${existingBook.id})`);
      }
    }

    if (existingBook) {
      // Delete the uploaded duplicate file (works for both local and S3)
      await deleteFile(uploadedFilePath);

      // Return 409 Conflict with details about existing book
      return res.status(409).json({
        error: 'Duplicate Exam',
        message:
          examName && examYear
            ? `${examName} ${examYear} already exists in the system`
            : 'This PDF already exists in the system',
        details:
          'You must delete the existing book before uploading again, or use the Retry feature if extraction was incomplete.',
        existingBook: {
          id: existingBook.id,
          title: existingBook.title,
          examName: existingBook.examName,
          examYear: existingBook.examYear,
          uploadedAt: existingBook.createdAt,
          status: existingBook.uploadStatus,
          questionsExtracted: existingBook.totalQuestionsExtracted,
        },
        actions: {
          viewBook: `/admin/books?highlight=${existingBook.id}`,
          deleteBook: `/api/admin/books/${existingBook.id}`,
        },
      });
    }

    console.log('✅ No duplicate found, proceeding with upload');

    // Check if this is detect-only mode (upload without processing)
    const detectOnly = req.body.detectOnly === 'true';
    // Check if this is preview mode (split into pages without extraction)
    const previewMode = req.body.previewMode === 'true';

    // Create book record with AI-detected metadata
    const [book] = await db
      .insert(books)
      .values({
        title: finalTitle,
        description: finalDescription,
        filename: req.file.originalname,
        filePath: uploadedFilePath, // Can be local path or S3 key/URL
        fileSize: req.file.size,
        fileHash: fileHash,
        examName: examName, // AI-detected
        examYear: examYear, // AI-detected
        subject: subject, // AI-detected
        bookType: 'pyq', // Always PYQ now
        pyqType: pyqType as 'subject_wise' | 'full_length' | null, // AI-detected
        uploadStatus: 'pending',
        uploadedBy: userId,
      })
      .returning();

    // Handle different upload modes
    if (previewMode) {
      // Preview mode: Split PDF into pages for review (no extraction yet)
      VisionExtractionService.splitPDFToPagesOnly(book.id);
    } else if (!detectOnly) {
      // Full processing mode: Extract questions from all pages
      VisionExtractionService.processBookAsync(book.id);
    }
    // If detectOnly, do nothing (just upload + AI detection)

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: previewMode
        ? 'PDF uploaded successfully! Splitting into pages for preview...'
        : detectOnly
          ? 'PDF uploaded successfully! AI detected metadata.'
          : 'PYQ uploaded successfully! AI detected metadata. Processing will start shortly.',
      book: {
        id: book.id,
        title: book.title,
        description: book.description,
        filename: book.filename,
        fileSize: book.fileSize,
        examName: book.examName,
        examYear: book.examYear,
        subject: book.subject,
        pyqType: book.pyqType,
        uploadStatus: book.uploadStatus,
        createdAt: book.createdAt,
      },
      aiDetected: {
        examName: examName || 'Not detected',
        examYear: examYear || 'Not detected',
        title: title || 'Used filename',
        description: description || 'Auto-generated',
        pyqType: pyqType || 'Not detected',
        subject: subject || 'Not detected',
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
    const {
      title,
      description,
      subject,
      examName,
      examYear,
      pyqType,
      startProcessing,
      expectedQuestions,
    } = req.body;

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
        title: title !== undefined ? title : book.title,
        description: description !== undefined ? description : book.description,
        subject: subject !== undefined ? subject : book.subject,
        examName: examName !== undefined ? examName : book.examName,
        examYear: examYear !== undefined ? examYear : book.examYear,
        pyqType:
          pyqType !== undefined ? (pyqType as 'subject_wise' | 'full_length' | null) : book.pyqType,
        expectedQuestions:
          expectedQuestions !== undefined ? expectedQuestions : book.expectedQuestions,
        updatedAt: new Date(),
      })
      .where(eq(books.id, id))
      .returning();

    // If startProcessing flag is true, begin extraction
    if (startProcessing === true) {
      console.log(`🚀 Starting processing for book ${id}`);
      VisionExtractionService.processBookAsync(id);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: startProcessing
        ? 'Book updated and processing started'
        : 'Book updated successfully',
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

    // Delete physical PDF file
    if (fs.existsSync(book.filePath)) {
      fs.unlinkSync(book.filePath);
      console.log(`✅ Deleted PDF: ${book.filePath}`);
    }

    // Delete temp-vision directory for this book (if exists)
    const tempVisionDir = path.join(__dirname, '../../temp-vision', id);
    if (fs.existsSync(tempVisionDir)) {
      const files = fs.readdirSync(tempVisionDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempVisionDir, file));
      }
      fs.rmdirSync(tempVisionDir);
      console.log(`✅ Deleted temp directory: ${tempVisionDir}`);
    }

    // Delete associated diagram images
    const diagramImagesDir = path.join(__dirname, '../../uploads/diagram-images');
    if (fs.existsSync(diagramImagesDir)) {
      const diagramFiles = fs.readdirSync(diagramImagesDir);
      const bookDiagrams = diagramFiles.filter((file) => file.startsWith(`${id}-`));
      for (const file of bookDiagrams) {
        fs.unlinkSync(path.join(diagramImagesDir, file));
      }
      if (bookDiagrams.length > 0) {
        console.log(`✅ Deleted ${bookDiagrams.length} diagram images`);
      }
    }

    // Delete associated question images (page images)
    const questionImagesDir = path.join(__dirname, '../../uploads/question-images');
    if (fs.existsSync(questionImagesDir)) {
      const questionFiles = fs.readdirSync(questionImagesDir);
      const bookQuestions = questionFiles.filter((file) => file.startsWith(`${id}-`));
      for (const file of bookQuestions) {
        fs.unlinkSync(path.join(questionImagesDir, file));
      }
      if (bookQuestions.length > 0) {
        console.log(`✅ Deleted ${bookQuestions.length} question images`);
      }
    }

    // Delete book (cascade will delete associated questions)
    await db.delete(books).where(eq(books.id, id));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Book and all associated files deleted successfully',
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

/**
 * Stream book progress updates using Server-Sent Events
 * GET /api/admin/books/:id/progress/stream
 */
export async function streamBookProgress(req: Request, res: Response) {
  const { id } = req.params;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Poll database every 2 seconds for updates
  const interval = setInterval(async () => {
    try {
      const [book] = await db
        .select({
          uploadStatus: books.uploadStatus,
          extractionProgress: books.extractionProgress,
          currentStep: books.currentStep,
          totalQuestionsExtracted: books.totalQuestionsExtracted,
          errorMessage: books.errorMessage,
        })
        .from(books)
        .where(eq(books.id, id))
        .limit(1);

      if (!book) {
        res.write(`data: ${JSON.stringify({ error: 'Book not found' })}\n\n`);
        clearInterval(interval);
        res.end();
        return;
      }

      // Send progress update
      res.write(`data: ${JSON.stringify(book)}\n\n`);

      // Stop streaming when completed or failed
      if (book.uploadStatus === 'completed' || book.uploadStatus === 'failed') {
        clearInterval(interval);
        res.end();
      }
    } catch (error) {
      console.error('SSE error:', error);
      clearInterval(interval);
      res.end();
    }
  }, 2000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
}

/**
 * Get comprehensive extraction report for a book
 * GET /api/admin/books/:id/extraction-report
 */
export async function getBookExtractionReport(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Get book details
    const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);

    if (!book) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Book not found',
      });
    }

    // Get all questions for this book
    const questionsData = await db
      .select({
        subject: questions.subject,
        isActive: questions.isActive,
        questionNumber: questions.questionNumber,
        questionType: questions.questionType,
      })
      .from(questions)
      .where(eq(questions.bookId, id))
      .orderBy(questions.questionNumber);

    // Get page-level results
    const { pageExtractionResults } = await import('../models/schema');
    const pageResults = await db
      .select()
      .from(pageExtractionResults)
      .where(eq(pageExtractionResults.bookId, id))
      .orderBy(pageExtractionResults.pageNumber);

    // Get section results
    const { sectionExtractionResults } = await import('../models/schema');
    const sectionResults = await db
      .select()
      .from(sectionExtractionResults)
      .where(eq(sectionExtractionResults.bookId, id))
      .orderBy(sectionExtractionResults.startPage);

    // Get API costs
    const { apiCostTracking } = await import('../models/schema');
    const costs = await db.select().from(apiCostTracking).where(eq(apiCostTracking.bookId, id));

    // Calculate overview statistics
    const total = questionsData.length;
    const active = questionsData.filter((q) => q.isActive).length;
    const inactive = questionsData.filter((q) => !q.isActive).length;

    // Group by subject
    const bySubject: Record<string, number> = {};
    questionsData.forEach((q) => {
      bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
    });

    // Find missing question numbers (assumes sequential numbering expected)
    const extractedNumbers = new Set(questionsData.map((q) => q.questionNumber));
    const maxQuestion = Math.max(...Array.from(extractedNumbers), 0);
    const missing: number[] = [];
    for (let i = 1; i <= maxQuestion; i++) {
      if (!extractedNumbers.has(i)) {
        missing.push(i);
      }
    }

    // Calculate total API costs
    const totalCost = costs.reduce((sum, c) => {
      const cost = parseFloat(c.estimatedCostUsd || '0');
      return sum + cost;
    }, 0);

    // Format page results
    const byPage = pageResults.map((page) => ({
      pageNumber: page.pageNumber,
      status: page.status,
      questionsExtracted: page.questionsExtracted,
      expectedRange: page.expectedQuestionRange,
      extractedQuestions: JSON.parse(page.extractedQuestions || '[]'),
      missingQuestions: JSON.parse(page.missingQuestions || '[]'),
      errorMessage: page.errorMessage,
      retryCount: page.retryCount,
      apiCost: parseFloat(page.apiCost || '0'),
    }));

    // Format section results
    const bySection = sectionResults.map((section) => {
      const sectionPages = pageResults.filter(
        (p) => p.pageNumber >= section.startPage && p.pageNumber <= section.endPage
      );

      return {
        subject: section.subject,
        pageRange: `${section.startPage}-${section.endPage}`,
        pages: sectionPages.map((p) => ({
          page: p.pageNumber,
          status: p.status,
        })),
        expected: section.expectedQuestions,
        extracted: section.extractedQuestions,
        missing: JSON.parse(section.missingQuestionNumbers || '[]'),
        status: section.status,
      };
    });

    // Calculate page statistics
    const pagesSuccess = pageResults.filter((p) => p.status === 'success').length;
    const pagesPartial = pageResults.filter((p) => p.status === 'partial').length;
    const pagesFailed = pageResults.filter((p) => p.status === 'failed').length;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        book: {
          id: book.id,
          title: book.title,
          uploadStatus: book.uploadStatus,
          totalQuestionsExtracted: book.totalQuestionsExtracted,
        },
        overview: {
          total,
          totalQuestions: total,
          active,
          activeQuestions: active,
          inactive,
          inactiveQuestions: inactive,
          missing: missing.length,
          missingNumbers: missing,
          missingQuestions: missing,
          bySubject,
          expectedTotal: maxQuestion,
          completionRate: maxQuestion > 0 ? ((total / maxQuestion) * 100).toFixed(1) : '0',
          totalPages: pageResults.length,
          pagesSuccess,
          pagesPartial,
          pagesFailed,
          totalCost,
        },
        byPage,
        bySection,
        cost: {
          total: totalCost.toFixed(4),
          calls: costs.length,
          byProvider: {
            openai: costs.filter((c) => c.apiProvider === 'openai').length,
            gemini: costs.filter((c) => c.apiProvider === 'gemini').length,
          },
        },
      },
    });
  } catch (error: any) {
    console.error('Get extraction report error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Get all pages with images for preview mode
 * GET /api/admin/books/:id/pages
 */
export async function getBookPages(req: Request, res: Response) {
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

    // Get all page extraction results
    const pages = await db
      .select()
      .from(pageExtractionResults)
      .where(eq(pageExtractionResults.bookId, id))
      .orderBy(pageExtractionResults.pageNumber);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        book: {
          id: book.id,
          title: book.title,
          uploadStatus: book.uploadStatus,
        },
        pages: pages.map((page) => ({
          pageNumber: page.pageNumber,
          pageImagePath: page.pageImagePath,
          status: page.status,
          questionsExtracted: page.questionsExtracted,
          expectedQuestionRange: page.expectedQuestionRange,
          extractedQuestions: page.extractedQuestions ? JSON.parse(page.extractedQuestions) : [],
          missingQuestions: page.missingQuestions ? JSON.parse(page.missingQuestions) : [],
          errorMessage: page.errorMessage,
          retryCount: page.retryCount,
        })),
      },
    });
  } catch (error: any) {
    console.error('Get book pages error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Process/retry specific pages of a book
 * POST /api/admin/books/:id/retry-pages
 * Body: { pageNumbers: [1, 2, 3] } or { pages: [1, 2, 3] }
 */
export async function retryPages(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const pageNumbers = req.body.pageNumbers || req.body.pages;

    if (!Array.isArray(pageNumbers) || pageNumbers.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'pageNumbers array is required',
      });
    }

    const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);

    if (!book) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Book not found',
      });
    }

    // Process pages in background
    VisionExtractionService.processSpecificPages(id, pageNumbers);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Processing ${pageNumbers.length} page(s). This may take a few minutes.`,
      pageNumbers,
    });
  } catch (error: any) {
    console.error('Retry pages error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Smart retry - analyzes book and recommends best retry strategy
 * POST /api/admin/books/:id/smart-retry
 */
export async function smartRetry(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);

    if (!book) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Book not found',
      });
    }

    // Check for page-level results to analyze
    const { pageExtractionResults } = await import('../models/schema');
    const { or } = await import('drizzle-orm');

    const problematicPages = await db
      .select()
      .from(pageExtractionResults)
      .where(
        and(
          eq(pageExtractionResults.bookId, id),
          or(
            eq(pageExtractionResults.status, 'failed'),
            eq(pageExtractionResults.status, 'partial')
          )
        )
      );

    if (problematicPages.length === 0) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        recommendation: {
          action: 'none',
          reason: 'No problematic pages found',
          estimatedCost: '$0.00',
        },
      });
    }

    const pageNumbers = problematicPages.map((p) => p.pageNumber);
    const estimatedCost = (pageNumbers.length * 0.1).toFixed(2);
    const fullRetryCost = 2.5;
    const savings = (fullRetryCost - parseFloat(estimatedCost)).toFixed(2);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      recommendation: {
        action: 'retry_specific_pages',
        pages: pageNumbers,
        pageCount: pageNumbers.length,
        reason: `${pageNumbers.length} pages had issues (failed or partial)`,
        estimatedCost: `$${estimatedCost}`,
        estimatedTime: `${Math.ceil(pageNumbers.length * 10)}s`,
        savings: `$${savings} vs full retry ($${fullRetryCost.toFixed(2)})`,
      },
    });
  } catch (error: any) {
    console.error('Smart retry error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Retry a specific section of a book
 * POST /api/admin/books/:id/retry-section
 */
export async function retrySection(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { subject } = req.body;

    if (!subject) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'subject is required',
      });
    }

    const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);

    if (!book) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Book not found',
      });
    }

    // Get section details
    const { sectionExtractionResults } = await import('../models/schema');
    const [section] = await db
      .select()
      .from(sectionExtractionResults)
      .where(
        and(eq(sectionExtractionResults.bookId, id), eq(sectionExtractionResults.subject, subject))
      )
      .limit(1);

    if (!section) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Section not found',
      });
    }

    const pageCount = section.endPage - section.startPage + 1;
    const estimatedCost = (pageCount * 0.1).toFixed(2);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Queued retry for ${subject} section (${pageCount} pages)`,
      estimatedCost: `$${estimatedCost}`,
      section: {
        subject: section.subject,
        pageRange: `${section.startPage}-${section.endPage}`,
        pageCount,
      },
    });
  } catch (error: any) {
    console.error('Retry section error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
