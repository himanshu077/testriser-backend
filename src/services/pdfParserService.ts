import fs from 'fs';
import { db } from '../config/database';
import { books, questions } from '../models/schema';
import { eq } from 'drizzle-orm';
import { PDFImageService, ExtractedDiagramImage } from './pdfImageService';

export interface ParsedChapter {
  chapterNumber: number;
  name: string;
}

export interface ParsedTopic {
  topicNumber: number;
  name: string;
  chapterNumber: number; // To associate with chapter
}

export interface StructuredData {
  type: 'truth_table' | 'match_list' | 'table' | 'other';
  headers?: string[];
  rows?: (string | number)[][];
  listI?: { label: string; value: string }[];
  listII?: { label: string; value: string }[];
  description?: string;
}

export interface ParsedQuestion {
  questionText: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer: string;
  explanation?: string;
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  examYear?: number; // Year extracted from [NEET (Sep.) 2020] etc.
  examType?: string; // "NEET" or "CBSE AIPMT"
  chapterNumber?: number; // Chapter number for linking
  topicNumber?: number; // Topic number for linking
  questionImage?: string; // URL to question image
  optionAImage?: string; // URL to option A image
  optionBImage?: string; // URL to option B image
  optionCImage?: string; // URL to option C image
  optionDImage?: string; // URL to option D image
  // Structured data fields (scraping method)
  hasDiagram?: boolean; // True if question has a diagram/figure
  diagramDescription?: string; // Description of the diagram
  structuredData?: StructuredData; // JSON for tables, match lists, truth tables
}

/**
 * PDF Parser Service
 * Handles extraction of questions from PDF files
 */
export class PDFParserService {
  /**
   * Parse PDF and extract questions
   * This is a simplified version - in production you'd use AI/ML for better extraction
   */
  static async parsePDF(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      // Use pdf-parse v1.x simple API
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error: any) {
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  /**
   * Extract chapters from PDF text
   * Chapters in Arihant NEET books are formatted like: "01\nUnits and Measurements"
   * Looking for chapter titles that appear as major headings (title case, standalone)
   */
  static extractChapters(pdfText: string): ParsedChapter[] {
    const chapters: ParsedChapter[] = [];

    // Known Physics chapters in NEET (Arihant book structure)
    const knownChapters = [
      { num: 1, name: 'Units and Measurements' },
      { num: 2, name: 'Motion in a Straight Line' },
      { num: 3, name: 'Motion in a Plane' },
      { num: 4, name: 'Laws of Motion' },
      { num: 5, name: 'Work, Energy and Power' },
      { num: 6, name: 'System of Particles and Rotational Motion' },
      { num: 7, name: 'Gravitation' },
      { num: 8, name: 'Mechanical Properties of Solids' },
      { num: 9, name: 'Mechanical Properties of Fluids' },
      { num: 10, name: 'Thermal Properties of Matter' },
      { num: 11, name: 'Thermodynamics' },
      { num: 12, name: 'Kinetic Theory' },
      { num: 13, name: 'Oscillations' },
      { num: 14, name: 'Waves' },
      { num: 15, name: 'Electric Charges and Fields' },
      { num: 16, name: 'Electrostatic Potential and Capacitance' },
      { num: 17, name: 'Current Electricity' },
      { num: 18, name: 'Moving Charges and Magnetism' },
      { num: 19, name: 'Magnetism and Matter' },
      { num: 20, name: 'Electromagnetic Induction' },
      { num: 21, name: 'Alternating Current' },
      { num: 22, name: 'Electromagnetic Waves' },
      { num: 23, name: 'Ray Optics and Optical Instruments' },
      { num: 24, name: 'Wave Optics' },
      { num: 25, name: 'Dual Nature of Radiation and Matter' },
      { num: 26, name: 'Atoms' },
      { num: 27, name: 'Nuclei' },
      { num: 28, name: 'Semiconductor Electronics' },
      { num: 29, name: 'Communication Systems' },
    ];

    // Check which chapters are present in the PDF
    for (const knownChapter of knownChapters) {
      // Look for chapter name in text (case insensitive)
      const chapterRegex = new RegExp(
        knownChapter.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
      if (chapterRegex.test(pdfText)) {
        chapters.push({
          chapterNumber: knownChapter.num,
          name: knownChapter.name,
        });
      }
    }

    // Sort by chapter number
    chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

    console.log(`📚 Found ${chapters.length} chapters`);
    if (chapters.length > 0) {
      console.log(
        '   Chapters:',
        chapters
          .slice(0, 10)
          .map((c) => `${c.chapterNumber}. ${c.name}`)
          .join(', ')
      );
    }

    return chapters;
  }

  /**
   * Extract topics from PDF text
   * Topics are formatted like: "TOPIC 1\nUnits" or "TOPIC 2\nErrors in Measurement and Significant Figure"
   */
  static extractTopics(pdfText: string, chapters: ParsedChapter[]): ParsedTopic[] {
    const topics: ParsedTopic[] = [];

    // Pattern to match topic headings - "TOPIC X" followed by the topic name on next line
    // The topic name ends before a question number (01, 02, etc.) or another TOPIC
    const topicPattern =
      /TOPIC\s+(\d+)\s*\n\s*([A-Z][A-Za-z\s,\-]+?)(?=\s*\n\s*(?:\d{2}\s|TOPIC|$))/gi;

    let match;
    let currentChapter = 1;

    // Find each chapter's position in text to associate topics with chapters
    const chapterPositions: { chapter: number; position: number }[] = [];
    for (const chapter of chapters) {
      // Look for the chapter name in the text
      const regex = new RegExp(chapter.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const chapterMatch = regex.exec(pdfText);
      if (chapterMatch) {
        chapterPositions.push({
          chapter: chapter.chapterNumber,
          position: chapterMatch.index,
        });
      }
    }

    // Sort chapter positions
    chapterPositions.sort((a, b) => a.position - b.position);

    while ((match = topicPattern.exec(pdfText)) !== null) {
      const topicNum = parseInt(match[1], 10);
      let topicName = match[2].trim();

      // Clean up topic name - remove trailing numbers/question content and newlines
      topicName = topicName
        .replace(/\s+\d{2}\s*$/, '')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Validate: topic name should be reasonable length and not contain question markers
      if (
        topicName.length >= 3 &&
        topicName.length < 80 &&
        !topicName.includes('(a)') &&
        !topicName.includes('Ans.') &&
        !topicName.includes('[NEET') &&
        !topicName.includes('[CBSE')
      ) {
        // Find which chapter this topic belongs to based on position
        const topicPosition = match.index;
        currentChapter = chapters.length > 0 ? chapters[0].chapterNumber : 1;
        for (const cp of chapterPositions) {
          if (topicPosition > cp.position) {
            currentChapter = cp.chapter;
          }
        }

        // Avoid duplicates
        if (!topics.find((t) => t.chapterNumber === currentChapter && t.topicNumber === topicNum)) {
          topics.push({
            topicNumber: topicNum,
            name: topicName,
            chapterNumber: currentChapter,
          });
        }
      }
    }

    // Sort by chapter and topic number
    topics.sort((a, b) => {
      if (a.chapterNumber !== b.chapterNumber) {
        return a.chapterNumber - b.chapterNumber;
      }
      return a.topicNumber - b.topicNumber;
    });

    console.log(`📖 Found ${topics.length} topics`);
    if (topics.length > 0) {
      console.log(
        '   Topics:',
        topics
          .slice(0, 10)
          .map((t) => `Ch${t.chapterNumber}-T${t.topicNumber}: ${t.name}`)
          .join('; ')
      );
    }

    return topics;
  }

  /**
   * Extract year and exam type from exam marker
   * E.g., "[NEET (Sep.) 2020]" → { year: 2020, type: "NEET" }
   * E.g., "[CBSE AIPMT 2003]" → { year: 2003, type: "CBSE AIPMT" }
   */
  static extractExamInfo(marker: string): { year?: number; type?: string } {
    // Extract year (4 digits)
    const yearMatch = marker.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

    // Extract exam type
    let type: string | undefined;
    if (marker.includes('CBSE AIPMT')) {
      type = 'CBSE AIPMT';
    } else if (marker.includes('NEET')) {
      type = 'NEET';
    }

    return { year, type };
  }

  /**
   * Extract questions from parsed PDF text
   * Uses advanced pattern matching to identify NEET-style MCQ questions
   */
  static async extractQuestions(pdfText: string, subject: string): Promise<ParsedQuestion[]> {
    console.log(`📄 PDF contains ${pdfText.length} characters`);
    console.log(`🔍 Extracting ${subject} questions...`);

    const questions: ParsedQuestion[] = [];

    // Clean up the text - remove extra whitespace and normalize line breaks
    const cleanText = pdfText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // NEW APPROACH: Split by question boundaries first
    // Each question starts with \d{2} and ends with Ans.\([a-d]\)
    console.log('🔍 Using improved multi-pattern extraction...');

    // Pattern 1: Most permissive - match everything between question number and answer
    // This handles parentheses in text, multi-line options, etc.
    // Now also captures the exam marker [NEET...] or [CBSE AIPMT...]
    const patternV2 =
      /(\d{2})([\s\S]{20,2000}?)(\[(?:NEET|CBSE\s+AIPMT)[^\]]+\])([\s\S]{50,2000}?)\(a\)([\s\S]{5,500}?)\(b\)([\s\S]{5,500}?)\(c\)([\s\S]{5,500}?)\(d\)([\s\S]{5,500}?)Ans\.\(([a-d])\)/gi;

    let match: RegExpExecArray | null;
    let matchCount = 0;

    console.log('🔍 Pattern V2: Permissive multi-line matching...');
    while ((match = patternV2.exec(cleanText)) !== null) {
      const [, , beforeMarker, examMarker, , optA, optB, optC, optD, answer] = match;

      // Build question text from before marker part only (after marker is usually continuation/explanation)
      // Clean the question text - remove the exam marker from being part of question text
      const questionText = beforeMarker.trim();

      if (questionText && optA && optB && optC && optD && answer) {
        // Clean up: remove excessive whitespace, newlines
        const cleanQ = questionText.replace(/\s+/g, ' ').trim();
        const cleanA = optA.replace(/\s+/g, ' ').trim();
        const cleanB = optB.replace(/\s+/g, ' ').trim();
        const cleanC = optC.replace(/\s+/g, ' ').trim();
        const cleanD = optD.replace(/\s+/g, ' ').trim();

        // Extract year and exam type from marker
        const examInfo = this.extractExamInfo(examMarker);

        // Validate: options shouldn't be too long (likely captured too much)
        if (
          cleanA.length < 300 &&
          cleanB.length < 300 &&
          cleanC.length < 300 &&
          cleanD.length < 300
        ) {
          questions.push({
            questionText: cleanQ.substring(0, 1000), // Limit question length
            optionA: cleanA,
            optionB: cleanB,
            optionC: cleanC,
            optionD: cleanD,
            correctAnswer: answer.toUpperCase(),
            subject,
            topic: '',
            difficulty: 'medium',
            examYear: examInfo.year,
            examType: examInfo.type,
          });
          matchCount++;
        }
      }
    }

    console.log(`✅ Pattern V2: Found ${matchCount} questions`);

    // Pattern 2: Tighter pattern for questions with cleaner formatting
    if (questions.length < 1000) {
      console.log('🔍 Pattern V2b: Tighter formatting...');
      const patternV2b =
        /(\d{2})([^\[]{10,300})(\[(?:NEET|CBSE\s+AIPMT)[^\]]+\])([^\(]{0,200})\(a\)([^\(]{3,200}?)\(b\)([^\(]{3,200}?)\(c\)([^\(]{3,200}?)\(d\)([^\(]{3,200}?)Ans\.\(([a-d])\)/gi;

      patternV2b.lastIndex = 0;
      let extraMatches = 0;
      const seenQuestions = new Set(questions.map((q) => q.questionText.substring(0, 50)));

      while ((match = patternV2b.exec(cleanText)) !== null) {
        const [, , beforeMarker, examMarker, , optA, optB, optC, optD, answer] = match;

        const questionText = beforeMarker.trim().replace(/\s+/g, ' ');
        const qSignature = questionText.substring(0, 50);

        // Skip if we already have this question
        if (seenQuestions.has(qSignature)) continue;

        if (questionText && optA && optB && optC && optD && answer) {
          const cleanA = optA.replace(/\s+/g, ' ').trim();
          const cleanB = optB.replace(/\s+/g, ' ').trim();
          const cleanC = optC.replace(/\s+/g, ' ').trim();
          const cleanD = optD.replace(/\s+/g, ' ').trim();

          // Extract year and exam type from marker
          const examInfo = this.extractExamInfo(examMarker);

          questions.push({
            questionText: questionText.substring(0, 1000),
            optionA: cleanA,
            optionB: cleanB,
            optionC: cleanC,
            optionD: cleanD,
            correctAnswer: answer.toUpperCase(),
            subject,
            topic: '',
            difficulty: 'medium',
            examYear: examInfo.year,
            examType: examInfo.type,
          });
          seenQuestions.add(qSignature);
          extraMatches++;
        }
      }

      console.log(`✅ Pattern V2b: Found ${extraMatches} additional questions`);
    }

    // Pattern 3: Handle cases where options are on separate lines
    if (questions.length < 1000) {
      console.log('🔍 Pattern V3: Separate line options...');
      const patternV3 =
        /(\d{2})[\s\S]{10,300}?\[(?:NEET|CBSE\s+AIPMT)[^\]]+\][\s\S]{0,200}?\(a\)[^\n]{5,200}\n[^\(]{0,50}\(b\)[^\n]{5,200}\n[^\(]{0,50}\(c\)[^\n]{5,200}\n[^\(]{0,50}\(d\)[^\n]{5,200}[\s\n]{0,50}Ans\.\(([a-d])\)/gi;

      patternV3.lastIndex = 0;
      let extraMatches3 = 0;
      const seenQuestions = new Set(questions.map((q) => q.questionText.substring(0, 50)));

      while ((match = patternV3.exec(cleanText)) !== null) {
        const fullMatch = match[0];

        // Extract components more carefully
        const qMatch = fullMatch.match(/(\d{2})([\s\S]+?)(\[(?:NEET|CBSE\s+AIPMT)[^\]]+\])/);
        const optionsMatch = fullMatch.match(
          /\(a\)([^\n]+)\n[^\(]{0,50}\(b\)([^\n]+)\n[^\(]{0,50}\(c\)([^\n]+)\n[^\(]{0,50}\(d\)([^\n]+)/
        );
        const answerMatch = fullMatch.match(/Ans\.\(([a-d])\)/i);

        if (qMatch && optionsMatch && answerMatch) {
          const questionText = qMatch[2].trim().replace(/\s+/g, ' ');
          const examMarker = qMatch[3];
          const qSignature = questionText.substring(0, 50);

          if (seenQuestions.has(qSignature)) continue;

          const [, optA, optB, optC, optD] = optionsMatch;
          const answer = answerMatch[1];

          // Extract year and exam type from marker
          const examInfo = this.extractExamInfo(examMarker);

          if (questionText && optA && optB && optC && optD) {
            questions.push({
              questionText: questionText.substring(0, 1000),
              optionA: optA.trim().replace(/\s+/g, ' '),
              optionB: optB.trim().replace(/\s+/g, ' '),
              optionC: optC.trim().replace(/\s+/g, ' '),
              optionD: optD.trim().replace(/\s+/g, ' '),
              correctAnswer: answer.toUpperCase(),
              subject,
              topic: '',
              difficulty: 'medium',
              examYear: examInfo.year,
              examType: examInfo.type,
            });
            seenQuestions.add(qSignature);
            extraMatches3++;
          }
        }
      }

      console.log(`✅ Pattern V3: Found ${extraMatches3} additional questions`);
    }

    // Pattern V4: Ultra-aggressive - split by "Ans.(x)" and work backwards
    if (questions.length < 1200) {
      console.log('🔍 Pattern V4: Ultra-aggressive backward search...');
      const patternV4 =
        /(\d{2})[\s\S]{5,1500}?\(a\)[\s\S]{3,400}?\(b\)[\s\S]{3,400}?\(c\)[\s\S]{3,400}?\(d\)[\s\S]{3,400}?Ans\.\(([a-d])\)/gi;

      patternV4.lastIndex = 0;
      let extraMatches4 = 0;
      const seenQuestions = new Set(questions.map((q) => q.questionText.substring(0, 50)));

      while ((match = patternV4.exec(cleanText)) !== null) {
        const fullMatch = match[0];

        // Try to extract components
        const answer = match[2];

        // Find the [NEET] or [CBSE AIPMT] marker
        const markerMatch = fullMatch.match(/\[(?:NEET|CBSE\s+AIPMT)[^\]]+\]/);

        // Extract options more carefully
        const optAMatch = fullMatch.match(/\(a\)([\s\S]{3,400}?)\(b\)/);
        const optBMatch = fullMatch.match(/\(b\)([\s\S]{3,400}?)\(c\)/);
        const optCMatch = fullMatch.match(/\(c\)([\s\S]{3,400}?)\(d\)/);
        const optDMatch = fullMatch.match(/\(d\)([\s\S]{3,400}?)Ans\./);

        if (optAMatch && optBMatch && optCMatch && optDMatch) {
          // Extract question text (everything before first marker or option (a))
          let questionText = '';
          if (markerMatch) {
            const markerIndex = fullMatch.indexOf(markerMatch[0]);
            // Question text is before the marker (without the exam marker)
            questionText = fullMatch.substring(2, markerIndex); // Remove question number, exclude marker
          } else {
            // No marker found, take text before (a)
            const optAIndex = fullMatch.indexOf('(a)');
            questionText = fullMatch.substring(2, optAIndex);
          }

          questionText = questionText.trim().replace(/\s+/g, ' ');
          const qSignature = questionText.substring(0, 50);

          if (seenQuestions.has(qSignature)) continue;
          if (questionText.length < 10) continue; // Too short

          const optA = optAMatch[1].trim().replace(/\s+/g, ' ');
          const optB = optBMatch[1].trim().replace(/\s+/g, ' ');
          const optC = optCMatch[1].trim().replace(/\s+/g, ' ');
          const optD = optDMatch[1].trim().replace(/\s+/g, ' ');

          // Extract year and exam type from marker if found
          const examInfo = markerMatch
            ? this.extractExamInfo(markerMatch[0])
            : { year: undefined, type: undefined };

          // Validate option lengths
          if (
            optA.length > 0 &&
            optA.length < 300 &&
            optB.length > 0 &&
            optB.length < 300 &&
            optC.length > 0 &&
            optC.length < 300 &&
            optD.length > 0 &&
            optD.length < 300
          ) {
            questions.push({
              questionText: questionText.substring(0, 1000),
              optionA: optA,
              optionB: optB,
              optionC: optC,
              optionD: optD,
              correctAnswer: answer.toUpperCase(),
              subject,
              topic: '',
              difficulty: 'medium',
              examYear: examInfo.year,
              examType: examInfo.type,
            });
            seenQuestions.add(qSignature);
            extraMatches4++;
          }
        }
      }

      console.log(`✅ Pattern V4: Found ${extraMatches4} additional questions`);
    }

    console.log(`\n✅ TOTAL EXTRACTED: ${questions.length} questions`);
    console.log(`📊 Success rate: ${((questions.length / 1617) * 100).toFixed(1)}%\n`);

    // If we found questions, return them
    if (questions.length > 0) {
      return questions;
    }

    // Fallback to original patterns if new patterns found nothing
    console.log('⚠️  New patterns found nothing, trying fallback patterns...');

    // Pattern 1: Standard format - Q. 1. Question text \n (A) option \n (B) option etc.
    const pattern1 =
      /(?:Q\.?\s*)?(\d+)[\s.:)]+(.+?)(?:\n|\r\n)\s*(?:\(?\s*A\s*\)?[.:]?\s*)(.+?)(?:\n|\r\n)\s*(?:\(?\s*B\s*\)?[.:]?\s*)(.+?)(?:\n|\r\n)\s*(?:\(?\s*C\s*\)?[.:]?\s*)(.+?)(?:\n|\r\n)\s*(?:\(?\s*D\s*\)?[.:]?\s*)(.+?)(?:\n|\r\n)\s*(?:Answer|Ans|Correct Answer)?[:\s]*(?:\(?\s*([A-Da-d])\s*\)?)/gi;

    // Pattern 2: Format with numbered options - 1) Question \n 1) option \n 2) option etc.
    const pattern2 =
      /(\d+)\.\s*(.+?)(?:\n|\r\n)\s*(?:1\)|a\)|\(a\))(.+?)(?:\n|\r\n)\s*(?:2\)|b\)|\(b\))(.+?)(?:\n|\r\n)\s*(?:3\)|c\)|\(c\))(.+?)(?:\n|\r\n)\s*(?:4\)|d\)|\(d\))(.+?)(?:\n|\r\n)\s*(?:Answer|Ans)?[:\s]*(?:\(?\s*([A-Da-d1-4])\s*\)?)/gi;

    // Pattern 3: Compact format - Q1. Question text (A) opt (B) opt (C) opt (D) opt Ans: A
    const pattern3 =
      /Q\.?\s*(\d+)[\s.:)]+(.+?)\s*\(?\s*A\s*\)?[.:]?\s*(.+?)\s*\(?\s*B\s*\)?[.:]?\s*(.+?)\s*\(?\s*C\s*\)?[.:]?\s*(.+?)\s*\(?\s*D\s*\)?[.:]?\s*(.+?)\s*(?:Answer|Ans|Correct)?[:\s]*\(?\s*([A-Da-d])\s*\)?/gi;

    // Pattern 4: Specific format from user - Q. 1: Question \n A) opt \n B) opt etc.
    const pattern4 =
      /Q\.\s*(\d+)[:.]\s*(.+?)\n\s*(?:A|a)[).]?\s*(.+?)\n\s*(?:B|b)[).]?\s*(.+?)\n\s*(?:C|c)[).]?\s*(.+?)\n\s*(?:D|d)[).]?\s*(.+?)\n\s*(?:Answer|Ans)[:.]\s*([A-D])/gim;

    // Try pattern 1
    while ((match = pattern1.exec(cleanText)) !== null) {
      const [, , questionText, optA, optB, optC, optD, answer] = match;

      if (questionText && optA && optB && optC && optD && answer) {
        questions.push({
          questionText: questionText.trim(),
          optionA: optA.trim(),
          optionB: optB.trim(),
          optionC: optC.trim(),
          optionD: optD.trim(),
          correctAnswer: answer.toUpperCase(),
          subject,
          topic: '', // Will be set from form input
          difficulty: 'medium',
        });
      }
    }

    // Try pattern 2 if pattern 1 didn't find anything
    if (questions.length === 0) {
      while ((match = pattern2.exec(cleanText)) !== null) {
        const [, , questionText, optA, optB, optC, optD, answer] = match;

        if (questionText && optA && optB && optC && optD && answer) {
          // Convert numeric answer (1-4) to letter (A-D)
          let correctAnswer = answer.toUpperCase();
          if (['1', '2', '3', '4'].includes(correctAnswer)) {
            correctAnswer = String.fromCharCode(64 + parseInt(correctAnswer)); // 1->A, 2->B, etc.
          }

          questions.push({
            questionText: questionText.trim(),
            optionA: optA.trim(),
            optionB: optB.trim(),
            optionC: optC.trim(),
            optionD: optD.trim(),
            correctAnswer,
            subject,
            topic: '',
            difficulty: 'medium',
          });
        }
      }
    }

    // Try pattern 3 if still no questions found
    if (questions.length === 0) {
      while ((match = pattern3.exec(cleanText)) !== null) {
        const [, , questionText, optA, optB, optC, optD, answer] = match;

        if (questionText && optA && optB && optC && optD && answer) {
          questions.push({
            questionText: questionText.trim(),
            optionA: optA.trim(),
            optionB: optB.trim(),
            optionC: optC.trim(),
            optionD: optD.trim(),
            correctAnswer: answer.toUpperCase(),
            subject,
            topic: '',
            difficulty: 'medium',
          });
        }
      }
    }

    // Try pattern 4 if still no questions found
    if (questions.length === 0) {
      while ((match = pattern4.exec(cleanText)) !== null) {
        const [, , questionText, optA, optB, optC, optD, answer] = match;

        if (questionText && optA && optB && optC && optD && answer) {
          questions.push({
            questionText: questionText.trim(),
            optionA: optA.trim(),
            optionB: optB.trim(),
            optionC: optC.trim(),
            optionD: optD.trim(),
            correctAnswer: answer.toUpperCase(),
            subject,
            topic: '',
            difficulty: 'medium',
          });
        }
      }
    }

    console.log(`✅ Found ${questions.length} questions using pattern matching`);

    // Log first question as sample if any found
    if (questions.length > 0) {
      console.log('📝 Sample question:', {
        text: questions[0].questionText.substring(0, 100) + '...',
        options: [questions[0].optionA?.substring(0, 30), questions[0].optionB?.substring(0, 30)],
        answer: questions[0].correctAnswer,
      });
    }

    return questions;
  }

  /**
   * Detect subject from question text for full-length PYQ papers
   * NEET has Physics, Chemistry, Botany, Zoology
   */
  static detectSubjectFromQuestion(questionText: string): string {
    const text = questionText.toLowerCase();

    // Physics keywords
    if (
      /\b(force|velocity|acceleration|momentum|energy|power|work|friction|gravity|motion|wave|light|electricity|magnetism|circuit|current|voltage|resistance|capacitor|inductor|thermodynamics|heat|temperature|pressure|optics|lens|mirror|refraction|reflection)\b/i.test(
        text
      )
    ) {
      return 'physics';
    }

    // Chemistry keywords
    if (
      /\b(atom|molecule|compound|element|reaction|acid|base|salt|oxidation|reduction|bond|ion|electron|proton|neutron|periodic|solution|solvent|solute|catalyst|equilibrium|organic|inorganic|alkane|alkene|benzene|alcohol|ether)\b/i.test(
        text
      )
    ) {
      return 'chemistry';
    }

    // Botany keywords
    if (
      /\b(plant|flower|leaf|stem|root|photosynthesis|chlorophyll|xylem|phloem|pollen|seed|fruit|cell wall|cellulose|stomata|transpiration|germination|pollination|taxonomy|angiosperm|gymnosperm)\b/i.test(
        text
      )
    ) {
      return 'botany';
    }

    // Zoology keywords
    if (
      /\b(animal|tissue|organ|muscle|bone|blood|heart|kidney|liver|brain|nerve|hormone|enzyme|protein|dna|rna|gene|chromosome|cell membrane|mitochondria|ribosome|evolution|darwin|mendel|ecosystem|biodiversity)\b/i.test(
        text
      )
    ) {
      return 'zoology';
    }

    // Default fallback
    return 'general';
  }

  /**
   * Extract truth table data from question text
   * E.g., "A B Y 0 0 1 0 1 0 1 0 1 1 1 0" or "A B Y\n0 0 1\n0 1 0..."
   */
  static extractTruthTable(text: string): StructuredData | null {
    // Check if this is a truth table question
    if (!/truth\s+table/i.test(text)) {
      return null;
    }

    // Try to find table headers (typically A, B, Y or A, B, C, Y)
    const headerPatterns = [
      /\b([A-C])\s+([A-C])\s+([A-Z])\b/i, // A B Y
      /\b([A-C])\s+([A-C])\s+([A-C])\s+([A-Z])\b/i, // A B C Y
    ];

    let headers: string[] = [];
    for (const pattern of headerPatterns) {
      const match = text.match(pattern);
      if (match) {
        headers = match.slice(1).map((h) => h.toUpperCase());
        break;
      }
    }

    if (headers.length === 0) {
      // Default headers for logic gates
      headers = ['A', 'B', 'Y'];
    }

    // Extract rows - look for sequences of 0s and 1s
    const rows: number[][] = [];
    const numColumns = headers.length;

    // Pattern to find truth table data (sequences of 0s and 1s)
    const dataPattern = /\b([01])\s+([01])\s+([01])(?:\s+([01]))?\b/g;
    let dataMatch;

    while ((dataMatch = dataPattern.exec(text)) !== null) {
      const row = dataMatch
        .slice(1, numColumns + 1)
        .filter((v) => v !== undefined)
        .map((v) => parseInt(v, 10));
      if (row.length === numColumns) {
        rows.push(row);
      }
    }

    // If we found at least 2 rows, it's likely a truth table
    if (rows.length >= 2) {
      return {
        type: 'truth_table',
        headers,
        rows,
        description: 'Truth table for logic circuit',
      };
    }

    // If pattern matching failed, create a placeholder
    return {
      type: 'truth_table',
      headers,
      rows: [], // Empty - needs manual entry
      description: 'Truth table detected but values need manual verification',
    };
  }

  /**
   * Extract match list data from question text
   * E.g., "Match List-I with List-II: List-I (Term) List-II (Definition) (A) Force (I) Newton..."
   */
  static extractMatchList(text: string): StructuredData | null {
    // Check if this is a match list question
    if (!/match\s+list[-\s]?i\s+with\s+list[-\s]?ii/i.test(text)) {
      return null;
    }

    // Extract list headers
    const headerMatch = text.match(/List[-\s]?I\s*\(([^)]+)\)\s*List[-\s]?II\s*\(([^)]+)\)/i);
    const header1 = headerMatch ? headerMatch[1].trim() : 'List-I';
    const header2 = headerMatch ? headerMatch[2].trim() : 'List-II';

    const listI: { label: string; value: string }[] = [];
    const listII: { label: string; value: string }[] = [];

    // Pattern 1: (A) item (I) value format - items interspersed
    const interspersedPattern =
      /\(([A-D])\)\s*([^(]+?)\s*\(([IVX]+)\)\s*([^(]+?)(?=\s*\([A-D]\)|\s*Choose|\s*$)/gi;
    let match;

    while ((match = interspersedPattern.exec(text)) !== null) {
      listI.push({ label: match[1].toUpperCase(), value: match[2].trim() });
      listII.push({ label: match[3], value: match[4].trim() });
    }

    // If interspersed pattern didn't work, try separate lists
    if (listI.length === 0) {
      // Pattern 2: List-I items then List-II items separately
      // (A) item1 (B) item2 ... then (I) val1 (II) val2 ...
      const listIPattern =
        /\(([A-D])\)\s*([^(]+?)(?=\s*\([A-D]\)|\s*\([IVX]\)|\s*List|\s*Choose|$)/gi;
      const listIIPattern = /\(([IVX]+)\)\s*([^(]+?)(?=\s*\([IVX]\)|\s*Choose|\s*From|$)/gi;

      while ((match = listIPattern.exec(text)) !== null) {
        const value = match[2].trim();
        if (value.length > 0 && value.length < 200) {
          listI.push({ label: match[1].toUpperCase(), value });
        }
      }

      while ((match = listIIPattern.exec(text)) !== null) {
        const value = match[2].trim();
        if (value.length > 0 && value.length < 200) {
          listII.push({ label: match[1], value });
        }
      }
    }

    if (listI.length > 0 || listII.length > 0) {
      return {
        type: 'match_list',
        headers: [header1, header2],
        listI,
        listII,
        description: `Match ${header1} with ${header2}`,
      };
    }

    // Return a placeholder if we detected match list but couldn't parse
    return {
      type: 'match_list',
      headers: [header1, header2],
      listI: [],
      listII: [],
      description: 'Match list detected but needs manual verification',
    };
  }

  /**
   * Detect if question has a diagram and return description
   * Uses text patterns to identify diagram references
   */
  static detectDiagram(
    questionText: string,
    options: string
  ): { hasDiagram: boolean; description?: string } {
    const fullText = `${questionText} ${options}`.toLowerCase();

    // Diagram detection patterns with descriptions
    const diagramPatterns: { pattern: RegExp; description: string }[] = [
      {
        pattern: /p[\s-]?v\s+(diagram|graph|cycle)/i,
        description: 'P-V diagram showing thermodynamic process',
      },
      {
        pattern: /t[\s-]?s\s+(diagram|graph)/i,
        description: 'T-S diagram showing thermodynamic process',
      },
      { pattern: /circuit\s+diagram/i, description: 'Electrical/electronic circuit diagram' },
      { pattern: /logic\s+(gate|circuit)/i, description: 'Logic gate circuit diagram' },
      { pattern: /ray\s+diagram/i, description: 'Ray diagram for optics' },
      { pattern: /free\s+body\s+diagram/i, description: 'Free body diagram showing forces' },
      { pattern: /block\s+diagram/i, description: 'Block diagram' },
      { pattern: /energy\s+(level|band)\s+diagram/i, description: 'Energy level/band diagram' },
      { pattern: /phase\s+diagram/i, description: 'Phase diagram' },
      { pattern: /velocity[\s-]time\s+(graph|diagram)/i, description: 'Velocity-time graph' },
      {
        pattern: /displacement[\s-]time\s+(graph|diagram)/i,
        description: 'Displacement-time graph',
      },
      {
        pattern: /acceleration[\s-]time\s+(graph|diagram)/i,
        description: 'Acceleration-time graph',
      },
      {
        pattern: /\b(figure|diagram|graph)\s*(below|above|shown|given)/i,
        description: 'Figure/diagram referenced in question',
      },
      {
        pattern: /as\s+shown\s+(in\s+)?(the\s+)?(figure|diagram)/i,
        description: 'Referenced figure/diagram',
      },
      {
        pattern: /refer\s+(to\s+)?(the\s+)?(figure|diagram)/i,
        description: 'Referenced figure/diagram',
      },
      { pattern: /cycle\s+[a-z]{4,}/i, description: 'Thermodynamic cycle diagram (e.g., ABCDA)' },
      { pattern: /carnot\s+cycle/i, description: 'Carnot cycle diagram' },
      { pattern: /otto\s+cycle/i, description: 'Otto cycle diagram' },
      { pattern: /\b(anode|cathode|electrode)/i, description: 'Electrochemical cell diagram' },
      {
        pattern: /molecular\s+(structure|formula|diagram)/i,
        description: 'Molecular structure diagram',
      },
      { pattern: /\b(dna|rna)\s+(structure|helix)/i, description: 'DNA/RNA structure diagram' },
      { pattern: /cell\s+(structure|diagram|organelle)/i, description: 'Cell structure diagram' },
      { pattern: /human\s+(body|anatomy|organ)/i, description: 'Human anatomy diagram' },
    ];

    for (const { pattern, description } of diagramPatterns) {
      if (pattern.test(fullText)) {
        return { hasDiagram: true, description };
      }
    }

    // Generic diagram indicators (less specific)
    const genericPatterns = [
      /\bfigure\b/i,
      /\bdiagram\b/i,
      /\bgraph\b/i,
      /\bshown\s+(below|above|in)/i,
      /\bgiven\s+(below|above|in)/i,
      /\bas\s+shown\b/i,
    ];

    for (const pattern of genericPatterns) {
      if (pattern.test(fullText)) {
        return { hasDiagram: true, description: 'Diagram/figure referenced in question' };
      }
    }

    return { hasDiagram: false };
  }

  /**
   * Extract all structured data from question text
   * Returns structured data for truth tables, match lists, etc.
   */
  static extractStructuredData(questionText: string): StructuredData | null {
    // Try truth table extraction
    const truthTable = this.extractTruthTable(questionText);
    if (truthTable) {
      return truthTable;
    }

    // Try match list extraction
    const matchList = this.extractMatchList(questionText);
    if (matchList) {
      return matchList;
    }

    return null;
  }

  /**
   * Format question text - detect and convert tables to HTML format
   * Also handles Match List-I with List-II type questions
   */
  static formatQuestionText(text: string): string {
    // For now, just clean up the text
    // The structured data will be stored separately and rendered by frontend
    return text;
  }

  /**
   * Check if question needs a diagram (has visual content that can't be represented as text)
   */
  static questionNeedsDiagram(questionText: string, options: string): boolean {
    const fullText = `${questionText} ${options}`.toLowerCase();

    // Patterns that strongly indicate need for diagram
    const diagramPatterns = [
      /\bfigure\b/,
      /\bdiagram\b/,
      /\bgraph\b/,
      /\bcircuit\b/,
      /\bshown\s+(below|above|in\s+the)\b/,
      /\bas\s+shown\b/,
      /\bgiven\s+(below|above|in\s+the)\b/,
      /\bp[\s-]?v\s+(diagram|graph|cycle)\b/,
      /\bcycle\s+[a-z]{4,}\b/, // cycle abcda, etc.
      /\bray\s+diagram\b/,
      /\bblock\s+diagram\b/,
    ];

    return diagramPatterns.some((pattern) => pattern.test(fullText));
  }

  /**
   * Extract questions from PYQ (Previous Year Questions) PDF
   * For year-wise exam papers like NEET 2024, NEET 2023, etc.
   * @param pdfText - The extracted PDF text
   * @param subject - Subject code (for subject-wise PYQ) or empty string (for full-length PYQ)
   * @param bookTitle - Book title to extract year
   * @param isFullLength - Whether this is a full-length paper (all subjects in one file)
   */
  static async extractPYQQuestions(
    pdfText: string,
    subject: string,
    bookTitle: string,
    isFullLength: boolean = false
  ): Promise<ParsedQuestion[]> {
    console.log(`📄 Extracting PYQ questions...`);
    console.log(`📖 Book: ${bookTitle}`);
    console.log(
      `📋 Type: ${isFullLength ? 'Full-length (all subjects)' : `Subject-wise (${subject})`}`
    );

    const questions: ParsedQuestion[] = [];

    // Extract year from book title (e.g., "NEET 2024" or "neet(ug)2024.pdf")
    const yearMatch = bookTitle.match(/(\d{4})/);
    const defaultYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
    const defaultExamType = bookTitle.match(/neet/i) ? 'NEET' : 'Exam';

    console.log(`📅 Detected year: ${defaultYear}, Exam type: ${defaultExamType}`);

    // Clean up the text
    const cleanText = pdfText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`📏 Total text length: ${cleanText.length} characters`);

    // Multiple regex patterns to handle different question formats
    // Pattern 1: Standard NEET format - tight spacing
    const pattern1 =
      /(\d{1,3})\.[\s\n]+(.+?)[\s\n]+\(1\)[\s\n]*(.+?)[\s\n]+\(2\)[\s\n]*(.+?)[\s\n]+\(3\)[\s\n]*(.+?)[\s\n]+\(4\)[\s\n]*(.+?)(?=\n\s*\d{1,3}\.|\n{3,}|SECTION|$)/gis;

    // Pattern 2: Format with possible diagram gaps (more permissive)
    const pattern2 =
      /(\d{1,3})\.[\s\n]+(.+?)[\s\n]*\(1\)[\s\n]*(.+?)[\s\n]*\(2\)[\s\n]*(.+?)[\s\n]*\(3\)[\s\n]*(.+?)[\s\n]*\(4\)[\s\n]*(.+?)(?=\n\s*\d{1,3}\.|\n{3,}|SECTION|$)/gis;

    // Pattern 3: Minimal format - allows very large gaps for diagrams
    const pattern3 =
      /(\d{1,3})\.(.+?)\(1\)(.+?)\(2\)(.+?)\(3\)(.+?)\(4\)(.+?)(?=\d{1,3}\.|SECTION|$)/gis;

    // Pattern 4: Ultra-permissive - for questions with extensive diagrams/tables
    const pattern4 =
      /(\d{1,3})\.\s*(.+?)\s*\(1\)\s*(.+?)\s*\(2\)\s*(.+?)\s*\(3\)\s*(.+?)\s*\(4\)\s*(.+?)(?=\s*\d{1,3}\.\s|\s*SECTION|\s*$)/gis;

    // Pattern 5: Match questions where options might have line breaks within them
    const pattern5 =
      /(\d{1,3})\.[\s\S]{1,1500}?\(1\)[\s\S]{1,500}?\(2\)[\s\S]{1,500}?\(3\)[\s\S]{1,500}?\(4\)[\s\S]{1,500}?(?=\d{1,3}\.|SECTION|$)/gis;

    const patterns = [pattern1, pattern2, pattern3, pattern4, pattern5];
    const extractedQuestions = new Set<number>(); // Track question numbers to avoid duplicates
    let match: RegExpExecArray | null;

    // Try each pattern in sequence
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      pattern.lastIndex = 0; // Reset regex state

      console.log(`\n🔍 Trying pattern ${i + 1}...`);
      let patternMatchCount = 0;

      while ((match = pattern.exec(cleanText)) !== null) {
        const [, questionNum, questionText, optA, optB, optC, optD] = match;
        const qNum = parseInt(questionNum, 10);

        // Skip if we already extracted this question number
        if (extractedQuestions.has(qNum)) {
          continue;
        }

        if (questionText && optA && optB && optC && optD) {
          const cleanQ = questionText.replace(/\s+/g, ' ').trim();
          const cleanA = optA.replace(/\s+/g, ' ').trim();
          const cleanB = optB.replace(/\s+/g, ' ').trim();
          const cleanC = optC.replace(/\s+/g, ' ').trim();
          const cleanD = optD.replace(/\s+/g, ' ').trim();

          // Validate: question and options shouldn't be too long or too short
          if (
            cleanQ.length > 10 &&
            cleanQ.length < 2000 &&
            cleanA.length > 1 &&
            cleanA.length < 500 &&
            cleanB.length > 1 &&
            cleanB.length < 500 &&
            cleanC.length > 1 &&
            cleanC.length < 500 &&
            cleanD.length > 1 &&
            cleanD.length < 500
          ) {
            // For full-length papers, detect subject from question text
            const detectedSubject = isFullLength ? this.detectSubjectFromQuestion(cleanQ) : subject;

            // Format question text (handle tables, etc.)
            const formattedQ = this.formatQuestionText(cleanQ);

            // Detect diagram using scraping method
            const allOptions = `${cleanA} ${cleanB} ${cleanC} ${cleanD}`;
            const diagramInfo = this.detectDiagram(cleanQ, allOptions);

            // Extract structured data (truth tables, match lists)
            const structuredData = this.extractStructuredData(cleanQ);

            questions.push({
              questionText: formattedQ.substring(0, 2000), // Allow longer for HTML tables
              optionA: cleanA.substring(0, 500),
              optionB: cleanB.substring(0, 500),
              optionC: cleanC.substring(0, 500),
              optionD: cleanD.substring(0, 500),
              correctAnswer: 'A', // Default answer - will need to be set manually or from answer key
              subject: detectedSubject,
              topic: `${defaultExamType} ${defaultYear}`, // Set topic as exam year
              difficulty: 'medium',
              examYear: defaultYear, // Store the year
              examType: defaultExamType, // Store exam type
              // Scraping method fields
              hasDiagram: diagramInfo.hasDiagram,
              diagramDescription: diagramInfo.description,
              structuredData: structuredData || undefined,
            });
            extractedQuestions.add(qNum);
            patternMatchCount++;
          }
        }
      }

      console.log(`   ✅ Pattern ${i + 1} matched ${patternMatchCount} new questions`);
    }

    console.log(`\n✅ TOTAL PYQ QUESTIONS EXTRACTED: ${questions.length}\n`);

    // Diagnostic: Show which question numbers are missing
    if (questions.length < 200) {
      const extractedNums = Array.from(extractedQuestions).sort((a, b) => a - b);
      const missing: number[] = [];
      for (let i = 1; i <= 200; i++) {
        if (!extractedQuestions.has(i)) {
          missing.push(i);
        }
      }
      console.log(`   📊 Extracted question numbers: ${extractedNums.join(', ')}`);
      console.log(`   ❌ Missing question numbers (${missing.length}): ${missing.join(', ')}\n`);
    }

    return questions;
  }

  /**
   * Process uploaded PDF book and extract questions
   * This runs asynchronously in the background
   */
  static async processBook(bookId: string): Promise<void> {
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

      // Parse PDF
      console.log(`📚 Processing book: ${book.title}`);
      console.log(`📚 Book type: ${book.bookType}`);
      const pdfText = await this.parsePDF(book.filePath);
      const subject = book.subject || 'physics';

      // Extract questions based on book type
      console.log('📋 Extracting questions...');
      let parsedQuestions: ParsedQuestion[];

      if (book.bookType === 'pyq') {
        // PYQ book - use year-wise extraction
        const isFullLength = book.pyqType === 'full_length';
        parsedQuestions = await this.extractPYQQuestions(
          pdfText,
          subject,
          book.title,
          isFullLength
        );
      } else {
        // Standard book - use chapter-wise extraction
        parsedQuestions = await this.extractQuestions(pdfText, subject);
      }

      // Extract embedded diagram images from PDF using pdfimages
      let diagramMap = new Map<number, ExtractedDiagramImage>();
      try {
        // Get page count for mapping
        const totalPages = await PDFImageService.getPageCount(book.filePath);
        console.log(`📄 PDF has ${totalPages} pages`);

        // Extract embedded diagrams
        const diagramsByPage = await PDFImageService.extractEmbeddedDiagrams(book.filePath, bookId);

        if (diagramsByPage.size > 0) {
          // Map diagrams to questions based on page positions
          diagramMap = PDFImageService.mapDiagramsToQuestions(
            diagramsByPage,
            parsedQuestions.length,
            totalPages,
            2 // Start from page 2 (skip instruction page)
          );
        }
      } catch (imgError: any) {
        console.log(`   ⚠️  Diagram extraction failed: ${imgError.message}`);
      }

      // Assign extracted diagrams to questions that need them
      if (diagramMap.size > 0) {
        console.log(`📎 Assigning ${diagramMap.size} extracted diagrams to questions...`);

        let assignedCount = 0;
        for (let i = 0; i < parsedQuestions.length; i++) {
          const q = parsedQuestions[i];
          const questionNumber = i + 1;

          // Only assign diagram if question was detected as needing one
          if (q.hasDiagram) {
            const diagram = diagramMap.get(questionNumber);
            if (diagram) {
              parsedQuestions[i].questionImage = diagram.imageUrl;
              assignedCount++;
            }
          }
        }

        console.log(`   ✅ Assigned ${assignedCount} diagrams to questions with hasDiagram=true`);
      }

      // Save questions to database with examYear, examType, structured data, and diagram info
      let savedCount = 0;
      let diagramCount = 0;
      let structuredDataCount = 0;

      for (const q of parsedQuestions) {
        // Track stats
        if (q.hasDiagram) diagramCount++;
        if (q.structuredData) structuredDataCount++;

        await db.insert(questions).values({
          bookId: bookId,
          subject: q.subject,
          topic: q.topic || '',
          subtopic: q.subtopic,
          questionText: q.questionText,
          questionImage: q.questionImage,
          optionA: q.optionA,
          optionAImage: q.optionAImage,
          optionB: q.optionB,
          optionBImage: q.optionBImage,
          optionC: q.optionC,
          optionCImage: q.optionCImage,
          optionD: q.optionD,
          optionDImage: q.optionDImage,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          difficulty: q.difficulty || 'medium',
          questionNumber: savedCount + 1,
          questionType: 'single_correct',
          marksPositive: '4.00',
          marksNegative: '1.00',
          examYear: q.examYear,
          // Scraping method fields
          hasDiagram: q.hasDiagram || false,
          diagramDescription: q.diagramDescription,
          structuredData: q.structuredData ? JSON.stringify(q.structuredData) : null,
          examType: q.examType,
        });
        savedCount++;
      }

      // Update book status to completed
      await db
        .update(books)
        .set({
          uploadStatus: 'completed',
          processingCompletedAt: new Date(),
          totalQuestionsExtracted: savedCount,
        })
        .where(eq(books.id, bookId));

      console.log(`✅ Successfully extracted ${savedCount} questions from ${book.title}`);
      console.log(`   📊 Diagrams detected: ${diagramCount} questions`);
      console.log(`   📊 Structured data (tables): ${structuredDataCount} questions`);
    } catch (error: any) {
      console.error(`❌ Error processing book ${bookId}:`, error);

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
   * Simulate async processing with delay
   * In production, this would be handled by a job queue (Bull, BullMQ)
   */
  static processBookAsync(bookId: string): void {
    // Process in background (don't await)
    setTimeout(() => {
      this.processBook(bookId).catch((error) => {
        console.error('Background processing error:', error);
      });
    }, 1000); // Start processing after 1 second
  }
}
