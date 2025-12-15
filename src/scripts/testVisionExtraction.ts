/**
 * Test script for Vision API PDF extraction
 *
 * Usage: npm run test:vision
 */

import { VisionExtractionService } from '../services/visionExtractionService';
import * as path from 'path';
import * as fs from 'fs/promises';
import { db } from '../config/database';
import { questions as questionsTable, books } from '../models/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const pdfPath = path.join(__dirname, '../../dummy-pdf/Neet-2024.pdf');

  console.log('========================================');
  console.log('🔬 VISION API PDF EXTRACTION TEST');
  console.log('========================================\n');

  // Check if PDF exists
  try {
    await fs.access(pdfPath);
    console.log('✅ PDF file found:', pdfPath);
  } catch (error) {
    console.error('❌ PDF file not found:', pdfPath);
    console.error('Please ensure the file exists at the specified path.');
    process.exit(1);
  }

  // Initialize service
  const visionService = new VisionExtractionService();

  try {
    // Extract questions from PDF
    console.log('\n📤 Starting extraction...\n');
    const questions = await visionService.extractPDF(pdfPath);

    console.log('\n========================================');
    console.log('📊 EXTRACTION SUMMARY');
    console.log('========================================');
    console.log(`Total questions extracted: ${questions.length}`);
    console.log(`Questions with diagrams: ${questions.filter((q) => q.hasDiagram).length}`);
    console.log(
      `Match-list questions: ${questions.filter((q) => q.questionType === 'match_list').length}`
    );
    console.log(
      `Questions by subject:`,
      questions.reduce(
        (acc, q) => {
          acc[q.subject] = (acc[q.subject] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      )
    );

    // Find or create book entry
    console.log('\n📚 Finding/creating book entry...');
    const [existingBook] = await db.select().from(books).where(eq(books.title, 'NEET 2024'));

    let bookId: string;
    if (existingBook) {
      bookId = existingBook.id;
      console.log('✅ Found existing book:', existingBook.id);
    } else {
      const [newBook] = await db
        .insert(books)
        .values({
          title: 'NEET 2024',
          description: 'NEET 2024 Previous Year Questions extracted via Vision API',
          filename: 'Neet-2024.pdf',
          filePath: pdfPath,
          fileSize: (await fs.stat(pdfPath)).size,
          bookType: 'pyq',
          pyqType: 'full_length',
          uploadStatus: 'completed',
          totalQuestionsExtracted: questions.length,
        })
        .returning();
      bookId = newBook.id;
      console.log('✅ Created new book:', bookId);
    }

    // Save questions to database
    console.log('\n💾 Saving questions to database...');
    let savedCount = 0;
    let skippedCount = 0;

    for (const question of questions) {
      try {
        await db.insert(questionsTable).values({
          bookId: bookId,
          subject: question.subject.toLowerCase(),
          topic: question.topic,
          subtopic: question.subtopic || null,
          examYear: question.examYear || null,
          examType: question.examType || null,
          questionText: question.questionText,
          questionImage: question.diagramImage || null,
          questionType: question.questionType,
          optionA: question.optionA || null,
          optionB: question.optionB || null,
          optionC: question.optionC || null,
          optionD: question.optionD || null,
          correctAnswer: question.correctAnswer || 'PENDING',
          explanation: question.explanation || null,
          difficulty: question.difficulty,
          questionNumber: question.questionNumber,
          isActive: true,
          hasDiagram: question.hasDiagram,
          diagramDescription: question.diagramDescription || null,
          structuredData: question.structuredData ? JSON.stringify(question.structuredData) : null,
        });
        savedCount++;

        // Log progress every 10 questions
        if (savedCount % 10 === 0) {
          console.log(`   Saved ${savedCount}/${questions.length} questions...`);
        }
      } catch (error: any) {
        console.error(`   ⚠️ Failed to save question ${question.questionNumber}:`, error.message);
        skippedCount++;
      }
    }

    console.log(`\n✅ Saved ${savedCount} questions to database`);
    if (skippedCount > 0) {
      console.log(`⚠️ Skipped ${skippedCount} questions (errors or duplicates)`);
    }

    // Display sample questions
    console.log('\n========================================');
    console.log('📝 SAMPLE QUESTIONS (First 3)');
    console.log('========================================');

    questions.slice(0, 3).forEach((q, idx) => {
      console.log(`\n${idx + 1}. Question ${q.questionNumber} [${q.subject} - ${q.topic}]`);
      console.log(`   Type: ${q.questionType}`);
      console.log(`   Text: ${q.questionText.substring(0, 100)}...`);
      console.log(`   Answer: ${q.correctAnswer || 'Not determined'}`);
      console.log(`   Diagram: ${q.hasDiagram ? 'Yes' : 'No'}`);
      if (q.structuredData) {
        console.log(`   Structured Data: ${JSON.stringify(q.structuredData).substring(0, 100)}...`);
      }
    });

    console.log('\n========================================');
    console.log('✅ EXTRACTION COMPLETE!');
    console.log('========================================');
    console.log('\nYou can now view the questions in the admin panel.');
    console.log('Database has been updated with the extracted questions.\n');
  } catch (error) {
    console.error('\n❌ Extraction failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
