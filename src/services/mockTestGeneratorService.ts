import { db } from '../config/database';
import { questions, subjects } from '../models/schema';
import { eq, and, sql, inArray, isNotNull } from 'drizzle-orm';

/**
 * Mock Test Generator Service
 * Handles automatic question selection with proper shuffling and distribution
 */

// NEET standard configuration
const NEET_CONFIG = {
  fullTest: {
    totalQuestions: 180,
    duration: 200, // 3 hours 20 minutes
    totalMarks: 720,
    subjectDistribution: {
      physics: 45,
      chemistry: 45,
      botany: 45,
      zoology: 45,
    },
    // Alternative if biology is not split into botany/zoology
    altSubjectDistribution: {
      physics: 45,
      chemistry: 45,
      biology: 90,
    },
  },
  subjectWise: {
    physics: { questions: 45, duration: 50, marks: 180 },
    chemistry: { questions: 45, duration: 50, marks: 180 },
    botany: { questions: 45, duration: 50, marks: 180 },
    zoology: { questions: 45, duration: 50, marks: 180 },
    biology: { questions: 90, duration: 100, marks: 360 },
  },
  difficultyDistribution: {
    easy: 0.3, // 30%
    medium: 0.5, // 50%
    hard: 0.2, // 20%
  },
};

interface QuestionSelection {
  id: string;
  subject: string;
  difficulty: string;
  questionNumber: number;
}

interface GenerateOptions {
  testType: 'full_test' | 'subject_wise' | 'chapter_wise';
  subject?: string; // Required for subject_wise
  topic?: string; // Required for chapter_wise
  totalQuestions?: number;
  excludeQuestionIds?: string[]; // Questions to exclude (already used in other tests)
  preferPYQ?: boolean; // Prefer PYQ questions
  yearRange?: { from: number; to: number }; // Filter by year range
}

interface GeneratedTest {
  questionIds: string[];
  distribution: {
    bySubject: Record<string, number>;
    byDifficulty: Record<string, number>;
  };
  totalQuestions: number;
  duration: number;
  totalMarks: number;
}

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get available questions count by subject and difficulty
 */
export async function getQuestionStats() {
  const stats = await db
    .select({
      subject: questions.subject,
      difficulty: questions.difficulty,
      count: sql<number>`count(*)::int`,
    })
    .from(questions)
    .where(eq(questions.isActive, true))
    .groupBy(questions.subject, questions.difficulty);

  const bySubject: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  const detailed: Record<string, Record<string, number>> = {};

  for (const stat of stats) {
    bySubject[stat.subject] = (bySubject[stat.subject] || 0) + stat.count;
    byDifficulty[stat.difficulty] = (byDifficulty[stat.difficulty] || 0) + stat.count;

    if (!detailed[stat.subject]) {
      detailed[stat.subject] = {};
    }
    detailed[stat.subject][stat.difficulty] = stat.count;
  }

  return {
    total: Object.values(bySubject).reduce((a, b) => a + b, 0),
    bySubject,
    byDifficulty,
    detailed,
  };
}

/**
 * Select questions for a subject with proper difficulty distribution
 */
async function selectQuestionsForSubject(
  subject: string,
  count: number,
  difficultyDistribution: Record<string, number>,
  excludeIds: string[] = [],
  preferPYQ: boolean = false
): Promise<string[]> {
  const selectedIds: string[] = [];

  // Calculate how many questions of each difficulty we need
  const difficultyNeeds = {
    easy: Math.round(count * difficultyDistribution.easy),
    medium: Math.round(count * difficultyDistribution.medium),
    hard: Math.round(count * difficultyDistribution.hard),
  };

  // Adjust to ensure we get exactly the count we need
  const totalNeeded = difficultyNeeds.easy + difficultyNeeds.medium + difficultyNeeds.hard;
  if (totalNeeded < count) {
    difficultyNeeds.medium += count - totalNeeded;
  } else if (totalNeeded > count) {
    difficultyNeeds.medium -= totalNeeded - count;
  }

  // For each difficulty level, fetch and select questions
  for (const [difficulty, needed] of Object.entries(difficultyNeeds)) {
    if (needed <= 0) continue;

    // Build conditions
    const conditions = [
      eq(questions.subject, subject),
      eq(questions.difficulty, difficulty as 'easy' | 'medium' | 'hard'),
      eq(questions.isActive, true),
    ];

    // Exclude already selected or excluded questions
    const allExcluded = [...excludeIds, ...selectedIds];
    if (allExcluded.length > 0) {
      conditions.push(
        sql`${questions.id} NOT IN (${sql.join(
          allExcluded.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
    }

    // Build base query and execute with ordering based on preferPYQ
    const baseQuery = db
      .select({ id: questions.id })
      .from(questions)
      .where(and(...conditions)) as any;

    const availableQuestions = preferPYQ
      ? await baseQuery
          .orderBy(
            sql`CASE WHEN ${questions.examYear} IS NOT NULL THEN 0 ELSE 1 END`,
            sql`RANDOM()`
          )
          .limit(needed)
      : await baseQuery.orderBy(sql`RANDOM()`).limit(needed);
    selectedIds.push(...availableQuestions.map((q: any) => q.id));
  }

  // If we didn't get enough questions due to availability, try to fill with any difficulty
  if (selectedIds.length < count) {
    const remaining = count - selectedIds.length;
    const allExcluded = [...excludeIds, ...selectedIds];

    const conditions = [eq(questions.subject, subject), eq(questions.isActive, true)];

    if (allExcluded.length > 0) {
      conditions.push(
        sql`${questions.id} NOT IN (${sql.join(
          allExcluded.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
    }

    const moreQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(...conditions))
      .orderBy(sql`RANDOM()`)
      .limit(remaining);

    selectedIds.push(...moreQuestions.map((q) => q.id));
  }

  return shuffleArray(selectedIds);
}

/**
 * Generate a full NEET mock test (180 questions)
 */
export async function generateFullTest(
  excludeIds: string[] = [],
  preferPYQ: boolean = false
): Promise<GeneratedTest> {
  const selectedIds: string[] = [];
  const distribution = {
    bySubject: {} as Record<string, number>,
    byDifficulty: {} as Record<string, number>,
  };

  // Check what subjects we have
  const stats = await getQuestionStats();
  const hasDetailedBiology =
    (stats.bySubject['botany'] || 0) > 0 && (stats.bySubject['zoology'] || 0) > 0;

  const subjectDistribution = hasDetailedBiology
    ? NEET_CONFIG.fullTest.subjectDistribution
    : NEET_CONFIG.fullTest.altSubjectDistribution;

  // Select questions for each subject
  for (const [subject, count] of Object.entries(subjectDistribution)) {
    const subjectQuestions = await selectQuestionsForSubject(
      subject,
      count,
      NEET_CONFIG.difficultyDistribution,
      [...excludeIds, ...selectedIds],
      preferPYQ
    );

    selectedIds.push(...subjectQuestions);
    distribution.bySubject[subject] = subjectQuestions.length;
  }

  // Get difficulty breakdown
  if (selectedIds.length > 0) {
    const difficultyStats = await db
      .select({
        difficulty: questions.difficulty,
        count: sql<number>`count(*)::int`,
      })
      .from(questions)
      .where(inArray(questions.id, selectedIds))
      .groupBy(questions.difficulty);

    for (const stat of difficultyStats) {
      distribution.byDifficulty[stat.difficulty] = stat.count;
    }
  }

  // Final shuffle of all questions
  const shuffledIds = shuffleArray(selectedIds);

  return {
    questionIds: shuffledIds,
    distribution,
    totalQuestions: shuffledIds.length,
    duration: NEET_CONFIG.fullTest.duration,
    totalMarks: shuffledIds.length * 4,
  };
}

/**
 * Generate a subject-wise mock test
 */
export async function generateSubjectWiseTest(
  subject: string,
  excludeIds: string[] = [],
  preferPYQ: boolean = false
): Promise<GeneratedTest> {
  // Normalize subject name
  const normalizedSubject = subject.toLowerCase();
  const config = NEET_CONFIG.subjectWise[normalizedSubject as keyof typeof NEET_CONFIG.subjectWise];

  if (!config) {
    throw new Error(
      `Invalid subject: ${subject}. Valid subjects: physics, chemistry, botany, zoology, biology`
    );
  }

  const selectedIds = await selectQuestionsForSubject(
    normalizedSubject,
    config.questions,
    NEET_CONFIG.difficultyDistribution,
    excludeIds,
    preferPYQ
  );

  // Get difficulty breakdown
  const distribution = {
    bySubject: { [normalizedSubject]: selectedIds.length },
    byDifficulty: {} as Record<string, number>,
  };

  if (selectedIds.length > 0) {
    const difficultyStats = await db
      .select({
        difficulty: questions.difficulty,
        count: sql<number>`count(*)::int`,
      })
      .from(questions)
      .where(inArray(questions.id, selectedIds))
      .groupBy(questions.difficulty);

    for (const stat of difficultyStats) {
      distribution.byDifficulty[stat.difficulty] = stat.count;
    }
  }

  return {
    questionIds: shuffleArray(selectedIds),
    distribution,
    totalQuestions: selectedIds.length,
    duration: config.duration,
    totalMarks: selectedIds.length * 4,
  };
}

/**
 * Generate a custom mock test with specified parameters
 */
export async function generateCustomTest(options: {
  subjects: string[];
  questionsPerSubject: number;
  difficultyDistribution?: Record<string, number>;
  excludeIds?: string[];
  preferPYQ?: boolean;
}): Promise<GeneratedTest> {
  const {
    subjects: requestedSubjects,
    questionsPerSubject,
    difficultyDistribution = NEET_CONFIG.difficultyDistribution,
    excludeIds = [],
    preferPYQ = false,
  } = options;

  const selectedIds: string[] = [];
  const distribution = {
    bySubject: {} as Record<string, number>,
    byDifficulty: {} as Record<string, number>,
  };

  for (const subject of requestedSubjects) {
    const subjectQuestions = await selectQuestionsForSubject(
      subject.toLowerCase(),
      questionsPerSubject,
      difficultyDistribution,
      [...excludeIds, ...selectedIds],
      preferPYQ
    );

    selectedIds.push(...subjectQuestions);
    distribution.bySubject[subject.toLowerCase()] = subjectQuestions.length;
  }

  // Get difficulty breakdown
  if (selectedIds.length > 0) {
    const difficultyStats = await db
      .select({
        difficulty: questions.difficulty,
        count: sql<number>`count(*)::int`,
      })
      .from(questions)
      .where(inArray(questions.id, selectedIds))
      .groupBy(questions.difficulty);

    for (const stat of difficultyStats) {
      distribution.byDifficulty[stat.difficulty] = stat.count;
    }
  }

  const shuffledIds = shuffleArray(selectedIds);

  return {
    questionIds: shuffledIds,
    distribution,
    totalQuestions: shuffledIds.length,
    duration: Math.ceil(shuffledIds.length * 1.1), // ~1.1 min per question
    totalMarks: shuffledIds.length * 4,
  };
}

/**
 * Get existing question IDs used in other mock tests (for exclusion)
 */
export async function getUsedQuestionIds(excludeMockTestId?: string): Promise<string[]> {
  const { mockTestQuestions } = await import('../models/schema');

  const baseQuery = db.select({ questionId: mockTestQuestions.questionId }).from(mockTestQuestions);

  let rows: any[];
  if (excludeMockTestId) {
    rows = await baseQuery.where(sql`${mockTestQuestions.mockTestId} != ${excludeMockTestId}`);
  } else {
    rows = await baseQuery;
  }

  return rows.map((u) => u.questionId);
}

export default {
  getQuestionStats,
  generateFullTest,
  generateSubjectWiseTest,
  generateCustomTest,
  getUsedQuestionIds,
};
