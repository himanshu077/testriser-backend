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
   * Main extraction function - processes entire PDF
   */
  async extractPDF(pdfPath: string): Promise<ExtractedQuestion[]> {
    console.log('🚀 Starting Vision API PDF extraction...');
    console.log('📄 PDF Path:', pdfPath);

    try {
      // Create temp and diagrams directories
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.diagramsDir, { recursive: true });

      // Step 1: Convert PDF to images
      console.log('\n📸 Step 1: Converting PDF pages to images...');
      const pageImages = await this.convertPDFToImages(pdfPath);
      console.log(`✅ Converted ${pageImages.length} pages`);

      // Step 2: Process each page directly with GPT-4 Vision (more accurate than OCR)
      console.log('\n🤖 Step 2: Analyzing pages with GPT-4 Vision (direct image analysis)...');
      const allQuestions: ExtractedQuestion[] = [];
      const extractedNumbers = new Set<number>();
      const pageImageMap = new Map<number, string>(); // Map page number to image path

      for (let i = 0; i < pageImages.length; i++) {
        console.log(`   📄 Processing page ${i + 1}/${pageImages.length} with GPT-4 Vision...`);

        const pageQuestions = await this.analyzePageWithVision(pageImages[i], i + 1);

        // Store page image path for diagram extraction
        pageImageMap.set(i + 1, pageImages[i]);

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
      await this.cleanup(pageImages);

      return questions;
    } catch (error) {
      console.error('❌ Extraction failed:', error);
      throw error;
    }
  }

  /**
   * Convert PDF to individual page images
   */
  private async convertPDFToImages(pdfPath: string): Promise<string[]> {
    const outputPattern = path.join(this.tempDir, 'page-%03d.png');

    try {
      // Ensure temp directory exists
      try {
        await fs.access(this.tempDir);
      } catch {
        await fs.mkdir(this.tempDir, { recursive: true });
        console.log(`   📁 Created temp directory: ${this.tempDir}`);
      }

      // Use pdftoppm to convert PDF to images (uses system PATH)
      await execAsync(`pdftoppm -png -r 300 "${pdfPath}" "${path.join(this.tempDir, 'page')}"`);

      // Get list of generated images
      const files = await fs.readdir(this.tempDir);
      const imageFiles = files
        .filter((f) => f.endsWith('.png'))
        .sort()
        .map((f) => path.join(this.tempDir, f));

      return imageFiles;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      throw new Error('Failed to convert PDF to images. Ensure pdftoppm is installed.');
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
   * Analyze page images directly with GPT-4 Vision
   */
  private async analyzePageWithVision(
    imagePath: string,
    pageNumber: number
  ): Promise<ExtractedQuestion[]> {
    try {
      // Read image as base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `You are analyzing page ${pageNumber} of a NEET exam PDF. Extract EVERY question visible on this page.

CRITICAL INSTRUCTIONS:
- Extract EVERY SINGLE question you can see on this page
- Include the complete question text, all options (A, B, C, D), and any context
- Look carefully at the question numbers - they should be sequential
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
        max_tokens: 4096,
        temperature: 0.2,
      });

      const text = completion.choices[0]?.message?.content || '';

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log(`   ⚠️  No questions found on page ${pageNumber}`);
        return [];
      }

      const questions: ExtractedQuestion[] = JSON.parse(jsonMatch[0]);
      return questions;
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

    // Get Gemini model (using gemini-pro-vision for image analysis)
    const model = this.gemini.getGenerativeModel({ model: 'gemini-pro-vision' });

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

        const result = await model.generateContent([
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/png',
            },
          },
          prompt,
        ]);

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

        console.log(`      ✅ Q${question.questionNumber}: Diagram saved`);
      } catch (error: any) {
        console.error(
          `      ❌ Q${question.questionNumber}: Failed to extract diagram:`,
          error.message
        );
      }
    }
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(files: string[]): Promise<void> {
    try {
      for (const file of files) {
        await fs.unlink(file).catch(() => {});
      }
      await fs.rmdir(this.tempDir).catch(() => {});
    } catch (error) {
      console.error('Cleanup error:', error);
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
        console.log(`   📊 Estimated page number: ${targetPage} (based on question ${questionNumber})`);
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
      console.log(`   📐 Crop area: x=${cropData.x}, y=${cropData.y}, w=${cropData.width}, h=${cropData.height}`);

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
   * Process uploaded book and extract questions
   */
  static async processBook(bookId: string): Promise<void> {
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
        })
        .where(eq(books.id, bookId));

      console.log(`📚 Processing book: ${book.title}`);
      console.log(`📄 File: ${book.filePath}`);

      // Use Vision API extraction
      const service = new VisionExtractionService();
      const questions = await service.extractPDF(book.filePath);

      console.log(`✅ Extracted ${questions.length} questions`);

      // Save questions to database
      let savedCount = 0;
      let activeCount = 0;
      let inactiveCount = 0;

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
            optionA: question.optionA || null,
            optionB: question.optionB || null,
            optionC: question.optionC || null,
            optionD: question.optionD || null,
            correctAnswer: question.correctAnswer || 'PENDING',
            explanation: question.explanation || null,
            difficulty: question.difficulty || 'medium',
            questionNumber: question.questionNumber,
            isActive: isComplete, // Set to false if incomplete
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
          console.error(`Failed to save question ${question.questionNumber}:`, error.message);
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

      console.log(`\n📊 Save Summary:`);
      console.log(`   ✅ Active questions: ${activeCount}`);
      console.log(`   ⚠️  Inactive questions (need review): ${inactiveCount}`);
      console.log(`   📝 Placeholder questions (missing): ${placeholderCount}`);
      console.log(`   📝 Total saved: ${savedCount + placeholderCount}`);

      // Update book status to completed
      await db
        .update(books)
        .set({
          uploadStatus: 'completed',
          processingCompletedAt: new Date(),
          totalQuestionsExtracted: savedCount,
        })
        .where(eq(books.id, bookId));

      console.log(`✅ Book processing completed: ${savedCount} questions saved`);
    } catch (error: any) {
      console.error('Error processing book:', error);

      // Update book status to failed
      const { db } = require('../config/database');
      const { books } = require('../models/schema');
      const { eq } = require('drizzle-orm');

      await db
        .update(books)
        .set({
          uploadStatus: 'failed',
          errorMessage: error.message,
          processingCompletedAt: new Date(),
        })
        .where(eq(books.id, bookId));
    }
  }
}
