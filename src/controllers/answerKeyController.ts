import { Request, Response } from 'express';
import { db } from '../config/database';
import { books, questions, pageExtractionResults } from '../models/schema';
import { eq, and } from 'drizzle-orm';
import { VisionExtractionService } from '../services/visionExtractionService';
import * as path from 'path';
import * as fs from 'fs/promises';

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

/**
 * Extract answer key from a specific page
 * POST /api/admin/books/:id/extract-answer-key
 */
export async function extractAnswerKey(req: Request, res: Response) {
  try {
    const { id: bookId } = req.params;
    const { pageNumber } = req.body;

    if (!pageNumber) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'pageNumber is required',
      });
    }

    // Check if book exists
    const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

    if (!book) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: 'Book not found',
      });
    }

    // Get the page image
    const [page] = await db
      .select()
      .from(pageExtractionResults)
      .where(
        and(
          eq(pageExtractionResults.bookId, bookId),
          eq(pageExtractionResults.pageNumber, pageNumber)
        )
      )
      .limit(1);

    if (!page || !page.pageImagePath) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: `Page ${pageNumber} not found or has no image`,
      });
    }

    // Convert URL path to filesystem path
    const backendDir = path.join(__dirname, '../..');
    const urlPath = page.pageImagePath.startsWith('/')
      ? page.pageImagePath.substring(1)
      : page.pageImagePath;
    const absoluteFilePath = path.join(backendDir, urlPath.replace(/\//g, path.sep));

    // Check if file exists
    try {
      await fs.access(absoluteFilePath);
    } catch {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Not Found',
        message: `Image file not found for page ${pageNumber}`,
      });
    }

    // Use AI to extract answer key
    console.log(`🔑 Extracting answer key from page ${pageNumber}...`);
    const service = new VisionExtractionService();
    const answerKey = await service.extractAnswerKeyFromImage(absoluteFilePath);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        pageNumber,
        answerKey, // { "1": "A", "2": "C", "3": "D", ... }
        totalAnswers: Object.keys(answerKey).length,
      },
    });
  } catch (error: any) {
    console.error('Extract answer key error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Update questions with extracted answer key
 * POST /api/admin/books/:id/apply-answer-key
 */
export async function applyAnswerKey(req: Request, res: Response) {
  try {
    const { id: bookId } = req.params;
    const { answerKey } = req.body; // { "1": "A", "2": "C", ... }

    if (!answerKey || typeof answerKey !== 'object') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Bad Request',
        message: 'answerKey object is required',
      });
    }

    // Get all questions for this book
    const bookQuestions = await db.select().from(questions).where(eq(questions.bookId, bookId));

    let updatedCount = 0;
    const updateResults = [];

    // Update each question with its answer from the answer key
    for (const question of bookQuestions) {
      const questionNum = question.questionNumber.toString();
      const correctAnswer = answerKey[questionNum];

      if (correctAnswer) {
        await db
          .update(questions)
          .set({
            correctAnswer: correctAnswer.toUpperCase(),
            updatedAt: new Date(),
          })
          .where(eq(questions.id, question.id));

        updatedCount++;
        updateResults.push({
          questionNumber: question.questionNumber,
          oldAnswer: question.correctAnswer,
          newAnswer: correctAnswer.toUpperCase(),
        });
      }
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        updatedCount,
        totalQuestions: bookQuestions.length,
        updates: updateResults,
      },
    });
  } catch (error: any) {
    console.error('Apply answer key error:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
