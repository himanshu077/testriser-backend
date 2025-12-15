import { Request, Response } from 'express';
import { db } from '../config/database';
import { questions, books } from '../models/schema';
import { eq, and, desc, asc, isNotNull, isNull, sql } from 'drizzle-orm';
import { HTTP_STATUS } from '../config/constants';
import { PDFParserService } from '../services/pdfParserService';
import { VisionExtractionService } from '../services/visionExtractionService';
import fs from 'fs';
import path from 'path';

/**
 * Get all questions (with optional filters, sorting, and pagination)
 * @route GET /api/admin/questions
 *
 * Query Parameters:
 * - limit: number (default: 10)
 * - offset: number (default: 0)
 * - subject: string (filter by subject code)
 * - topic: string (filter by topic)
 * - examYear: number (filter by exam year)
 * - difficulty: 'easy' | 'medium' | 'hard'
 * - hasDiagram: 'true' | 'false' | 'with_image' | 'needs_image'
 * - bookId: string (filter by source book)
 * - sortBy: 'newest' | 'oldest' | 'year_desc' | 'year_asc' | 'difficulty' | 'question_number'
 * - search: string (search in question text)
 */
export async function getAllQuestions(req: Request, res: Response) {
  try {
    const {
      limit = '10',
      offset = '0',
      subject,
      topic,
      examYear,
      difficulty,
      hasDiagram,
      isActive,
      bookId,
      sortBy = 'newest',
      search,
    } = req.query;

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    const conditions = [];

    // Subject filter
    if (subject && subject !== 'all') {
      conditions.push(eq(questions.subject, subject as string));
    }

    // Topic filter
    if (topic && topic !== 'all') {
      conditions.push(eq(questions.topic, topic as string));
    }

    // Exam year filter
    if (examYear && examYear !== 'all') {
      conditions.push(eq(questions.examYear, parseInt(examYear as string)));
    }

    // Difficulty filter
    if (difficulty && difficulty !== 'all') {
      conditions.push(eq(questions.difficulty, difficulty as 'easy' | 'medium' | 'hard'));
    }

    // Diagram filter
    if (hasDiagram && hasDiagram !== 'all') {
      if (hasDiagram === 'true') {
        conditions.push(eq(questions.hasDiagram, true));
      } else if (hasDiagram === 'false') {
        conditions.push(eq(questions.hasDiagram, false));
      } else if (hasDiagram === 'with_image') {
        conditions.push(isNotNull(questions.questionImage));
      } else if (hasDiagram === 'needs_image') {
        conditions.push(eq(questions.hasDiagram, true));
        conditions.push(isNull(questions.questionImage));
      }
    }

    // Active/Inactive filter
    if (isActive && isActive !== 'all') {
      if (isActive === 'true') {
        conditions.push(eq(questions.isActive, true));
      } else if (isActive === 'false') {
        conditions.push(eq(questions.isActive, false));
      }
    }

    // Book filter
    if (bookId && bookId !== 'all') {
      conditions.push(eq(questions.bookId, bookId as string));
    }

    // Search filter (case-insensitive search in question text)
    if (search && (search as string).trim()) {
      conditions.push(sql`LOWER(${questions.questionText}) LIKE LOWER(${'%' + search + '%'})`);
    }

    // Build query
    let query = db.select().from(questions);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    // Apply sorting
    let sortedQuery;
    switch (sortBy) {
      case 'oldest':
        sortedQuery = query.orderBy(asc(questions.createdAt));
        break;
      case 'year_desc':
        sortedQuery = query.orderBy(desc(questions.examYear), desc(questions.createdAt));
        break;
      case 'year_asc':
        sortedQuery = query.orderBy(asc(questions.examYear), desc(questions.createdAt));
        break;
      case 'difficulty':
        // Order: easy, medium, hard
        sortedQuery = query.orderBy(
          sql`CASE ${questions.difficulty} WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END`,
          desc(questions.createdAt)
        );
        break;
      case 'question_number':
        sortedQuery = query.orderBy(asc(questions.questionNumber));
        break;
      case 'newest':
      default:
        sortedQuery = query.orderBy(desc(questions.createdAt));
        break;
    }

    // Add pagination
    const allQuestions = await sortedQuery.limit(limitNum).offset(offsetNum);

    // Get total count for pagination info
    let countQuery = db.select({ count: questions.id }).from(questions);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
    }
    const result = await countQuery;
    const total = result.length;

    res.json({
      success: true,
      data: allQuestions,
      pagination: {
        offset: offsetNum,
        limit: limitNum,
        total,
        hasMore: offsetNum + allQuestions.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch questions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get available filter options (unique years, topics, etc.)
 * @route GET /api/admin/questions/filter-options
 */
export async function getFilterOptions(req: Request, res: Response) {
  try {
    // Get unique exam years
    const yearsResult = await db
      .selectDistinct({ examYear: questions.examYear })
      .from(questions)
      .where(isNotNull(questions.examYear))
      .orderBy(desc(questions.examYear));

    const years = yearsResult.map((r) => r.examYear).filter((y): y is number => y !== null);

    // Get unique topics
    const topicsResult = await db
      .selectDistinct({ topic: questions.topic })
      .from(questions)
      .orderBy(asc(questions.topic));

    const topics = topicsResult.map((r) => r.topic);

    // Get question counts by subject
    const subjectCounts = await db
      .select({
        subject: questions.subject,
        count: sql<number>`count(*)::int`,
      })
      .from(questions)
      .groupBy(questions.subject);

    // Get question counts by difficulty
    const difficultyCounts = await db
      .select({
        difficulty: questions.difficulty,
        count: sql<number>`count(*)::int`,
      })
      .from(questions)
      .groupBy(questions.difficulty);

    // Get diagram stats
    const diagramStats = await db
      .select({
        hasDiagram: questions.hasDiagram,
        hasImage: sql<boolean>`${questions.questionImage} IS NOT NULL`,
        count: sql<number>`count(*)::int`,
      })
      .from(questions)
      .groupBy(questions.hasDiagram, sql`${questions.questionImage} IS NOT NULL`);

    res.json({
      success: true,
      data: {
        years,
        topics,
        subjectCounts,
        difficultyCounts,
        diagramStats,
      },
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get single question by ID
 * @route GET /api/admin/questions/:id
 */
export async function getQuestionById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [question] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    res.json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch question',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create a new question
 * @route POST /api/admin/questions
 */
export async function createQuestion(req: Request, res: Response) {
  try {
    const {
      paperId,
      subject,
      topic,
      subtopic,
      questionText,
      questionImage,
      questionType,
      optionA,
      optionB,
      optionC,
      optionD,
      optionAImage,
      optionBImage,
      optionCImage,
      optionDImage,
      correctAnswer,
      explanation,
      explanationImage,
      marksPositive,
      marksNegative,
      difficulty,
      questionNumber,
    } = req.body;

    if (!subject || !topic || !questionText || !correctAnswer || !questionNumber) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Missing required fields',
        required: ['subject', 'topic', 'questionText', 'correctAnswer', 'questionNumber'],
      });
    }

    const [newQuestion] = await db
      .insert(questions)
      .values({
        paperId,
        subject,
        topic,
        subtopic,
        questionText,
        questionImage,
        questionType: questionType || 'single_correct',
        optionA,
        optionB,
        optionC,
        optionD,
        optionAImage,
        optionBImage,
        optionCImage,
        optionDImage,
        correctAnswer,
        explanation,
        explanationImage,
        marksPositive: marksPositive || '4.00',
        marksNegative: marksNegative || '1.00',
        difficulty: difficulty || 'medium',
        questionNumber,
      })
      .returning();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Question created successfully',
      data: newQuestion,
    });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to create question',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Bulk create questions
 * @route POST /api/admin/questions/bulk
 */
export async function bulkCreateQuestions(req: Request, res: Response) {
  try {
    const { questions: questionsData } = req.body;

    if (!Array.isArray(questionsData) || questionsData.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid questions data',
        message: 'Expected an array of questions',
      });
    }

    const createdQuestions = await db.insert(questions).values(questionsData).returning();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: `${createdQuestions.length} questions created successfully`,
      data: createdQuestions,
    });
  } catch (error) {
    console.error('Error bulk creating questions:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to bulk create questions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update question
 * @route PUT /api/admin/questions/:id
 */
export async function updateQuestion(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const [updatedQuestion] = await db
      .update(questions)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id))
      .returning();

    if (!updatedQuestion) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    res.json({
      success: true,
      message: 'Question updated successfully',
      data: updatedQuestion,
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to update question',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete question
 * @route DELETE /api/admin/questions/:id
 */
export async function deleteQuestion(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [deletedQuestion] = await db.delete(questions).where(eq(questions.id, id)).returning();

    if (!deletedQuestion) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    res.json({
      success: true,
      message: 'Question deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to delete question',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Upload PDF and extract questions directly
 * @route POST /api/admin/questions/upload-pdf
 */
export async function uploadPDFQuestions(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    // Validate file upload
    const file = req.file;
    if (!file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'No PDF file uploaded' });
    }

    // Validate subject and check if AI enhancement is requested
    const { subject, topic, paperId, useAI } = req.body;
    if (!subject) {
      // Clean up uploaded file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Subject is required',
      });
    }

    const enableAI = useAI === 'true' || useAI === true;
    console.log('📄 Processing PDF:', file.filename);
    console.log('📚 Subject:', subject);
    console.log('🤖 AI Enhancement:', enableAI ? 'ENABLED' : 'DISABLED');

    // Parse PDF
    const pdfText = await PDFParserService.parsePDF(file.path);
    console.log('✅ PDF parsed, text length:', pdfText.length);

    // Extract questions from PDF
    const extractedQuestions = await PDFParserService.extractQuestions(pdfText, subject);
    console.log('✅ Questions extracted:', extractedQuestions.length);

    // Save questions to database with optional AI enhancement
    const savedQuestions: any[] = [];
    const visionService = enableAI ? new VisionExtractionService() : null;

    for (const q of extractedQuestions) {
      let enhancedMetadata = null;

      // Use AI to generate explanation and enhance metadata if enabled
      if (enableAI && visionService) {
        try {
          console.log(`🤖 Enhancing Q${savedQuestions.length + 1} with AI...`);
          enhancedMetadata = await visionService.generateQuestionMetadata({
            questionText: q.questionText,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer,
            subject: subject,
            topic: topic || q.topic,
            difficulty: q.difficulty,
          });
        } catch (aiError) {
          console.error(`⚠️  AI enhancement failed for Q${savedQuestions.length + 1}:`, aiError);
        }
      }

      const [savedQuestion] = await db
        .insert(questions)
        .values({
          subject: (enhancedMetadata?.subject || subject) as 'physics' | 'chemistry' | 'biology',
          topic: enhancedMetadata?.topic || topic || q.topic || '',
          subtopic: enhancedMetadata?.subtopic || q.subtopic || null,
          paperId: paperId || null,
          questionText: q.questionText,
          questionType: 'single_correct',
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
          explanation: enhancedMetadata?.explanation || q.explanation || null,
          difficulty: enhancedMetadata?.difficulty || q.difficulty || 'medium',
          cognitiveLevel: enhancedMetadata?.cognitiveLevel || null,
          marksPositive: '4.00',
          marksNegative: '1.00',
          questionNumber: savedQuestions.length + 1,
          examYear: q.examYear || null,
          examType: q.examType || null,
        })
        .returning();

      savedQuestions.push(savedQuestion);
    }

    // Clean up uploaded file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: `Successfully extracted and saved ${savedQuestions.length} questions`,
      data: {
        totalQuestions: savedQuestions.length,
        questions: savedQuestions,
      },
    });
  } catch (error: any) {
    console.error('❌ Error uploading PDF questions:', error);

    // Clean up file on error
    const file = req.file;
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to process PDF',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Upload diagram image for a question
 * @route POST /api/admin/questions/:id/upload-diagram
 */
export async function uploadQuestionDiagram(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'No image file uploaded',
      });
    }

    // Check if question exists
    const [question] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);

    if (!question) {
      // Clean up uploaded file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    // Delete old diagram if exists
    if (question.questionImage) {
      const oldImagePath = `${process.cwd()}${question.questionImage}`;
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
        } catch (e) {
          // Ignore delete errors
        }
      }
    }

    // Update question with new diagram URL
    const imageUrl = `/uploads/diagram-images/${file.filename}`;

    const [updatedQuestion] = await db
      .update(questions)
      .set({
        questionImage: imageUrl,
        hasDiagram: true,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id))
      .returning();

    res.json({
      success: true,
      message: 'Diagram uploaded successfully',
      data: {
        questionImage: imageUrl,
        question: updatedQuestion,
      },
    });
  } catch (error) {
    console.error('Error uploading diagram:', error);

    // Clean up file on error
    const file = req.file;
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to upload diagram',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete diagram image from a question
 * @route DELETE /api/admin/questions/:id/diagram
 */
export async function deleteQuestionDiagram(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if question exists
    const [question] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    // Delete the image file if exists
    if (question.questionImage) {
      const imagePath = `${process.cwd()}${question.questionImage}`;
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (e) {
          // Ignore delete errors
        }
      }
    }

    // Update question to remove diagram
    const [updatedQuestion] = await db
      .update(questions)
      .set({
        questionImage: null,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id))
      .returning();

    res.json({
      success: true,
      message: 'Diagram deleted successfully',
      data: updatedQuestion,
    });
  } catch (error) {
    console.error('Error deleting diagram:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to delete diagram',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Generate diagram for a question using Gemini AI
 * @route POST /api/admin/questions/:id/generate-diagram
 */
export async function generateQuestionDiagram(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { diagramDescription, pageNumber } = req.body;

    console.log(`\n🎨 Generate Diagram Request for Question ID: ${id}`);
    console.log(`   📋 Description: ${diagramDescription}`);
    if (pageNumber) {
      console.log(`   📄 Manual Page Number: ${pageNumber}`);
    }

    // Validate diagram description
    if (!diagramDescription) {
      console.log(`   ❌ Error: No diagram description provided`);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Diagram description is required',
      });
    }

    // Check if question exists and has necessary data
    const [question] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);

    if (!question) {
      console.log(`   ❌ Error: Question not found with ID: ${id}`);
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    console.log(`   ✅ Found question: Q${question.questionNumber}`);
    console.log(`   📚 Book ID: ${question.bookId || 'NOT SET'}`);
    console.log(`   📊 Has Diagram: ${question.hasDiagram}`);

    if (!question.hasDiagram) {
      console.log(`   ❌ Error: Question is not marked as having a diagram`);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Question is not marked as having a diagram',
      });
    }

    if (!question.bookId) {
      console.log(`   ❌ Error: Question is not linked to a source book/PDF`);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Question is not linked to a source book/PDF',
      });
    }

    // Get the source book to find PDF path
    const [book] = await db.select().from(books).where(eq(books.id, question.bookId)).limit(1);

    if (!book) {
      console.log(`   ❌ Error: Source book not found with ID: ${question.bookId}`);
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Source book not found',
      });
    }

    console.log(`   ✅ Found book: ${book.title}`);
    console.log(`   📄 PDF Path: ${book.filePath}`);

    // Check if PDF file exists
    // If the path is absolute, use it as is; otherwise, join with backend directory
    let pdfPath: string;
    if (path.isAbsolute(book.filePath)) {
      pdfPath = book.filePath;
    } else {
      // Join with backend directory (process.cwd() returns project root)
      pdfPath = path.join(process.cwd(), 'backend', book.filePath);
    }
    console.log(`   🔍 Checking PDF exists at: ${pdfPath}`);

    if (!fs.existsSync(pdfPath)) {
      console.log(`   ❌ Error: Source PDF file not found at path`);
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Source PDF file not found',
      });
    }

    console.log(`   ✅ PDF file exists`);

    // Initialize vision extraction service
    const visionService = new VisionExtractionService();

    // Generate diagram using Gemini
    console.log(
      `🎨 Generating diagram for Question ${question.questionNumber} using Gemini AI...`
    );
    const diagramPath = await visionService.generateDiagramForQuestion(
      pdfPath,
      question.questionNumber,
      diagramDescription,
      pageNumber // Optional: manual page override
    );

    // Update question with the generated diagram path
    const [updatedQuestion] = await db
      .update(questions)
      .set({
        questionImage: diagramPath,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id))
      .returning();

    console.log(`✅ Diagram generated successfully: ${diagramPath}`);

    res.json({
      success: true,
      message: 'Diagram generated successfully',
      data: updatedQuestion,
    });
  } catch (error) {
    console.error('Error generating diagram:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to generate diagram',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Crop an existing diagram image
 * @route POST /api/admin/questions/:id/crop-diagram
 */
export async function cropQuestionDiagram(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { cropData } = req.body;

    console.log(`\n✂️  Crop Diagram Request for Question ID: ${id}`);
    console.log(`   📐 Crop Data:`, cropData);

    // Validate crop data
    if (!cropData || typeof cropData.x !== 'number' || typeof cropData.y !== 'number' ||
        typeof cropData.width !== 'number' || typeof cropData.height !== 'number') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid crop data',
        message: 'cropData must contain x, y, width, and height coordinates'
      });
    }

    // Get the question
    const [question] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    if (!question.questionImage) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Question has no diagram to crop',
      });
    }

    // Get the full path to the current image
    const imagePath = `${process.cwd()}${question.questionImage}`;

    if (!fs.existsSync(imagePath)) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Diagram file not found',
      });
    }

    // Initialize vision extraction service
    const visionService = new VisionExtractionService();

    // Crop the diagram
    const croppedPath = await visionService.cropDiagram(imagePath, cropData);

    // Update question with the cropped diagram path
    const [updatedQuestion] = await db
      .update(questions)
      .set({
        questionImage: croppedPath,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id))
      .returning();

    console.log(`✅ Diagram cropped successfully: ${croppedPath}`);

    res.json({
      success: true,
      message: 'Diagram cropped successfully',
      data: updatedQuestion,
    });
  } catch (error) {
    console.error('Error cropping diagram:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to crop diagram',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Approve a question (set isActive = true)
 * PATCH /api/admin/questions/:id/approve
 */
export async function approveQuestion(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [updatedQuestion] = await db
      .update(questions)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id))
      .returning();

    if (!updatedQuestion) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    res.json({
      success: true,
      message: 'Question approved successfully',
      data: updatedQuestion,
    });
  } catch (error) {
    console.error('Error approving question:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to approve question',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Reject a question (set isActive = false)
 * PATCH /api/admin/questions/:id/reject
 */
export async function rejectQuestion(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [updatedQuestion] = await db
      .update(questions)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id))
      .returning();

    if (!updatedQuestion) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    res.json({
      success: true,
      message: 'Question rejected successfully',
      data: updatedQuestion,
    });
  } catch (error) {
    console.error('Error rejecting question:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to reject question',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Bulk approve questions
 * POST /api/admin/questions/bulk-approve
 * Body: { questionIds: string[] } or { bookId: string } to approve all questions from a book
 */
export async function bulkApproveQuestions(req: Request, res: Response) {
  try {
    const { questionIds, bookId } = req.body;

    let condition;
    if (questionIds && Array.isArray(questionIds)) {
      // Approve specific questions by IDs
      condition = sql`id = ANY(${questionIds})`;
    } else if (bookId) {
      // Approve all questions from a book
      condition = eq(questions.bookId, bookId);
    } else {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Either questionIds array or bookId is required',
      });
    }

    await db
      .update(questions)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(condition);

    res.json({
      success: true,
      message: `Questions approved successfully`,
      data: { updated: questionIds?.length || 'all' },
    });
  } catch (error) {
    console.error('Error bulk approving questions:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to bulk approve questions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get pending questions count (for review badge)
 * GET /api/admin/questions/pending/count
 */
export async function getPendingCount(req: Request, res: Response) {
  try {
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(questions)
      .where(eq(questions.isActive, false));

    res.json({
      success: true,
      data: { pendingCount: result.count || 0 },
    });
  } catch (error) {
    console.error('Error getting pending count:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to get pending count',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
