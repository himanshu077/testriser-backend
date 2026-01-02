import { Request, Response } from 'express';
import { db } from '../config/database';
import { questions, books, subjects, curriculumChapters } from '../models/schema';
import { eq, and, desc, asc, isNotNull, isNull, sql } from 'drizzle-orm';
import { HTTP_STATUS } from '../config/constants';
import { PDFParserService } from '../services/pdfParserService';
import { VisionExtractionService } from '../services/visionExtractionService';
import {
  getUploadedFilePath,
  getLocalFilePath,
  deleteFile,
  cleanupTempFile,
  uploadFileToS3,
  getS3Url,
} from '../utils/fileStorage.util';
import { shouldUseS3 } from '../config/s3';
import fs from 'fs';
import path from 'path';

/**
 * Look up subject ID by name or code (case-insensitive)
 */
async function lookupSubjectId(subjectNameOrCode: string): Promise<string | null> {
  if (!subjectNameOrCode || subjectNameOrCode.trim() === '') return null;

  try {
    const normalizedInput = subjectNameOrCode.toLowerCase().trim();

    // Try matching by code first, then by name (case-insensitive)
    const subjectRecords = await db
      .select({ id: subjects.id, name: subjects.name, code: subjects.code })
      .from(subjects);

    const matchedSubject = subjectRecords.find(
      (s) => s.code.toLowerCase() === normalizedInput || s.name.toLowerCase() === normalizedInput
    );

    return matchedSubject?.id || null;
  } catch (error) {
    console.error('[QuestionsController] Error looking up subject:', error);
    return null;
  }
}

/**
 * Find matching curriculum chapter for a topic (filtered by subject)
 */
async function lookupChapterId(topic: string, subjectId: string | null): Promise<string | null> {
  if (!topic || topic.trim() === '' || !subjectId) return null;

  try {
    // Get chapters for the subject
    const chaptersForSubject = await db
      .select({ id: curriculumChapters.id, name: curriculumChapters.name })
      .from(curriculumChapters)
      .where(eq(curriculumChapters.subjectId, subjectId));

    // Simple string similarity matching (case-insensitive)
    const normalizedTopic = topic.toLowerCase().trim();

    for (const chapter of chaptersForSubject) {
      const normalizedChapterName = chapter.name.toLowerCase().trim();
      // Check if topic contains chapter name or vice versa
      if (
        normalizedChapterName.includes(normalizedTopic) ||
        normalizedTopic.includes(normalizedChapterName)
      ) {
        return chapter.id;
      }
    }

    return null;
  } catch (error) {
    console.error('[QuestionsController] Error looking up chapter:', error);
    return null;
  }
}

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

    // Subject filter - lookup by code or name
    if (subject && subject !== 'all') {
      // First, find the subject by code or name (case-insensitive)
      const normalizedSubject = (subject as string).toLowerCase().trim();
      const [subjectRecord] = await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(
          sql`LOWER(${subjects.code}) = ${normalizedSubject} OR LOWER(${subjects.name}) = ${normalizedSubject}`
        )
        .limit(1);

      if (subjectRecord) {
        // Filter by subjectId if available
        conditions.push(eq(questions.subjectId, subjectRecord.id));
      } else {
        // Fallback to legacy subject name filter (case-insensitive)
        conditions.push(sql`LOWER(${questions.subject}) = ${normalizedSubject}`);
      }
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

    // Look up subject ID and chapter ID from database
    const subjectId = await lookupSubjectId(subject);
    const curriculumChapterId = await lookupChapterId(topic, subjectId);

    const [newQuestion] = await db
      .insert(questions)
      .values({
        paperId,
        subject,
        subjectId, // Store subject ID from subjects table
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
        curriculumChapterId, // Store chapter ID from curriculum_chapters table
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
      const uploadedFilePath = getUploadedFilePath(file);
      await deleteFile(uploadedFilePath);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Subject is required',
      });
    }

    const enableAI = useAI === 'true' || useAI === true;
    console.log('📄 Processing PDF:', file.filename);
    console.log('📚 Subject:', subject);
    console.log('🤖 AI Enhancement:', enableAI ? 'ENABLED' : 'DISABLED');

    // Get file path (works for both local and S3 uploads)
    const uploadedFilePath = getUploadedFilePath(file);
    const localFilePath = await getLocalFilePath(uploadedFilePath);

    // Parse PDF
    const pdfText = await PDFParserService.parsePDF(localFilePath);
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

      // Look up subject ID and chapter ID from database
      const finalSubject = (enhancedMetadata?.subject || subject) as string;
      const finalTopic = enhancedMetadata?.topic || topic || q.topic || '';
      const subjectId = await lookupSubjectId(finalSubject);
      const curriculumChapterId = await lookupChapterId(finalTopic, subjectId);

      const [savedQuestion] = await db
        .insert(questions)
        .values({
          subject: finalSubject as 'physics' | 'chemistry' | 'biology',
          subjectId, // Store subject ID from subjects table
          topic: finalTopic,
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
          curriculumChapterId, // Store chapter ID from curriculum_chapters table
        })
        .returning();

      savedQuestions.push(savedQuestion);
    }

    // Clean up uploaded file and temp file
    await deleteFile(uploadedFilePath);
    cleanupTempFile(localFilePath);

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
    if (file) {
      const uploadedFilePath = getUploadedFilePath(file);
      await deleteFile(uploadedFilePath);
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
      const uploadedFilePath = getUploadedFilePath(file);
      await deleteFile(uploadedFilePath);
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    // Delete old diagram if exists
    if (question.questionImage) {
      try {
        await deleteFile(question.questionImage);
      } catch {
        // Ignore delete errors (file might not exist)
      }
    }

    // Handle file upload - memory storage requires manual handling
    let imageUrl: string;
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();

    if (shouldUseS3()) {
      // Production: Upload to S3 with questionId in path
      const s3Key = `diagrams/${id}/diagram-${timestamp}${ext}`;

      // Write buffer to temp file first
      const tempPath = path.join(process.cwd(), 'temp-uploads', `${id}-${timestamp}${ext}`);
      const tempDir = path.dirname(tempPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      fs.writeFileSync(tempPath, file.buffer);

      // Upload to S3
      await uploadFileToS3(tempPath, s3Key, file.mimetype);

      // Get S3 URL
      imageUrl = getS3Url(s3Key);

      // Clean up temp file
      fs.unlinkSync(tempPath);

      console.log(`✅ Diagram uploaded to S3: ${imageUrl}`);
    } else {
      // Development: Save to local filesystem
      const fileName = `diagram-${timestamp}${ext}`;
      const localPath = path.join(process.cwd(), 'uploads', 'diagram-images', fileName);

      // Ensure directory exists
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write buffer to file
      fs.writeFileSync(localPath, file.buffer);
      imageUrl = `/uploads/diagram-images/${fileName}`;

      console.log(`✅ Diagram saved locally: ${imageUrl}`);
    }

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
    if (file) {
      const uploadedFilePath = getUploadedFilePath(file);
      await deleteFile(uploadedFilePath);
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
        } catch {
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
    console.log(`🎨 Generating diagram for Question ${question.questionNumber} using Gemini AI...`);
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
    if (
      !cropData ||
      typeof cropData.x !== 'number' ||
      typeof cropData.y !== 'number' ||
      typeof cropData.width !== 'number' ||
      typeof cropData.height !== 'number'
    ) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid crop data',
        message: 'cropData must contain x, y, width, and height coordinates',
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
 * Auto-generate missing diagrams for questions
 * POST /api/admin/questions/auto-generate-diagrams
 *
 * Finds all questions with hasDiagram=true but no questionImage,
 * and automatically generates diagrams using AI
 */
export async function autoGenerateMissingDiagrams(req: Request, res: Response) {
  try {
    const { limit = 10, bookId } = req.body;

    console.log(`\n🔍 Auto-generating missing diagrams...`);
    console.log(`   Limit: ${limit} questions`);
    if (bookId) console.log(`   Book ID filter: ${bookId}`);

    // Find questions with diagram but no image
    const conditions = [eq(questions.hasDiagram, true), isNull(questions.questionImage)];

    if (bookId) {
      conditions.push(eq(questions.bookId, bookId));
    }

    const questionsToProcess = await db
      .select()
      .from(questions)
      .where(and(...conditions))
      .limit(parseInt(limit as string));

    console.log(`   Found ${questionsToProcess.length} questions with missing diagrams`);

    if (questionsToProcess.length === 0) {
      return res.json({
        success: true,
        message: 'No questions with missing diagrams found',
        data: { processed: 0, results: [] },
      });
    }

    // Initialize vision extraction service
    const visionService = new VisionExtractionService();
    const results = [];

    for (const question of questionsToProcess) {
      try {
        console.log(`\n📸 Processing Q${question.questionNumber} (${question.id.slice(0, 8)}...)`);

        // Get book info
        if (!question.bookId) {
          console.log(`   ⏭️  Skipping - no book ID`);
          results.push({
            questionId: question.id,
            questionNumber: question.questionNumber,
            status: 'skipped',
            reason: 'No book ID',
          });
          continue;
        }

        const [book] = await db.select().from(books).where(eq(books.id, question.bookId)).limit(1);

        if (!book) {
          console.log(`   ⏭️  Skipping - book not found`);
          results.push({
            questionId: question.id,
            questionNumber: question.questionNumber,
            status: 'skipped',
            reason: 'Book not found',
          });
          continue;
        }

        // Get PDF path
        let pdfPath: string;
        if (path.isAbsolute(book.filePath)) {
          pdfPath = book.filePath;
        } else {
          pdfPath = path.join(process.cwd(), 'backend', book.filePath);
        }

        if (!fs.existsSync(pdfPath)) {
          console.log(`   ⏭️  Skipping - PDF not found`);
          results.push({
            questionId: question.id,
            questionNumber: question.questionNumber,
            status: 'skipped',
            reason: 'PDF file not found',
          });
          continue;
        }

        // Use diagram description or generate from question text
        const diagramDescription =
          question.diagramDescription ||
          `Diagram for question ${question.questionNumber}: ${question.questionText?.substring(0, 100)}`;

        console.log(`   📋 Description: ${diagramDescription.substring(0, 80)}...`);

        // Generate diagram
        const diagramPath = await visionService.generateDiagramForQuestion(
          pdfPath,
          question.questionNumber,
          diagramDescription
        );

        // Update question
        await db
          .update(questions)
          .set({
            questionImage: diagramPath,
            updatedAt: new Date(),
          })
          .where(eq(questions.id, question.id));

        console.log(`   ✅ Generated: ${diagramPath}`);

        results.push({
          questionId: question.id,
          questionNumber: question.questionNumber,
          status: 'success',
          diagramPath,
        });
      } catch (error) {
        console.error(
          `   ❌ Error processing Q${question.questionNumber}:`,
          error instanceof Error ? error.message : error
        );
        results.push({
          questionId: question.id,
          questionNumber: question.questionNumber,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const errorCount = results.filter((r) => r.status === 'error').length;
    const skippedCount = results.filter((r) => r.status === 'skipped').length;

    console.log(`\n✅ Auto-generation complete:`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Skipped: ${skippedCount}`);

    res.json({
      success: true,
      message: 'Auto-generation completed',
      data: {
        processed: results.length,
        success: successCount,
        errors: errorCount,
        skipped: skippedCount,
        results,
      },
    });
  } catch (error) {
    console.error('Error in auto-generate diagrams:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to auto-generate diagrams',
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

/**
 * Generate AI explanation for a question
 * POST /api/admin/questions/:id/generate-explanation
 *
 * Body:
 * - customPrompt: string (optional user's custom instructions for explanation generation)
 */
export async function generateExplanation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { customPrompt } = req.body;

    // Get the question from database
    const [question] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Question not found',
      });
    }

    // Initialize OpenAI
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    // Build the prompt
    const systemPrompt = `You are an expert tutor for NEET/JEE exam preparation. Generate detailed, accurate explanations for exam questions.

For mathematical formulas, use LaTeX notation:
- Inline math: $E = mc^2$
- Display math: $$E = mc^2$$

Keep explanations clear, concise, and student-friendly.`;

    const userPrompt = `Generate a comprehensive explanation for this question:

**Question:** ${question.questionText}

**Options:**
${question.optionA ? `A) ${question.optionA}` : ''}
${question.optionB ? `B) ${question.optionB}` : ''}
${question.optionC ? `C) ${question.optionC}` : ''}
${question.optionD ? `D) ${question.optionD}` : ''}

**Correct Answer:** ${question.correctAnswer}

**Subject:** ${question.subject}
**Topic:** ${question.topic}
${question.subtopic ? `**Subtopic:** ${question.subtopic}` : ''}

${customPrompt ? `\n**Additional Instructions:** ${customPrompt}\n` : ''}

Provide an explanation that:
1. Explains why the correct answer is right
2. Clarifies why other options are incorrect (if applicable)
3. Includes relevant formulas, concepts, or step-by-step calculations
4. Uses proper LaTeX notation for mathematical expressions`;

    // Generate explanation using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const explanation = completion.choices[0]?.message?.content || '';

    // Try to detect if AI suggests a different answer
    let suggestedAnswer = null;
    let aiCalculatedValue = null;

    // Ask AI to determine the correct answer based on calculation
    const answerCheckPrompt = `Based on your explanation and calculation, which option (A, B, C, or D) is correct?
If you calculated a specific numerical value, also provide that value.
Respond in this exact format:
Correct Option: [A/B/C/D]
Calculated Value: [number or "N/A"]`;

    const answerCheck = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: explanation },
        { role: 'user', content: answerCheckPrompt },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const answerCheckResponse = answerCheck.choices[0]?.message?.content || '';

    // Parse the AI's suggested answer
    const optionMatch = answerCheckResponse.match(/Correct Option:\s*([A-D])/i);
    const valueMatch = answerCheckResponse.match(/Calculated Value:\s*([^\n]+)/i);

    if (optionMatch) {
      suggestedAnswer = optionMatch[1].toUpperCase();
    }

    if (valueMatch && valueMatch[1] !== 'N/A') {
      aiCalculatedValue = valueMatch[1].trim();
    }

    // Update the question with the new explanation
    await db
      .update(questions)
      .set({
        explanation,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id));

    res.json({
      success: true,
      data: {
        explanation,
        suggestedAnswer,
        aiCalculatedValue,
        currentAnswer: question.correctAnswer,
        hasConflict: suggestedAnswer && suggestedAnswer !== question.correctAnswer,
      },
      message: 'Explanation generated successfully',
    });
  } catch (error) {
    console.error('Error generating explanation:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to generate explanation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
