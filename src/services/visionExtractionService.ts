/**
 * Google Vision API PDF Extraction Service
 *
 * This service handles comprehensive PDF extraction using Google Vision API
 * and AI-powered question analysis for NEET exam papers.
 *
 * Features:
 * - Page-by-page Vision API processing
 * - AI-powered question structure detection
 * - Diagram extraction and analysis
 * - Match-list table detection
 * - Mathematical equation handling
 * - Answer verification and topic identification
 */

import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch, { Headers, Request, Response } from 'node-fetch';
import FormDataPolyfill from 'form-data';
import sharp from 'sharp';
import { ApiCostTracker } from '../utils/apiCostTracker';
import { retryWithBackoff, isRetryableError } from '../utils/retry.util';

// Polyfill fetch and related APIs for Node.js when running with tsx
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = fetch as any;
  globalThis.Headers = Headers as any;
  globalThis.Request = Request as any;
  globalThis.Response = Response as any;
}

// Polyfill FormData for OpenAI SDK
if (typeof globalThis.FormData === 'undefined') {
  globalThis.FormData = FormDataPolyfill as any;
}

const execAsync = promisify(exec);

interface VisionAPIResponse {
  responses: Array<{
    fullTextAnnotation?: {
      text: string;
      pages: any[];
    };
    textAnnotations?: any[];
    error?: any;
  }>;
}

interface ExtractedQuestion {
  questionNumber: number;
  questionText: string;
  questionType:
    | 'single_correct'
    | 'multiple_correct'
    | 'assertion_reason'
    | 'integer_type'
    | 'match_list';
  cognitiveLevel?: 'fact' | 'conceptual' | 'numerical' | 'assertion';
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
  explanation?: string;
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  hasDiagram: boolean;
  diagramDescription?: string;
  diagramImage?: string;
  structuredData?: any;
  examYear?: number;
  examType?: string;
}

export class VisionExtractionService {
  private visionApiKey: string;
  private _openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI;
  private tempDir: string;
  private diagramsDir: string;
  private currentBookId?: string; // Track book ID for cost tracking

  constructor() {
    this.visionApiKey = process.env.GOOGLE_VISION_API_KEY || '';
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.tempDir = path.join(__dirname, '../../temp-vision');
    this.diagramsDir = path.join(__dirname, '../../uploads/diagrams');
  }

  // Lazy-load OpenAI client only when needed
  private get openai(): OpenAI {
    if (!this._openai) {
      this._openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || '',
      });
    }
    return this._openai;
  }

  /**
   * Extract answer key from an image (e.g., page 12 with answers)
   * Returns object like { "1": "A", "2": "C", "3": "D", ... }
   */
  async extractAnswerKeyFromImage(imagePath: string): Promise<Record<string, string>> {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `Extract the answer key from this image. This page contains the correct answers for multiple-choice questions.

Look for patterns like:
- "1. A" or "Q1: A" or "1) A"
- "2. B" or "Q2: B" or "2) B"
- etc.

Return ONLY a JSON object mapping question numbers to answers:
{
  "1": "A",
  "2": "C",
  "3": "D",
  "4": "B",
  ...
}

IMPORTANT:
- Question numbers should be strings
- Answers should be single letters (A, B, C, D) in uppercase
- Extract ALL answers you can find on the page
- Return ONLY the JSON object, no other text`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const responseText = completion.choices[0]?.message?.content?.trim() || '{}';

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const answerKey = JSON.parse(jsonMatch[0]);
      console.log(`✅ Extracted ${Object.keys(answerKey).length} answers from answer key`);

      return answerKey;
    } catch (error: any) {
      console.error('Error extracting answer key:', error);
      throw new Error(`Failed to extract answer key: ${error.message}`);
    }
  }

  /**
   * Detect exam metadata from first page using AI (static method)
   */
  static async detectExamInfo(pdfPath: string): Promise<{
    examName: string | null;
    examYear: number | null;
    title: string | null;
    description: string | null;
    pyqType: 'subject_wise' | 'full_length' | null;
    subject: string | null;
  }> {
    console.log('\n🔍 Detecting exam metadata with AI...');

    // Declare variables outside try block for cleanup access
    let tempBookId: string | undefined;
    let tempService: VisionExtractionService | undefined;
    let pageImages: string[] = [];

    try {
      // Create temp instance with a temporary book ID for cleanup
      tempBookId = `temp-${Date.now()}`;
      tempService = new VisionExtractionService();
      pageImages = await tempService.convertPDFToImages(pdfPath, tempBookId);

      if (pageImages.length === 0) {
        console.log('⚠️  No pages found');
        // Cleanup temp images
        await tempService.cleanup(pageImages, tempBookId);
        return {
          examName: null,
          examYear: null,
          title: null,
          description: null,
          pyqType: null,
          subject: null,
        };
      }

      // Analyze first 2 pages to better detect full_length vs subject_wise
      const pagesToAnalyze = pageImages.slice(0, Math.min(2, pageImages.length));
      const imageBase64Array = await Promise.all(
        pagesToAnalyze.map((page) => fs.readFile(page, { encoding: 'base64' }))
      );

      const prompt = `Analyze these pages from a PYQ (Previous Year Questions) exam paper and extract ALL metadata.

CRITICAL: Determine if this is FULL_LENGTH or SUBJECT_WISE:

**FULL_LENGTH Papers:**
- Contains questions from MULTIPLE subjects (Physics, Chemistry, Botany, Zoology, Biology)
- Has section headers like "Physics", "Chemistry", "Botany", "Zoology"
- Questions cover different subjects throughout the paper
- Title might say "34 Years", "Complete Paper", "Full Test", etc.
- Example: NEET papers typically have Physics (50Q), Chemistry (50Q), Botany (50Q), Zoology (50Q)
- ⚠️ If you see MULTIPLE subject headings → pyqType: "full_length", subject: null

**SUBJECT_WISE Papers:**
- ONLY ONE subject throughout the entire paper
- Title explicitly mentions ONE subject: "Physics Only", "Chemistry PYQ", "Botany Questions"
- All questions are from the same subject
- ⚠️ If ONLY ONE subject → pyqType: "subject_wise", subject: "Physics" (or Chemistry, etc.)

Extract:
1. **Exam Name**: e.g., "NEET", "JEE Main", "JEE Advanced"
2. **Exam Year**: e.g., 2024, 2023, 2021
3. **PYQ Type**:
   - Check for section headers: If you see "Physics", "Chemistry", "Botany", "Zoology" sections → "full_length"
   - If only ONE subject visible → "subject_wise"
4. **Subject**:
   - If full_length → null
   - If subject_wise → the specific subject name
5. **Title**: Generate descriptive title:
   - Full length: "NEET {year} Full Length PYQ"
   - Subject wise: "NEET {year} {subject} PYQ"
6. **Description**: Brief description based on type

Return ONLY JSON:
{
  "examName": "NEET",
  "examYear": 2021,
  "title": "NEET 2021 Full Length PYQ",
  "description": "Complete NEET 2021 paper with all subjects: Physics, Chemistry, Botany, and Zoology",
  "pyqType": "full_length",
  "subject": null
}

OR for subject-wise:
{
  "examName": "NEET",
  "examYear": 2021,
  "title": "NEET 2021 Botany PYQ",
  "description": "NEET 2021 Botany questions only",
  "pyqType": "subject_wise",
  "subject": "Botany"
}`;

      // Create OpenAI client for static method
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || '',
      });

      // Build content array with text prompt + multiple images
      const messageContent: any[] = [
        { type: 'text', text: prompt },
        ...imageBase64Array.map((base64) => ({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64}`,
            detail: 'low', // Lower cost for metadata extraction
          },
        })),
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
        max_tokens: 300, // Increased for better descriptions
        temperature: 0,
      });

      const responseContent = completion.choices[0]?.message?.content || '';
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.log('⚠️  Could not parse exam info from response');
        return {
          examName: null,
          examYear: null,
          title: null,
          description: null,
          pyqType: null,
          subject: null,
        };
      }

      const examInfo = JSON.parse(jsonMatch[0]);
      console.log(
        `✅ Detected: ${examInfo.examName || 'Unknown'} ${examInfo.examYear || 'Unknown Year'}`
      );
      console.log(`   Title: ${examInfo.title || 'Not detected'}`);
      console.log(`   Type: ${examInfo.pyqType || 'Not detected'}`);
      console.log(`   Subject: ${examInfo.subject || 'Not detected'}`);

      // Cleanup temp images after detection
      await tempService.cleanup(pageImages, tempBookId);

      return {
        examName: examInfo.examName || null,
        examYear: examInfo.examYear || null,
        title: examInfo.title || null,
        description: examInfo.description || null,
        pyqType: examInfo.pyqType || null,
        subject: examInfo.subject || null,
      };
    } catch (error: any) {
      console.error('❌ Exam detection failed:', error.message);
      // Cleanup temp images on error
      try {
        if (tempService && pageImages && pageImages.length > 0 && tempBookId) {
          await tempService.cleanup(pageImages, tempBookId);
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup temp images:', cleanupError);
      }
      return {
        examName: null,
        examYear: null,
        title: null,
        description: null,
        pyqType: null,
        subject: null,
      };
    }
  }

  /**
   * Main extraction function - processes entire PDF
   */
  async extractPDF(pdfPath: string, bookId?: string): Promise<ExtractedQuestion[]> {
    console.log('🚀 Starting Vision API PDF extraction...');
    console.log('📄 PDF Path:', pdfPath);

    try {
      // Create temp and diagrams directories
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.diagramsDir, { recursive: true });

      // Step 1: Convert PDF to images
      console.log('\n📸 Step 1: Converting PDF pages to images...');
      if (bookId) await this.updateProgress(bookId, 5, 'Converting PDF to images');
      const pageImages = await this.convertPDFToImages(pdfPath, bookId);
      console.log(`✅ Converted ${pageImages.length} pages`);

      // Step 2: Process each page directly with GPT-4 Vision (more accurate than OCR)
      console.log('\n🤖 Step 2: Analyzing pages with GPT-4 Vision (direct image analysis)...');
      const allQuestions: ExtractedQuestion[] = [];
      const extractedNumbers = new Set<number>();
      const pageImageMap = new Map<number, string>(); // Map page number to image path
      let globalQuestionOffset = 0; // Track highest question number seen for sequential numbering

      for (let i = 0; i < pageImages.length; i++) {
        console.log(`   📄 Processing page ${i + 1}/${pageImages.length} with GPT-4 Vision...`);

        // Update progress (10-70% range for page processing)
        if (bookId) {
          const progressPercent = 10 + (i / pageImages.length) * 60;
          await this.updateProgress(
            bookId,
            progressPercent,
            `Analyzing page ${i + 1}/${pageImages.length}`
          );
        }

        // Pass global offset to maintain sequential numbering across sections
        const pageQuestions = await this.analyzePageWithVision(
          pageImages[i],
          i + 1,
          globalQuestionOffset
        );

        // Store page image path for diagram extraction
        pageImageMap.set(i + 1, pageImages[i]);

        // Update global offset after processing each page
        if (pageQuestions.length > 0) {
          const maxOnPage = Math.max(...pageQuestions.map((q) => q.questionNumber));
          globalQuestionOffset = Math.max(globalQuestionOffset, maxOnPage);
        }

        // Track question numbers
        pageQuestions.forEach((q) => extractedNumbers.add(q.questionNumber));
        allQuestions.push(...pageQuestions);

        if (pageQuestions.length > 0) {
          const questionNums = pageQuestions.map((q) => q.questionNumber).sort((a, b) => a - b);
          console.log(
            `      ✅ Found ${pageQuestions.length} questions: ${questionNums.join(', ')}`
          );
        } else {
          console.log(`      ℹ️  No questions found (might be answer key or instructions)`);
        }
      }

      const questions = allQuestions;
      console.log(`✅ Total extracted: ${questions.length} questions from all batches`);

      // Step 3: Extract diagrams using Gemini for questions that need them
      console.log('\n🎨 Step 3: Extracting diagrams with Gemini Vision...');
      if (bookId) await this.updateProgress(bookId, 70, 'Extracting diagrams');
      await this.processDiagramsWithGemini(questions, pageImageMap);
      console.log('✅ Diagram extraction complete');

      // Show which question numbers are missing
      const sortedNumbers = Array.from(extractedNumbers).sort((a, b) => a - b);
      const maxQuestion = Math.max(...sortedNumbers);
      const missing: number[] = [];
      for (let i = 1; i <= maxQuestion; i++) {
        if (!extractedNumbers.has(i)) {
          missing.push(i);
        }
      }

      if (missing.length > 0) {
        console.log(
          `⚠️  Missing question numbers (${missing.length}): ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '...' : ''}`
        );
      } else {
        console.log(`✅ All questions from 1 to ${maxQuestion} extracted successfully!`);
      }

      // Cleanup temp files
      await this.cleanup(pageImages, bookId);

      return questions;
    } catch (error) {
      console.error('❌ Extraction failed:', error);
      throw error;
    }
  }

  /**
   * Convert PDF to individual page images with automatic retry and fallback
   */
  private async convertPDFToImages(pdfPath: string, bookId?: string): Promise<string[]> {
    // Use book-specific directory to avoid conflicts
    const workDir = bookId ? path.join(this.tempDir, bookId) : this.tempDir;

    try {
      // Check if PDF file exists before processing
      try {
        await fs.access(pdfPath);
      } catch {
        throw new Error(
          `PDF file not found at path: ${pdfPath}. The file may have been deleted or moved.`
        );
      }

      // Ensure temp directory exists
      try {
        await fs.access(workDir);
      } catch {
        await fs.mkdir(workDir, { recursive: true });
        console.log(`   📁 Created temp directory: ${workDir}`);
      }

      // Try pdftoppm first
      try {
        await execAsync(`pdftoppm -png -r 300 "${pdfPath}" "${path.join(workDir, 'page')}"`);
        console.log('✅ PDF conversion successful using pdftoppm');
      } catch (pdftoppmError: any) {
        console.log('⚠️ pdftoppm not available, trying alternative methods...');

        // Check if it's a pdftoppm not found error
        if (
          pdftoppmError.message.includes('not recognized') ||
          pdftoppmError.message.includes('command not found') ||
          pdftoppmError.stderr?.includes('not recognized')
        ) {
          console.log('🔄 Attempting PDF conversion with Node.js fallback...');
          await this.convertPDFWithNodeFallback(pdfPath, workDir);
        } else {
          // Re-throw if it's a different error
          throw pdftoppmError;
        }
      }

      // Get list of generated images
      const files = await fs.readdir(workDir);
      const imageFiles = files
        .filter((f) => f.endsWith('.png'))
        .sort()
        .map((f) => path.join(workDir, f));

      if (imageFiles.length === 0) {
        throw new Error('No images were generated from PDF conversion');
      }

      console.log(`✅ Generated ${imageFiles.length} image(s) from PDF`);
      return imageFiles;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      throw new Error('Failed to convert PDF to images. Please check the PDF file and try again.');
    }
  }

  /**
   * Fallback PDF conversion method using Node.js libraries
   */
  private async convertPDFWithNodeFallback(pdfPath: string, workDir: string): Promise<void> {
    console.log('🔧 Trying alternative PDF conversion methods...');

    try {
      // Try to use pdf-poppler if available
      try {
        const pdfPoppler = require('pdf-poppler');

        const options = {
          format: 'png',
          out_dir: workDir,
          out_prefix: 'page',
          page: null, // convert all pages
          density: 300,
        };

        await pdfPoppler.convert(pdfPath, options);
        console.log('✅ PDF conversion successful using pdf-poppler fallback');
        return;
      } catch {
        console.log('⚠️ pdf-poppler not available');
      }

      // Try pdf2pic as another fallback
      try {
        const pdf2pic = require('pdf2pic');

        const convert = pdf2pic.fromPath(pdfPath, {
          density: 300,
          saveFilename: 'page',
          savePath: workDir,
          format: 'png',
          width: 2480,
          height: 3508,
        });

        await convert.bulk(-1); // convert all pages
        console.log('✅ PDF conversion successful using pdf2pic fallback');
        return;
      } catch {
        console.log('⚠️ pdf2pic not available');
      }

      // If all fallbacks fail, provide helpful error message
      console.log('❌ No suitable PDF conversion library found');
      throw new Error(
        `
PDF conversion requires one of the following tools:
1. pdftoppm (recommended) - Install poppler-utils
2. pdf-poppler npm package
3. pdf2pic npm package

For Windows, you can:
- Install poppler-utils from https://poppler.freedesktop.org/
- Or run: npm install pdf-poppler pdf2pic
      `.trim()
      );
    } catch (error) {
      console.error('All PDF conversion methods failed:', error);
      throw error;
    }
  }

  /**
   * Process single page with Google Vision API
   */
  private async processPageWithVision(imagePath: string): Promise<string> {
    try {
      // Read image as base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Call Google Vision API
      const response = await axios.post<VisionAPIResponse>(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.visionApiKey}`,
        {
          requests: [
            {
              image: {
                content: base64Image,
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        }
      );

      const result = response.data.responses[0];

      if (result.error) {
        console.error('Vision API error:', result.error);
        return '';
      }

      return result.fullTextAnnotation?.text || '';
    } catch (error) {
      console.error('Error processing page with Vision API:', error);
      return '';
    }
  }

  /**
   * Extract diagram images from pages
   */
  private async extractDiagrams(
    pageImages: string[]
  ): Promise<Array<{ path: string; page: number }>> {
    const diagrams: Array<{ path: string; page: number }> = [];

    for (let i = 0; i < pageImages.length; i++) {
      // For now, we'll store the page images themselves as potential diagrams
      // In production, you'd want to use image segmentation to extract specific diagrams
      diagrams.push({
        path: pageImages[i],
        page: i + 1,
      });
    }

    return diagrams;
  }

  /**
   * Update extraction progress in database
   */
  private async updateProgress(bookId: string, progress: number, step: string): Promise<void> {
    try {
      const { db } = require('../config/database');
      const { books } = require('../models/schema');
      const { eq } = require('drizzle-orm');

      await db
        .update(books)
        .set({
          extractionProgress: Math.min(100, Math.round(progress)),
          currentStep: step,
        })
        .where(eq(books.id, bookId));
    } catch (e) {
      // Don't throw - progress tracking failure shouldn't break extraction
      console.error('⚠️  Failed to update progress:', e);
    }
  }

  /**
   * Analyze page images directly with GPT-4 Vision
   */
  public async analyzePageWithVision(
    imagePath: string,
    pageNumber: number,
    previousHighestQuestion: number = 0
  ): Promise<ExtractedQuestion[]> {
    try {
      // Read image as base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `You are analyzing page ${pageNumber} of a NEET exam PDF. Extract EVERY question visible on this page.

CONTEXT: Previous pages contained questions numbered up to Q${previousHighestQuestion}.

CRITICAL NUMBERING INSTRUCTIONS:
- Look for question numbers shown in the PDF (e.g., "1.", "2.", etc.)
- If numbers restart (you see "1." but previous was ${previousHighestQuestion}):
  * This is a NEW SECTION (Physics → Chemistry, etc.)
  * ADD ${previousHighestQuestion} to the PDF number
  * Example: PDF shows "1" and previous was 100 → use questionNumber: 101
  * Example: PDF shows "5" and previous was 100 → use questionNumber: 105
- If continuing from previous section, use the PDF numbers as-is
- Question numbers MUST be sequential across the entire document
- NEVER use duplicate question numbers

CRITICAL EXTRACTION INSTRUCTIONS:
- Extract EVERY SINGLE question you can see on this page
- Include the complete question text, all options (A, B, C, D), and any context
- If you see diagrams, note them in the hasDiagram field
- If a question appears to continue from the previous page or continue to the next page, extract what you can see

For each question, provide a JSON object with:
- questionNumber: The number shown in the PDF
- questionText: Complete question text (for match-list, include "Match the List-I with List-II")
- questionType: "single_correct", "multiple_correct", "assertion_reason", "integer_type", or "match_list"
- optionA, optionB, optionC, optionD: The four matching options (e.g., "A-IV, B-III, C-I, D-II")
- subject: "Physics", "Chemistry", "Botany", or "Zoology"
- topic: Main topic name
- difficulty: "easy", "medium", or "hard"
- cognitiveLevel: Classify what cognitive skill this question tests:
  * "fact" - Tests factual recall/memory (e.g., "What is...", "Define...")
  * "conceptual" - Tests understanding of concepts (e.g., "Explain why...", "What happens when...")
  * "numerical" - Tests problem-solving with calculations (e.g., "Calculate...", "Find the value...")
  * "assertion" - Tests logical reasoning, typically assertion-reason format
- explanation: Extract the detailed explanation/solution if present in the PDF (leave empty string "" if not available)
- hasDiagram: true if there's a diagram/image
- diagramDescription: Brief description of any diagram

**SPECIAL: For MATCH-LIST questions:**
- questionType MUST be "match_list"
- structuredData MUST contain a JSON object with this EXACT format:
{
  "listATitle": "List-I (description from PDF)",
  "listBTitle": "List-II (description from PDF)",
  "listA": [
    {"key": "A", "value": "text for item A"},
    {"key": "B", "value": "text for item B"},
    {"key": "C", "value": "text for item C"},
    {"key": "D", "value": "text for item D"}
  ],
  "listB": [
    {"key": "I", "value": "text for item I"},
    {"key": "II", "value": "text for item II"},
    {"key": "III", "value": "text for item III"},
    {"key": "IV", "value": "text for item IV"}
  ]
}
- Extract the table data carefully preserving all mathematical notation, subscripts, superscripts
- optionA, optionB, optionC, optionD should contain the matching combinations (e.g., "A-IV, B-III, C-I, D-II")

Return ONLY a JSON array of questions, nothing else.`;

      const startTime = Date.now();
      const completion = await retryWithBackoff(
        () =>
          this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: prompt,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/png;base64,${base64Image}`,
                      detail: 'high',
                    },
                  },
                ],
              },
            ],
            max_tokens: 4096,
            temperature: 0.2,
          }),
        { maxRetries: 3, shouldRetry: isRetryableError }
      );

      // Track API cost
      if (this.currentBookId) {
        await ApiCostTracker.track({
          bookId: this.currentBookId,
          apiProvider: 'openai',
          modelName: 'gpt-4o',
          operationType: 'page_analysis',
          inputTokens: completion.usage?.prompt_tokens || 0,
          outputTokens: completion.usage?.completion_tokens || 0,
          pageNumber: pageNumber,
          processingTimeMs: Date.now() - startTime,
        });
      }

      const text = completion.choices[0]?.message?.content || '';

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log(`   ⚠️  No questions found on page ${pageNumber}`);
        return [];
      }

      const questions: ExtractedQuestion[] = JSON.parse(jsonMatch[0]);

      // Validate and fix numbering for section restarts
      const validatedQuestions = questions.map((q) => {
        // If question number <= previousHighestQuestion, this is a section restart
        if (q.questionNumber <= previousHighestQuestion) {
          const originalNumber = q.questionNumber;
          const newNumber = previousHighestQuestion + originalNumber;
          console.log(
            `   🔢 Q${originalNumber} → Q${newNumber} (section restart detected on page ${pageNumber})`
          );
          q.questionNumber = newNumber;
        }
        return q;
      });

      return validatedQuestions;
    } catch (error) {
      console.error(`Error analyzing page ${pageNumber} with GPT-4 Vision:`, error);
      return [];
    }
  }

  /**
   * Analyze extracted text with AI (Fallback method - less accurate)
   */
  private async analyzeWithAI(
    visionText: string,
    diagrams: Array<{ path: string; page: number }>
  ): Promise<ExtractedQuestion[]> {
    const prompt = `You are an expert NEET question extraction system. Analyze the following text extracted from a NEET exam PDF using Google Vision API.

TEXT FROM PDF:
${visionText}

CRITICAL INSTRUCTIONS:
- You MUST extract EVERY SINGLE question from the text above
- Do NOT skip ANY questions, even if they seem difficult or incomplete
- If a question continues across multiple pages, combine all parts
- Extract questions sequentially in the order they appear
- If you're unsure about a question, include it anyway with a note

Your task is to extract ALL questions from this text with complete accuracy. For each question, provide:

1. **Question Number** (1-200)
2. **Question Text** - Complete question including any context
3. **Question Type** - Determine if it's:
   - single_correct (one answer)
   - multiple_correct (multiple answers)
   - assertion_reason (statement-based)
   - integer_type (numerical answer)
   - match_list (match columns A and B)

4. **Options** - Extract all 4 options (A, B, C, D) if present
5. **Correct Answer** - The correct option(s). If not explicitly stated, analyze and determine it. If uncertain, set to null
6. **Subject** - Physics, Chemistry, Botany, or Zoology
7. **Topic** - Main topic (e.g., "Mechanics", "Organic Chemistry", "Cell Biology")
8. **Subtopic** - Specific subtopic if identifiable
9. **Difficulty** - Analyze complexity and classify as easy, medium, or hard
10. **Explanation** - Provide detailed explanation of the solution
11. **Has Diagram** - true if question references a diagram/figure
12. **Diagram Description** - Describe any diagram (e.g., "Circuit diagram with resistors in series")
13. **Structured Data** - For match-list questions, extract the table structure as JSON
14. **Exam Year** - Extract from markers like [NEET 2020] if present
15. **Exam Type** - Extract exam type if mentioned

SPECIAL HANDLING:
- **Match List Questions**: Structure as JSON:
  \`\`\`json
  {
    "type": "match_list",
    "columnA": ["Item 1", "Item 2", "Item 3", "Item 4"],
    "columnB": ["Match 1", "Match 2", "Match 3", "Match 4"],
    "correctMatches": {"1": "a", "2": "b", "3": "c", "4": "d"}
  }
  \`\`\`

- **Equations**: Preserve mathematical notation using LaTeX format: $E = mc^2$, $\\frac{1}{2}mv^2$
- **Chemical Formulas**: Use proper notation: H₂O, CO₂, CH₃COOH
- **Physics Symbols**: Preserve symbols: Ω, μ, π, Δ, etc.

IMPORTANT:
- Extract EVERY question, don't skip any
- If correct answer is not in PDF, analyze the question and determine it
- If you cannot determine answer with confidence, set correctAnswer to null
- Maintain question numbering exactly as in PDF
- Handle OCR errors and correct obvious mistakes

OUTPUT FORMAT:
Return a JSON array of questions. Example:
\`\`\`json
[
  {
    "questionNumber": 1,
    "questionText": "A body of mass 2 kg...",
    "questionType": "single_correct",
    "optionA": "5 m/s",
    "optionB": "10 m/s",
    "optionC": "15 m/s",
    "optionD": "20 m/s",
    "correctAnswer": "B",
    "explanation": "Using v = u + at...",
    "subject": "Physics",
    "topic": "Mechanics",
    "subtopic": "Kinematics",
    "difficulty": "medium",
    "hasDiagram": false,
    "diagramDescription": null,
    "structuredData": null,
    "examYear": 2024,
    "examType": "NEET"
  }
]
\`\`\`

Begin extraction:`;

    try {
      // Use OpenAI GPT-4 for AI analysis
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert NEET question extraction system. You MUST extract EVERY SINGLE question from the provided text. Do not skip any questions. Extract all of them completely.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 16384, // Max tokens for gpt-4o-mini output
      });

      const text = completion.choices[0]?.message?.content || '';

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response');
      }

      const questions: ExtractedQuestion[] = JSON.parse(jsonMatch[0]);

      // Post-process: link diagrams to questions
      questions.forEach((q) => {
        if (q.hasDiagram) {
          // Find closest diagram by page number
          // This is simplified - in production, use more sophisticated matching
          const diagram = diagrams.find((d) => Math.abs(d.page - q.questionNumber / 6) < 1);
          if (diagram) {
            q.diagramImage = diagram.path;
          }
        }
      });

      return questions;
    } catch (error) {
      console.error('Error analyzing with AI:', error);
      throw error;
    }
  }

  /**
   * Process diagrams for questions using Gemini Vision
   */
  private async processDiagramsWithGemini(
    questions: ExtractedQuestion[],
    pageImageMap: Map<number, string>
  ): Promise<void> {
    // Find questions that need diagrams
    const questionsWithDiagrams = questions.filter((q) => q.hasDiagram && !q.diagramImage);

    if (questionsWithDiagrams.length === 0) {
      console.log('   ℹ️  No diagrams to extract');
      return;
    }

    console.log(`   📊 Found ${questionsWithDiagrams.length} questions with diagrams`);

    // Get Gemini model (using gemini-1.5-flash-latest for image analysis)
    const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    let diagramSuccessCount = 0;
    let diagramFailCount = 0;

    for (const question of questionsWithDiagrams) {
      try {
        // Find the page this question is on (estimate based on question number)
        // Assuming ~6-8 questions per page
        const estimatedPage = Math.ceil(question.questionNumber / 7);
        const pageImagePath = pageImageMap.get(estimatedPage);

        if (!pageImagePath) {
          console.log(`   ⚠️  Q${question.questionNumber}: No page image found`);
          continue;
        }

        console.log(`   🎨 Q${question.questionNumber}: Extracting diagram using Gemini...`);

        // Read the page image
        const imageBuffer = await fs.readFile(pageImagePath);
        const base64Image = imageBuffer.toString('base64');

        // Call Gemini to extract the diagram
        const prompt = `You are analyzing a NEET exam PDF page that contains Question ${question.questionNumber}.

This question has a diagram described as: "${question.diagramDescription || 'diagram/image/figure'}"

Your task: Extract ONLY the diagram/image/figure portion that belongs to this question and return it.

Instructions:
1. Locate Question ${question.questionNumber} on this page
2. Identify the diagram/image/figure that belongs to this question
3. The diagram might be:
   - A flowchart, circuit diagram, or process diagram
   - A biological structure or anatomical diagram
   - A graph, chart, or plot
   - A chemical structure or reaction diagram
   - Any visual element that is part of the question

4. Return a description of where the diagram is located and what it contains

Please describe:
- Location of the diagram on the page (top/middle/bottom, left/right)
- What the diagram shows
- Size and boundaries of the diagram
- Any labels or annotations in the diagram`;

        const result = await retryWithBackoff(
          () =>
            model.generateContent([
              {
                inlineData: {
                  data: base64Image,
                  mimeType: 'image/png',
                },
              },
              prompt,
            ]),
          { maxRetries: 2, shouldRetry: isRetryableError }
        );

        const response = result.response.text();
        console.log(`      ✅ Gemini response: ${response.substring(0, 150)}...`);

        // For now, we'll store the response as diagram description
        // In production, you'd extract coordinates and crop the image
        // For this implementation, we'll save the full page as the diagram
        // You can enhance this later to actually crop based on Gemini's analysis

        // Save the diagram (for now, using the full page - can be enhanced to crop)
        const diagramFilename = `q${question.questionNumber}-diagram-${Date.now()}.png`;
        const diagramPath = path.join(this.diagramsDir, diagramFilename);

        // Copy the page image to diagrams directory
        await fs.copyFile(pageImagePath, diagramPath);

        // Update question with diagram path (relative to uploads folder)
        question.diagramImage = `/uploads/diagrams/${diagramFilename}`;

        diagramSuccessCount++;
        console.log(`      ✅ Q${question.questionNumber}: Diagram saved`);
      } catch (error: any) {
        diagramFailCount++;
        const errorMessage = error.message || String(error);
        console.error(
          `      ❌ Q${question.questionNumber}: Failed to extract diagram:`,
          errorMessage
        );

        // Set descriptive error message - don't fail the entire extraction
        question.diagramDescription = `[Diagram extraction failed: ${errorMessage.substring(0, 100)}]`;
        // Keep hasDiagram = true so we know it should have one
      }
    }

    // Display summary
    console.log(
      `\n   ✅ Diagram extraction: ${diagramSuccessCount} success, ${diagramFailCount} failed out of ${questionsWithDiagrams.length}`
    );
  }

  /**
   * Cleanup temporary files and directories
   */
  private async cleanup(files: string[], bookId?: string): Promise<void> {
    try {
      // Delete individual files
      for (const file of files) {
        await fs.unlink(file).catch(() => {});
      }

      // If bookId provided, clean up book-specific directory
      if (bookId) {
        const bookDir = path.join(this.tempDir, bookId);
        await this.cleanupDirectory(bookDir);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Recursively delete a directory and its contents
   */
  private async cleanupDirectory(dirPath: string): Promise<void> {
    try {
      // Check if directory exists
      await fs.access(dirPath);

      // Read directory contents
      const files = await fs.readdir(dirPath);

      // Delete all files in directory
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
          // Recursively delete subdirectory
          await this.cleanupDirectory(filePath);
        } else {
          // Delete file
          await fs.unlink(filePath).catch(() => {});
        }
      }

      // Remove the now-empty directory
      await fs.rmdir(dirPath).catch(() => {});
      console.log(`   🧹 Cleaned up directory: ${dirPath}`);
    } catch {
      // Directory doesn't exist or already cleaned up - ignore
    }
  }

  /**
   * Verify and enhance answer using AI
   */
  async verifyAnswer(
    questionText: string,
    options: string[],
    providedAnswer?: string
  ): Promise<string | null> {
    const prompt = `Analyze this NEET question and determine the correct answer.

Question: ${questionText}

Options:
A) ${options[0]}
B) ${options[1]}
C) ${options[2]}
D) ${options[3]}

${providedAnswer ? `Provided Answer: ${providedAnswer}` : ''}

Your task:
1. Solve the question step by step
2. Determine the correct answer
3. ${providedAnswer ? `Verify if the provided answer is correct` : 'Provide the answer'}

Respond with ONLY the letter of the correct answer (A, B, C, or D) or "UNCERTAIN" if you cannot determine with confidence.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a NEET exam expert. Analyze questions and provide correct answers.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
      });

      const text = completion.choices[0]?.message?.content || '';
      const answer = text.trim().toUpperCase();
      return ['A', 'B', 'C', 'D'].includes(answer) ? answer : null;
    } catch (error) {
      console.error('Error verifying answer:', error);
      return null;
    }
  }

  /**
   * Generate explanation for a question using AI
   */
  async generateExplanation(
    questionText: string,
    options: string[],
    correctAnswer: string
  ): Promise<string> {
    const prompt = `Provide a detailed, student-friendly explanation for this NEET question.

Question: ${questionText}

Options:
A) ${options[0]}
B) ${options[1]}
C) ${options[2]}
D) ${options[3]}

Correct Answer: ${correctAnswer}

Provide:
1. Step-by-step solution
2. Key concepts involved
3. Common mistakes to avoid
4. Memory tips if applicable

Keep explanation clear and concise (3-5 sentences).`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a NEET exam tutor. Provide clear, student-friendly explanations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      const text = completion.choices[0]?.message?.content || '';
      return text.trim();
    } catch (error) {
      console.error('Error generating explanation:', error);
      return '';
    }
  }

  /**
   * Generate diagram for a specific question using OpenAI Vision
   * Used for manual diagram generation after PDF extraction
   */
  async generateDiagramForQuestion(
    pdfPath: string,
    questionNumber: number,
    diagramDescription: string,
    manualPageNumber?: number
  ): Promise<string> {
    const tempFiles: string[] = [];

    try {
      console.log(`   📸 Converting PDF to images for question ${questionNumber}...`);

      // Convert PDF to images
      const pageImages = await this.convertPDFToImages(pdfPath);
      tempFiles.push(...pageImages);

      // Determine which page to use
      let targetPage: number;
      if (manualPageNumber) {
        // Use manually specified page number
        targetPage = manualPageNumber;
        console.log(`   📍 Using manual page number: ${targetPage}`);
      } else {
        // Estimate which page this question is on (assuming ~7 questions per page)
        targetPage = Math.ceil(questionNumber / 7);
        console.log(
          `   📊 Estimated page number: ${targetPage} (based on question ${questionNumber})`
        );
      }

      const pageIndex = targetPage - 1; // Array is 0-indexed

      if (pageIndex < 0 || pageIndex >= pageImages.length) {
        const errorMsg = `Page ${targetPage} is out of range (PDF has ${pageImages.length} pages). ${manualPageNumber ? 'Please specify a valid page number.' : `Question ${questionNumber} might be on a different page. Try specifying the page number manually.`}`;
        console.error(`   ❌ ${errorMsg}`);
        await this.cleanup(tempFiles);
        throw new Error(errorMsg);
      }

      const pageImagePath = pageImages[pageIndex];
      console.log(`   🔍 Analyzing page ${targetPage} with OpenAI Vision...`);

      // Read the page image
      const imageBuffer = await fs.readFile(pageImagePath);
      const base64Image = imageBuffer.toString('base64');

      // Use OpenAI GPT-4 Vision to analyze the diagram
      const prompt = `You are analyzing a NEET exam PDF page that contains Question ${questionNumber}.

This question has a diagram described as: "${diagramDescription}"

Please confirm that you can see Question ${questionNumber} and its associated diagram on this page. Provide a brief description of what you see.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'low', // Using 'low' for faster processing
                },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
      });

      const response = completion.choices[0]?.message?.content || '';
      console.log(`   ✅ OpenAI Vision analyzed the page: ${response.substring(0, 100)}...`);

      // Save the diagram (for now, using the full page - can be enhanced to crop)
      const diagramFilename = `q${questionNumber}-diagram-${Date.now()}.png`;
      const diagramPath = path.join(this.diagramsDir, diagramFilename);

      // Ensure diagrams directory exists
      try {
        await fs.access(this.diagramsDir);
      } catch {
        await fs.mkdir(this.diagramsDir, { recursive: true });
      }

      // Copy the page image to diagrams directory
      await fs.copyFile(pageImagePath, diagramPath);

      // Cleanup temporary files
      await this.cleanup(tempFiles);

      // Return the relative path for database storage
      return `/uploads/diagrams/${diagramFilename}`;
    } catch (error: any) {
      console.error(`   ❌ Failed to generate diagram:`, error.message);
      console.error(`   📋 Error details:`, JSON.stringify(error, null, 2));
      console.error(`   📚 Full error:`, error);
      // Cleanup temporary files on error
      await this.cleanup(tempFiles);
      // Re-throw the error with a more user-friendly message
      throw new Error(error.message || 'Failed to generate diagram using Gemini AI');
    }
  }

  /**
   * Crop an existing diagram image
   */
  async cropDiagram(
    imagePath: string,
    cropData: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    try {
      console.log(`   ✂️  Cropping diagram...`);
      console.log(
        `   📐 Crop area: x=${cropData.x}, y=${cropData.y}, w=${cropData.width}, h=${cropData.height}`
      );

      // Read the original image to get its dimensions
      const imageBuffer = await fs.readFile(imagePath);
      const metadata = await sharp(imageBuffer).metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Could not read image dimensions');
      }

      console.log(`   📏 Original image: ${metadata.width}x${metadata.height}px`);

      // Validate crop coordinates
      if (
        cropData.x < 0 ||
        cropData.y < 0 ||
        cropData.x + cropData.width > metadata.width ||
        cropData.y + cropData.height > metadata.height
      ) {
        throw new Error('Crop coordinates are out of bounds');
      }

      // Create cropped filename
      const timestamp = Date.now();
      const originalFilename = path.basename(imagePath);
      const croppedFilename = originalFilename.replace(/\.png$/, `-cropped-${timestamp}.png`);
      const croppedPath = path.join(this.diagramsDir, croppedFilename);

      // Ensure diagrams directory exists
      try {
        await fs.access(this.diagramsDir);
      } catch {
        await fs.mkdir(this.diagramsDir, { recursive: true });
      }

      // Crop and save
      await sharp(imageBuffer)
        .extract({
          left: Math.round(cropData.x),
          top: Math.round(cropData.y),
          width: Math.round(cropData.width),
          height: Math.round(cropData.height),
        })
        .toFile(croppedPath);

      console.log(`   ✅ Cropped diagram saved: ${croppedFilename}`);

      // Return the relative path for database storage
      return `/uploads/diagrams/${croppedFilename}`;
    } catch (error: any) {
      console.error(`   ❌ Failed to crop diagram:`, error.message);
      throw new Error(`Failed to crop diagram: ${error.message}`);
    }
  }

  /**
   * Validate if a question is complete and ready to be active
   */
  private static isQuestionComplete(question: ExtractedQuestion): boolean {
    // Check required fields
    if (!question.questionText || question.questionText.trim().length < 10) {
      return false;
    }

    if (!question.subject || !question.topic) {
      return false;
    }

    // For single/multiple correct questions, check if options exist
    if (
      (question.questionType === 'single_correct' ||
        question.questionType === 'multiple_correct') &&
      (!question.optionA || !question.optionB || !question.optionC || !question.optionD)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Process book asynchronously - for use with book upload endpoint
   */
  static processBookAsync(bookId: string): void {
    // Process in background (don't await)
    setTimeout(() => {
      this.processBook(bookId).catch((error) => {
        console.error('Background processing error:', error);
      });
    }, 1000);
  }

  /**
   * Process specific pages on demand - for manual page-by-page processing
   */
  static async processSpecificPages(bookId: string, pageNumbers: number[]): Promise<void> {
    const { db } = require('../config/database');
    const { books, pageExtractionResults, questions: questionsTable } = require('../models/schema');
    const { eq, inArray, and } = require('drizzle-orm');

    try {
      console.log(`📚 Processing ${pageNumbers.length} specific page(s) for book ${bookId}`);

      // Get book details
      const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

      if (!book) {
        throw new Error('Book not found');
      }

      // Get the page extraction results for these pages
      const pages = await db
        .select()
        .from(pageExtractionResults)
        .where(
          and(
            eq(pageExtractionResults.bookId, bookId),
            inArray(pageExtractionResults.pageNumber, pageNumbers)
          )
        );

      if (pages.length === 0) {
        throw new Error('No pages found for the specified page numbers');
      }

      // Process each page
      const service = new VisionExtractionService();
      service.currentBookId = bookId;

      for (const page of pages) {
        console.log(`\n📄 Processing page ${page.pageNumber}...`);

        if (!page.pageImagePath) {
          console.log(`⚠️  No image path for page ${page.pageNumber}, skipping`);
          continue;
        }

        try {
          // Update page status to processing
          await db
            .update(pageExtractionResults)
            .set({ status: 'processing' })
            .where(eq(pageExtractionResults.id, page.id));

          // Convert URL path back to absolute file system path
          // URL path: /temp-vision/bookId/page-01.png
          // Absolute path: D:\...\backend\temp-vision\bookId\page-01.png
          const backendDir = path.join(__dirname, '../..');
          const relativeFilePath = page.pageImagePath.substring(1).replace(/\//g, path.sep); // Remove leading '/' and convert to OS separators
          const absoluteFilePath = path.join(backendDir, relativeFilePath);

          // Analyze page with Vision API to extract questions
          const questions = await service.analyzePageWithVision(
            absoluteFilePath,
            page.pageNumber,
            0 // globalQuestionOffset - start from 0 for individual page processing
          );

          console.log(`✅ Extracted ${questions.length} questions from page ${page.pageNumber}`);

          // Save questions to database as draft (pending review)
          for (const question of questions) {
            await db.insert(questionsTable).values({
              bookId,
              ...question,
              isActive: false, // Draft - requires admin review before going live
            });
          }

          // Update page extraction result
          await db
            .update(pageExtractionResults)
            .set({
              status: 'success',
              questionsExtracted: questions.length,
              extractedQuestions: JSON.stringify(questions.map((q) => q.questionNumber)),
            })
            .where(eq(pageExtractionResults.id, page.id));
        } catch (error: any) {
          console.error(`❌ Error processing page ${page.pageNumber}:`, error);

          // Update page status to failed
          await db
            .update(pageExtractionResults)
            .set({
              status: 'failed',
              errorMessage: error.message,
            })
            .where(eq(pageExtractionResults.id, page.id));
        }
      }

      // Update book's total questions count
      const [{ count: totalQuestions }] = await db
        .select({ count: require('drizzle-orm').sql`COUNT(*)::int` })
        .from(questionsTable)
        .where(eq(questionsTable.bookId, bookId));

      await db
        .update(books)
        .set({
          totalQuestionsExtracted: totalQuestions,
        })
        .where(eq(books.id, bookId));

      console.log(`\n✅ Completed processing ${pageNumbers.length} page(s)`);
    } catch (error: any) {
      console.error('❌ Process specific pages error:', error);
      throw error;
    }
  }

  /**
   * Split PDF into pages WITHOUT extraction - for preview mode
   * Creates page extraction result records with status 'pending'
   */
  static async splitPDFToPagesOnly(bookId: string): Promise<void> {
    const { db } = require('../config/database');
    const { books, pageExtractionResults } = require('../models/schema');
    const { eq } = require('drizzle-orm');

    try {
      // Get book details
      const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

      if (!book) {
        throw new Error('Book not found');
      }

      console.log(`📚 Splitting PDF into pages: ${book.title}`);
      console.log(`📄 File: ${book.filePath}`);

      // Update status to processing (just for PDF split)
      await db
        .update(books)
        .set({
          uploadStatus: 'processing',
          currentStep: 'Splitting PDF into pages',
        })
        .where(eq(books.id, bookId));

      // Convert PDF to images with book-specific directory
      const service = new VisionExtractionService();
      const pageImages = await service.convertPDFToImages(book.filePath, bookId);

      console.log(`✅ Generated ${pageImages.length} page image(s)`);

      // Create page extraction result records with status 'pending'
      const allPageNumbers: number[] = [];
      for (let i = 0; i < pageImages.length; i++) {
        const pageNumber = i + 1;
        const absolutePath = pageImages[i];

        // Convert absolute path to relative URL path for serving via express.static
        // Example: D:\...\backend\temp-vision\bookId\page-01.png -> /temp-vision/bookId/page-01.png
        const backendDir = path.join(__dirname, '../..');
        const relativePath = path.relative(backendDir, absolutePath);
        const urlPath = '/' + relativePath.replace(/\\/g, '/'); // Convert Windows backslashes to forward slashes

        await db.insert(pageExtractionResults).values({
          bookId,
          pageNumber,
          pageImagePath: urlPath,
          status: 'pending',
          questionsExtracted: 0,
          retryCount: 0,
        });

        allPageNumbers.push(pageNumber);
        console.log(`📄 Page ${pageNumber}: ${path.basename(absolutePath)} -> ${urlPath}`);
      }

      console.log(`✅ PDF split complete. ${pageImages.length} pages ready for processing.`);
      console.log(`🚀 Starting automatic processing of all pages...`);

      // Automatically start processing all pages
      // This runs in the background, so the user can also manually process individual pages
      setTimeout(() => {
        this.processSpecificPages(bookId, allPageNumbers).catch((error) => {
          console.error('Auto-processing error:', error);
        });
      }, 1000);
    } catch (error: any) {
      console.error('❌ PDF split error:', error);

      // Update book status to failed
      await db
        .update(books)
        .set({
          uploadStatus: 'failed',
          errorMessage: error.message,
        })
        .where(eq(books.id, bookId));

      throw error;
    }
  }

  /**
   * Process uploaded book and extract questions with automatic retry
   */
  static async processBook(bookId: string, retryCount = 0): Promise<void> {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 5000; // 5 seconds

    // Import db and schema here to avoid circular dependencies
    const { db } = require('../config/database');
    const { books, questions: questionsTable } = require('../models/schema');
    const { eq } = require('drizzle-orm');

    try {
      // Get book details
      const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);

      if (!book) {
        throw new Error('Book not found');
      }

      // Update status to processing
      await db
        .update(books)
        .set({
          uploadStatus: 'processing',
          processingStartedAt: new Date(),
          errorMessage: null, // Clear any previous error
        })
        .where(eq(books.id, bookId));

      console.log(
        `📚 Processing book: ${book.title} ${retryCount > 0 ? `(Retry ${retryCount}/${MAX_RETRIES})` : ''}`
      );
      console.log(`📄 File: ${book.filePath}`);

      // Use Vision API extraction
      const service = new VisionExtractionService();
      service.currentBookId = bookId; // Set book ID for cost tracking
      const questions = await service.extractPDF(book.filePath, bookId); // Pass bookId for progress tracking

      console.log(`✅ Extracted ${questions.length} questions`);

      // Save questions to database
      await db
        .update(books)
        .set({
          extractionProgress: 85,
          currentStep: 'Saving to database',
        })
        .where(eq(books.id, bookId));

      let savedCount = 0;
      let activeCount = 0;
      let inactiveCount = 0;
      const saveErrors: Array<{
        questionNumber: number;
        error: string;
        questionType?: string;
      }> = [];

      for (const question of questions) {
        try {
          // Validate if question is complete
          const isComplete = this.isQuestionComplete(question);

          await db.insert(questionsTable).values({
            bookId: bookId,
            subject: question.subject?.toLowerCase() || 'unknown',
            topic: question.topic || 'Unknown',
            subtopic: question.subtopic || null,
            examYear: question.examYear || null,
            examType: question.examType || null,
            questionText:
              question.questionText ||
              `Question ${question.questionNumber} - Incomplete extraction`,
            questionImage: question.diagramImage || null,
            questionType: question.questionType || 'single_correct',
            cognitiveLevel: question.cognitiveLevel || null,
            optionA: question.optionA || null,
            optionB: question.optionB || null,
            optionC: question.optionC || null,
            optionD: question.optionD || null,
            correctAnswer: question.correctAnswer || 'PENDING',
            explanation: question.explanation || null,
            difficulty: question.difficulty || 'medium',
            questionNumber: question.questionNumber,
            isActive: false, // Draft - all questions require admin review before going live
            hasDiagram: question.hasDiagram || false,
            diagramDescription: question.diagramDescription || null,
            structuredData: question.structuredData
              ? JSON.stringify(question.structuredData)
              : null,
          });

          savedCount++;
          if (isComplete) {
            activeCount++;
          } else {
            inactiveCount++;
            console.log(
              `   ⚠️  Question ${question.questionNumber} saved as INACTIVE (incomplete)`
            );
          }
        } catch (error: any) {
          const errorMessage = error.message || String(error);
          console.error(`   ❌ Failed to save Q${question.questionNumber}:`, errorMessage);

          saveErrors.push({
            questionNumber: question.questionNumber,
            error: errorMessage,
            questionType: question.questionType,
          });

          // Detailed enum error logging
          if (errorMessage.includes('invalid input value for enum')) {
            console.error(`      🔍 Enum error: questionType="${question.questionType}"`);
            console.error(
              `      Valid values: single_correct, multiple_correct, assertion_reason, integer_type, match_list`
            );
          }
        }
      }

      // Create placeholder questions for missing numbers
      const extractedNumbers = new Set(questions.map((q) => q.questionNumber));
      const maxQuestion = Math.max(...Array.from(extractedNumbers));
      const missingNumbers: number[] = [];

      for (let i = 1; i <= maxQuestion; i++) {
        if (!extractedNumbers.has(i)) {
          missingNumbers.push(i);
        }
      }

      let placeholderCount = 0;
      if (missingNumbers.length > 0) {
        console.log(
          `\n📝 Creating ${missingNumbers.length} placeholder questions for missing numbers...`
        );

        for (const qNum of missingNumbers) {
          try {
            await db.insert(questionsTable).values({
              bookId: bookId,
              subject: 'unknown',
              topic: 'Unknown',
              subtopic: null,
              examYear: book.examYear || null,
              examType: book.examType || null,
              questionText: `Question ${qNum} - NOT EXTRACTED (needs manual entry)`,
              questionImage: null,
              questionType: 'single_correct',
              optionA: null,
              optionB: null,
              optionC: null,
              optionD: null,
              correctAnswer: 'PENDING',
              explanation: null,
              difficulty: 'medium',
              questionNumber: qNum,
              isActive: false, // Placeholder - needs manual review
              hasDiagram: false,
              diagramDescription: null,
              structuredData: null,
            });
            placeholderCount++;
          } catch (error: any) {
            console.error(`Failed to create placeholder for question ${qNum}:`, error.message);
          }
        }
      }

      console.log(`\n📊 Extraction Summary:`);
      console.log(`   ✅ Successfully saved: ${savedCount}/${questions.length}`);
      console.log(`   ✅ Active (ready to use): ${activeCount}`);
      console.log(`   ⚠️  Inactive (needs review): ${inactiveCount}`);
      console.log(`   📝 Placeholders (missing): ${placeholderCount}`);

      // Error summary
      if (saveErrors.length > 0) {
        console.log(`\n❌ Save Errors (${saveErrors.length} failed):`);

        // Group by error type
        const errorsByType: Record<string, number[]> = {};
        saveErrors.forEach(({ questionNumber, error }) => {
          const errorType = error.split(':')[0] || 'Unknown';
          if (!errorsByType[errorType]) errorsByType[errorType] = [];
          errorsByType[errorType].push(questionNumber);
        });

        Object.entries(errorsByType).forEach(([type, qNums]) => {
          console.log(`   ${type}: Q${qNums.join(', Q')}`);
        });

        // Show first 3 detailed errors
        if (saveErrors.length > 0) {
          console.log(`\n   First ${Math.min(3, saveErrors.length)} detailed error(s):`);
          saveErrors.slice(0, 3).forEach(({ questionNumber, error, questionType }) => {
            console.log(`   Q${questionNumber} (${questionType}): ${error}`);
          });
        }
      }

      // Create section extraction results by grouping questions by subject
      console.log(`\n📦 Creating section extraction results...`);
      const { sectionExtractionResults, pageExtractionResults } = require('../models/schema');

      // Group questions by subject
      const questionsBySubject: Record<string, typeof questions> = {};
      questions.forEach((q) => {
        const subject = q.subject || 'unknown';
        if (!questionsBySubject[subject]) {
          questionsBySubject[subject] = [];
        }
        questionsBySubject[subject].push(q);
      });

      // Get page extraction results to determine page ranges
      const pageResults = await db
        .select()
        .from(pageExtractionResults)
        .where(eq(pageExtractionResults.bookId, bookId));

      // Create section results for each subject
      for (const [subject, subjectQuestions] of Object.entries(questionsBySubject)) {
        // Find pages that contain questions from this subject
        const questionNumbers = subjectQuestions.map((q: any) => q.questionNumber);
        const relevantPages = pageResults.filter((page: any) => {
          const extractedQuestions = JSON.parse(page.extractedQuestions || '[]');
          return extractedQuestions.some((qNum: number) => questionNumbers.includes(qNum));
        });

        if (relevantPages.length > 0) {
          const pageNums = relevantPages
            .map((p: any) => p.pageNumber)
            .sort((a: number, b: number) => a - b);
          const startPage = Math.min(...pageNums);
          const endPage = Math.max(...pageNums);

          // Calculate missing questions for this subject
          const extractedNums = new Set(subjectQuestions.map((q) => q.questionNumber));
          const minQ = Math.min(...Array.from(extractedNums));
          const maxQ = Math.max(...Array.from(extractedNums));
          const missingInSection: number[] = [];

          for (let i = minQ; i <= maxQ; i++) {
            if (!extractedNums.has(i)) {
              missingInSection.push(i);
            }
          }

          const expectedCount = maxQ - minQ + 1;
          const status =
            missingInSection.length === 0
              ? 'complete'
              : missingInSection.length < expectedCount / 2
                ? 'partial'
                : 'failed';

          try {
            await db.insert(sectionExtractionResults).values({
              bookId: bookId,
              subject: subject,
              startPage,
              endPage,
              expectedQuestions: expectedCount,
              extractedQuestions: subjectQuestions.length,
              missingQuestionNumbers: JSON.stringify(missingInSection),
              status,
            });

            console.log(
              `   ✅ ${subject}: Pages ${startPage}-${endPage}, ${subjectQuestions.length}/${expectedCount} questions (${status})`
            );
          } catch (error: any) {
            console.error(`   ❌ Failed to create section for ${subject}:`, error.message);
          }
        }
      }

      // Update book status with accurate message
      const statusMessage =
        saveErrors.length > 0
          ? `Completed with ${saveErrors.length} errors. ${savedCount}/${questions.length} saved.`
          : null;

      await db
        .update(books)
        .set({
          uploadStatus: saveErrors.length > questions.length / 2 ? 'failed' : 'completed',
          errorMessage: statusMessage,
          totalQuestionsExtracted: savedCount,
          extractionProgress: 100,
          currentStep: 'Completed',
          processingCompletedAt: new Date(),
        })
        .where(eq(books.id, bookId));

      // Display API cost summary
      const costSummary = await ApiCostTracker.getBookCostSummary(bookId);
      if (costSummary.totalCalls > 0) {
        console.log(`\n💰 API Cost Summary:`);
        console.log(`   Total: $${costSummary.totalCost.toFixed(4)}`);
        console.log(`   Tokens: ${costSummary.totalTokens.toLocaleString()}`);
        console.log(
          `   Calls: ${costSummary.successfulCalls} success, ${costSummary.failedCalls} failed`
        );
        console.log(
          `   OpenAI: ${costSummary.byProvider.openai} calls, Gemini: ${costSummary.byProvider.gemini} calls`
        );
      }

      if (saveErrors.length > 0) {
        console.log(
          `\n⚠️  Processing completed with ${saveErrors.length} error(s): ${savedCount}/${questions.length} questions saved`
        );
      } else {
        console.log(`\n✅ Processing completed successfully: ${savedCount} questions saved`);
      }
    } catch (error: any) {
      console.error(`Error processing book (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);

      // Check if PDF file not found (don't retry for this error)
      const isPdfNotFound =
        error.message.includes('PDF file not found') ||
        error.message.includes('ENOENT') ||
        error.message.includes('no such file or directory');

      if (isPdfNotFound) {
        console.error(
          '❌ PDF file is missing from disk. This book cannot be processed until the PDF is re-uploaded.'
        );

        const { db } = require('../config/database');
        const { books } = require('../models/schema');
        const { eq } = require('drizzle-orm');

        await db
          .update(books)
          .set({
            uploadStatus: 'failed',
            errorMessage:
              'PDF file not found. The file may have been deleted or moved. Please re-upload the PDF to process this book.',
            processingCompletedAt: new Date(),
          })
          .where(eq(books.id, bookId));

        return;
      }

      // Check if this is a PDF conversion error and we haven't exceeded retry limit
      const isPdfConversionError =
        error.message.includes('Failed to convert PDF to images') ||
        error.message.includes('pdftoppm') ||
        error.message.includes('PDF conversion');

      if (isPdfConversionError && retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying PDF processing in ${RETRY_DELAY / 1000} seconds...`);

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));

        // Recursive retry
        return this.processBook(bookId, retryCount + 1);
      }

      // If we've exhausted retries or it's not a PDF error, mark as failed
      const { db } = require('../config/database');
      const { books } = require('../models/schema');
      const { eq } = require('drizzle-orm');

      const errorMessage =
        retryCount >= MAX_RETRIES
          ? `Failed after ${MAX_RETRIES + 1} attempts: ${error.message}`
          : error.message;

      await db
        .update(books)
        .set({
          uploadStatus: 'failed',
          errorMessage: errorMessage,
          processingCompletedAt: new Date(),
        })
        .where(eq(books.id, bookId));
    }
  }

  /**
   * Generate explanation and enhance metadata using Gemini AI
   * Takes a question and uses AI to generate explanation and detect accurate metadata
   */
  async generateQuestionMetadata(question: {
    questionText: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctAnswer: string;
    subject?: string;
    topic?: string;
    difficulty?: string;
  }): Promise<{
    explanation: string;
    subject: string;
    topic: string;
    subtopic?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    cognitiveLevel: 'fact' | 'conceptual' | 'numerical' | 'assertion' | null;
  }> {
    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `You are an expert NEET exam question analyzer. Analyze the following question and provide detailed metadata.

QUESTION:
${question.questionText}

OPTIONS:
(A) ${question.optionA || 'N/A'}
(B) ${question.optionB || 'N/A'}
(C) ${question.optionC || 'N/A'}
(D) ${question.optionD || 'N/A'}

CORRECT ANSWER: ${question.correctAnswer}

TASK:
Analyze this question and provide the following in JSON format:

{
  "explanation": "Detailed explanation of why the correct answer is right and why other options are wrong. Include relevant concepts, formulas, or facts.",
  "subject": "One of: physics, chemistry, botany, zoology",
  "topic": "Main topic (e.g., Mechanics, Thermodynamics, Organic Chemistry, Cell Biology, Genetics, etc.)",
  "subtopic": "Specific subtopic (e.g., Newton's Laws, Carnot Cycle, Alkanes, Mitosis, Mendelian Genetics, etc.)",
  "difficulty": "One of: easy, medium, hard",
  "cognitiveLevel": "One of: fact, conceptual, numerical, assertion (or null if none fit)"
}

GUIDELINES:
- **explanation**: Should be 2-4 sentences explaining the correct answer clearly and why other options are incorrect
- **subject**: Determine based on keywords and concepts (physics for mechanics/electricity, chemistry for reactions/compounds, botany for plants, zoology for animals/human biology)
- **topic**: Identify the main chapter/topic area
- **subtopic**: More specific area within the topic
- **difficulty**:
  - easy: Direct recall, simple calculation
  - medium: Requires understanding and application
  - hard: Complex problem-solving, multiple concepts
- **cognitiveLevel**:
  - fact: Pure recall/memory
  - conceptual: Understanding principles
  - numerical: Calculation-based
  - assertion: Statement verification
  - null: If none fit

Return ONLY the JSON object, no additional text.`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const metadata = JSON.parse(jsonMatch[0]);

      return {
        explanation: metadata.explanation || '',
        subject: metadata.subject || question.subject || 'physics',
        topic: metadata.topic || question.topic || '',
        subtopic: metadata.subtopic || undefined,
        difficulty: metadata.difficulty || question.difficulty || 'medium',
        cognitiveLevel: metadata.cognitiveLevel || null,
      };
    } catch (error) {
      console.error('Error generating question metadata with AI:', error);
      // Return defaults if AI fails
      return {
        explanation: '',
        subject: question.subject || 'physics',
        topic: question.topic || '',
        subtopic: undefined,
        difficulty: (question.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        cognitiveLevel: null,
      };
    }
  }
}
