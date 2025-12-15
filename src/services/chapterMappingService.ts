import { db } from '../config/database';
import { questions, curriculumChapters } from '../models/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { compareTwoStrings } from 'string-similarity';

// ============================================================================
// TYPES
// ============================================================================

export interface MappingResult {
  totalProcessed: number;
  autoMapped: number;
  uncertain: number;
  unmapped: number;
  errors: number;
}

export interface UncertainMapping {
  questionId: string;
  topic: string;
  subject: string;
  suggestedChapters: Array<{
    id: string;
    name: string;
    score: number;
    gradeLevel: string;
  }>;
}

export interface ChapterStatistics {
  totalQuestions: number;
  pyqCount: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize a string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

/**
 * Calculate similarity between two strings
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);
  return compareTwoStrings(normalized1, normalized2);
}

// ============================================================================
// CHAPTER MAPPING SERVICE
// ============================================================================

export class ChapterMappingService {
  /**
   * Auto-map questions to curriculum chapters based on fuzzy matching
   * @param threshold - Minimum similarity score (0-1) to auto-map
   * @param subjectCode - Optional: Only map questions for specific subject
   * @param dryRun - If true, return preview without making changes
   */
  async autoMapQuestions(
    threshold: number = 0.85,
    subjectCode?: string,
    dryRun: boolean = false
  ): Promise<MappingResult> {
    console.log(`🔍 Starting auto-mapping with threshold: ${threshold}`);
    console.log(`   Dry run: ${dryRun ? 'Yes' : 'No'}`);
    if (subjectCode) console.log(`   Subject filter: ${subjectCode}`);

    const result: MappingResult = {
      totalProcessed: 0,
      autoMapped: 0,
      uncertain: 0,
      unmapped: 0,
      errors: 0,
    };

    try {
      // Get all chapters for matching
      const allChapters = await db.select().from(curriculumChapters);
      console.log(`✅ Loaded ${allChapters.length} curriculum chapters\n`);

      // Group chapters by subject for efficient matching
      const chaptersBySubject = new Map<string, typeof allChapters>();
      for (const chapter of allChapters) {
        const subjectId = chapter.subjectId;
        if (!chaptersBySubject.has(subjectId)) {
          chaptersBySubject.set(subjectId, []);
        }
        chaptersBySubject.get(subjectId)!.push(chapter);
      }

      // Get unmapped questions
      let unmappedQuestions;
      if (subjectCode) {
        unmappedQuestions = await db
          .select()
          .from(questions)
          .where(and(isNull(questions.curriculumChapterId), eq(questions.subject, subjectCode)));
      } else {
        unmappedQuestions = await db
          .select()
          .from(questions)
          .where(isNull(questions.curriculumChapterId));
      }

      console.log(`📊 Found ${unmappedQuestions.length} unmapped questions\n`);
      result.totalProcessed = unmappedQuestions.length;

      // Process each question
      for (const question of unmappedQuestions) {
        try {
          // Find best matching chapter
          const { chapterId, score } = await this.findBestMatch(
            question.topic,
            question.subject,
            chaptersBySubject
          );

          if (score >= threshold && chapterId) {
            // Auto-map with high confidence
            if (!dryRun) {
              await db
                .update(questions)
                .set({ curriculumChapterId: chapterId })
                .where(eq(questions.id, question.id));
            }
            result.autoMapped++;

            if (result.autoMapped % 50 === 0) {
              console.log(`  ✓ Auto-mapped ${result.autoMapped} questions...`);
            }
          } else if (score >= 0.5 && score < threshold) {
            // Uncertain - needs review
            result.uncertain++;
          } else {
            // No good match
            result.unmapped++;
          }
        } catch (error) {
          console.error(`  ❌ Error processing question ${question.id}:`, error);
          result.errors++;
        }
      }

      // Summary
      console.log('\n' + '═'.repeat(60));
      console.log('📊 AUTO-MAPPING SUMMARY');
      console.log('═'.repeat(60));
      console.log(`Total processed:     ${result.totalProcessed}`);
      console.log(`Auto-mapped (≥${threshold}):   ${result.autoMapped} ✓`);
      console.log(`Uncertain (0.5-${threshold}): ${result.uncertain} ⚠`);
      console.log(`Unmapped (<0.5):     ${result.unmapped}`);
      console.log(`Errors:              ${result.errors}`);
      console.log('═'.repeat(60) + '\n');

      return result;
    } catch (error) {
      console.error('❌ Error in auto-mapping:', error);
      throw error;
    }
  }

  /**
   * Find the best matching chapter for a topic
   */
  private async findBestMatch(
    topic: string,
    subject: string,
    chaptersBySubject: Map<string, any[]>
  ): Promise<{ chapterId: string | null; score: number }> {
    let bestScore = 0;
    let bestChapterId: string | null = null;

    // Get chapters for this subject
    for (const chapters of chaptersBySubject.values()) {
      for (const chapter of chapters) {
        const score = calculateSimilarity(topic, chapter.name);
        if (score > bestScore) {
          bestScore = score;
          bestChapterId = chapter.id;
        }
      }
    }

    return { chapterId: bestChapterId, score: bestScore };
  }

  /**
   * Get questions with uncertain mappings for admin review
   */
  async getUncertainMappings(
    minScore: number = 0.5,
    maxScore: number = 0.85,
    limit: number = 100
  ): Promise<UncertainMapping[]> {
    console.log(`🔍 Finding uncertain mappings (score ${minScore}-${maxScore})...`);

    const uncertainMappings: UncertainMapping[] = [];

    // Get all chapters
    const allChapters = await db.select().from(curriculumChapters);

    // Get unmapped questions (limited for performance)
    const unmappedQuestions = await db
      .select()
      .from(questions)
      .where(isNull(questions.curriculumChapterId))
      .limit(limit);

    console.log(`Analyzing ${unmappedQuestions.length} questions...\n`);

    for (const question of unmappedQuestions) {
      // Find all chapters with similarity scores
      const matches = allChapters.map((chapter) => ({
        id: chapter.id,
        name: chapter.name,
        gradeLevel: chapter.gradeLevel,
        score: calculateSimilarity(question.topic, chapter.name),
      }));

      // Filter and sort by score
      const filteredMatches = matches
        .filter((m) => m.score >= minScore && m.score <= maxScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3); // Top 3 matches

      if (filteredMatches.length > 0) {
        uncertainMappings.push({
          questionId: question.id,
          topic: question.topic,
          subject: question.subject,
          suggestedChapters: filteredMatches,
        });
      }
    }

    console.log(`Found ${uncertainMappings.length} uncertain mappings\n`);
    return uncertainMappings;
  }

  /**
   * Manually map a question to a chapter
   */
  async manualMapQuestion(questionId: string, chapterId: string): Promise<void> {
    console.log(`🔗 Manually mapping question ${questionId} to chapter ${chapterId}`);

    try {
      await db
        .update(questions)
        .set({ curriculumChapterId: chapterId })
        .where(eq(questions.id, questionId));

      console.log('✅ Mapping successful\n');
    } catch (error) {
      console.error('❌ Error mapping question:', error);
      throw error;
    }
  }

  /**
   * Unmap a question from its chapter
   */
  async unmapQuestion(questionId: string): Promise<void> {
    console.log(`🔓 Unmapping question ${questionId}`);

    try {
      await db
        .update(questions)
        .set({ curriculumChapterId: null })
        .where(eq(questions.id, questionId));

      console.log('✅ Unmapping successful\n');
    } catch (error) {
      console.error('❌ Error unmapping question:', error);
      throw error;
    }
  }

  /**
   * Update chapter statistics (question counts)
   */
  async updateChapterStatistics(chapterId?: string): Promise<void> {
    console.log('📊 Updating chapter statistics...');

    try {
      // Get chapters to update
      const chaptersToUpdate = chapterId
        ? await db.select().from(curriculumChapters).where(eq(curriculumChapters.id, chapterId))
        : await db.select().from(curriculumChapters);

      console.log(`Updating ${chaptersToUpdate.length} chapter(s)...\n`);

      for (const chapter of chaptersToUpdate) {
        // Get statistics for this chapter
        const stats = await this.calculateChapterStatistics(chapter.id);

        // Update chapter
        await db
          .update(curriculumChapters)
          .set({
            totalQuestions: stats.totalQuestions,
            pyqCount: stats.pyqCount,
            easyCount: stats.easyCount,
            mediumCount: stats.mediumCount,
            hardCount: stats.hardCount,
            updatedAt: new Date(),
          })
          .where(eq(curriculumChapters.id, chapter.id));

        console.log(
          `  ✓ ${chapter.name}: ${stats.totalQuestions} questions (PYQ: ${stats.pyqCount})`
        );
      }

      console.log('\n✅ Statistics updated successfully\n');
    } catch (error) {
      console.error('❌ Error updating statistics:', error);
      throw error;
    }
  }

  /**
   * Calculate statistics for a specific chapter
   */
  private async calculateChapterStatistics(chapterId: string): Promise<ChapterStatistics> {
    const chapterQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.curriculumChapterId, chapterId));

    const stats: ChapterStatistics = {
      totalQuestions: chapterQuestions.length,
      pyqCount: chapterQuestions.filter((q) => q.examYear !== null).length,
      easyCount: chapterQuestions.filter((q) => q.difficulty === 'easy').length,
      mediumCount: chapterQuestions.filter((q) => q.difficulty === 'medium').length,
      hardCount: chapterQuestions.filter((q) => q.difficulty === 'hard').length,
    };

    return stats;
  }

  /**
   * Generate mapping report
   */
  async generateMappingReport(): Promise<any> {
    console.log('📊 Generating mapping report...\n');

    try {
      // Get all chapters
      const allChapters = await db.select().from(curriculumChapters);

      // Get total questions
      const allQuestions = await db.select().from(questions);

      // Get mapped questions
      const mappedQuestions = allQuestions.filter((q) => q.curriculumChapterId);

      // Calculate coverage by subject
      const report = {
        totalChapters: allChapters.length,
        totalQuestions: allQuestions.length,
        mappedQuestions: mappedQuestions.length,
        unmappedQuestions: allQuestions.length - mappedQuestions.length,
        mappingPercentage: ((mappedQuestions.length / allQuestions.length) * 100).toFixed(2),
        byChapter: allChapters.map((chapter) => ({
          chapterId: chapter.id,
          name: chapter.name,
          gradeLevel: chapter.gradeLevel,
          totalQuestions: chapter.totalQuestions,
          pyqCount: chapter.pyqCount,
        })),
      };

      console.log('═'.repeat(60));
      console.log('📊 MAPPING REPORT');
      console.log('═'.repeat(60));
      console.log(`Total Chapters:       ${report.totalChapters}`);
      console.log(`Total Questions:      ${report.totalQuestions}`);
      console.log(`Mapped Questions:     ${report.mappedQuestions} ✓`);
      console.log(`Unmapped Questions:   ${report.unmappedQuestions} ⚠`);
      console.log(`Mapping Percentage:   ${report.mappingPercentage}%`);
      console.log('═'.repeat(60) + '\n');

      return report;
    } catch (error) {
      console.error('❌ Error generating report:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const chapterMappingService = new ChapterMappingService();
