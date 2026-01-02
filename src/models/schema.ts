import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  text,
  pgEnum,
  integer,
  decimal,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

// User roles enum
export const userRoleEnum = pgEnum('user_role', ['admin', 'student']);

// Question difficulty enum
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);

// Question type enum (answer format)
export const questionTypeEnum = pgEnum('question_type', [
  'single_correct',
  'multiple_correct',
  'assertion_reason',
  'integer_type',
  'match_list',
]);

// Cognitive level enum (what skill the question tests)
export const cognitiveLevelEnum = pgEnum('cognitive_level', [
  'fact',
  'conceptual',
  'numerical',
  'assertion',
]);

// Exam status enum
export const examStatusEnum = pgEnum('exam_status', ['draft', 'published', 'archived']);

// Student exam status enum
export const studentExamStatusEnum = pgEnum('student_exam_status', [
  'not_started',
  'in_progress',
  'submitted',
  'evaluated',
]);

// Mock test type enum
export const mockTestTypeEnum = pgEnum('mock_test_type', [
  'full_test',
  'subject_wise',
  'chapter_wise',
]);

// Book upload status enum
export const bookUploadStatusEnum = pgEnum('book_upload_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

// Book type enum
export const bookTypeEnum = pgEnum('book_type', [
  'pyq', // Previous Year Questions
  'standard', // Standard book questions
]);

// PYQ type enum (only applicable when book_type is 'pyq')
export const pyqTypeEnum = pgEnum('pyq_type', [
  'subject_wise', // Subject-wise PYQ
  'full_length', // Full length PYQ
]);

// Grade level enum for curriculum chapters
export const gradeLevelEnum = pgEnum('grade_level', ['11', '12']);

// Chapter status enum for curriculum management
export const chapterStatusEnum = pgEnum('chapter_status', [
  'draft', // Initial state, not ready for students
  'active', // Currently active in curriculum
  'archived', // Removed from current curriculum
  'under_review', // Being updated/reviewed
]);

// AI chat message role enum
export const aiMessageRoleEnum = pgEnum('ai_message_role', ['user', 'assistant']);

// ============================================================================
// USERS TABLE
// ============================================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(), // bcrypt hashed password
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 15 }),
  role: userRoleEnum('role').notNull().default('student'),
  registrationNumber: varchar('registration_number', { length: 50 }).unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  resetPasswordToken: text('reset_password_token'),
  resetPasswordExpiry: timestamp('reset_password_expiry'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// SUBJECTS TABLE (Dynamic subject management)
// ============================================================================

export const subjects = pgTable('subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(), // Display name: "Physics", "Botany"
  code: varchar('code', { length: 50 }).notNull().unique(), // URL-friendly code: "physics", "botany"
  description: text('description'),
  icon: varchar('icon', { length: 100 }), // Optional icon/emoji
  displayOrder: integer('display_order').notNull().default(0), // For ordering in UI
  isActive: boolean('is_active').notNull().default(true), // Toggle visibility
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// CURRICULUM CHAPTERS TABLE (Master curriculum structure)
// ============================================================================

export const curriculumChapters = pgTable('curriculum_chapters', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Core chapter information
  subjectId: uuid('subject_id')
    .references(() => subjects.id, { onDelete: 'restrict' })
    .notNull(),
  chapterNumber: integer('chapter_number').notNull(), // 1-29 for Physics, etc.
  name: varchar('name', { length: 500 }).notNull(),
  slug: varchar('slug', { length: 500 }).notNull(), // URL-friendly: "laws-of-motion"
  description: text('description'), // Chapter overview
  gradeLevel: gradeLevelEnum('grade_level').notNull(), // '11' or '12'

  // Status and visibility
  status: chapterStatusEnum('status').notNull().default('draft'),
  isActive: boolean('is_active').notNull().default(true), // Quick toggle
  isPublished: boolean('is_published').notNull().default(false), // Published to students

  // Curriculum metadata
  syllabusYear: integer('syllabus_year').notNull().default(2024), // NEET syllabus year
  estimatedHours: integer('estimated_hours'), // Study time estimate
  difficultyLevel: difficultyEnum('difficulty_level'), // Overall chapter difficulty
  weightage: integer('weightage'), // Expected questions in NEET (1-5)

  // Question statistics (computed/cached values)
  totalQuestions: integer('total_questions').default(0), // Count of mapped questions
  pyqCount: integer('pyq_count').default(0), // PYQ questions count
  easyCount: integer('easy_count').default(0),
  mediumCount: integer('medium_count').default(0),
  hardCount: integer('hard_count').default(0),

  // Admin fields
  displayOrder: integer('display_order').notNull(), // For custom sorting
  notes: text('notes'), // Internal notes for admins
  lastReviewedAt: timestamp('last_reviewed_at'),
  lastReviewedBy: uuid('last_reviewed_by').references(() => users.id, { onDelete: 'set null' }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'), // When first published to students
});

// ============================================================================
// PAPERS TABLE (Year-wise NEET papers)
// ============================================================================

export const papers = pgTable('papers', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(), // e.g., "NEET 2023"
  description: text('description'),
  year: integer('year').notNull(), // 2023, 2024, etc.
  duration: integer('duration').notNull(), // in minutes (180 for NEET)
  totalMarks: integer('total_marks').notNull().default(720), // 720 for NEET
  totalQuestions: integer('total_questions').notNull().default(180), // 180 for NEET
  status: examStatusEnum('status').notNull().default('draft'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// BOOKS TABLE (PDF uploads for question extraction)
// ============================================================================

export const books = pgTable('books', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  filename: varchar('filename', { length: 500 }).notNull(), // Original filename
  filePath: text('file_path').notNull(), // Path where file is stored
  fileSize: integer('file_size').notNull(), // File size in bytes
  fileHash: varchar('file_hash', { length: 64 }), // SHA-256 hash for duplicate detection
  examName: varchar('exam_name', { length: 255 }), // AI-extracted exam name (e.g., "NEET", "JEE Main")
  examYear: integer('exam_year'), // AI-extracted year (e.g., 2024)
  subject: varchar('subject', { length: 50 }), // Subject code from subjects table
  bookType: bookTypeEnum('book_type').notNull().default('standard'), // PYQ or Standard book
  pyqType: pyqTypeEnum('pyq_type'), // Subject-wise or Full length (only for PYQ books)
  uploadStatus: bookUploadStatusEnum('upload_status').notNull().default('pending'),
  totalQuestionsExtracted: integer('total_questions_extracted').default(0),
  expectedQuestions: integer('expected_questions').default(200), // Expected total questions in this book (varies by book type)
  extractionProgress: integer('extraction_progress').default(0), // 0-100%
  currentStep: varchar('current_step', { length: 100 }), // e.g., 'Extracting page 5/27'
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  processingStartedAt: timestamp('processing_started_at'),
  processingCompletedAt: timestamp('processing_completed_at'),
  errorMessage: text('error_message'), // Error details if processing failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// API COST TRACKING TABLE
// ============================================================================

export const apiCostTracking = pgTable('api_cost_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id').references(() => books.id, { onDelete: 'cascade' }),
  apiProvider: varchar('api_provider', { length: 50 }).notNull(), // 'openai', 'gemini'
  modelName: varchar('model_name', { length: 100 }).notNull(),
  operationType: varchar('operation_type', { length: 50 }).notNull(), // 'page_analysis', 'diagram'
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  totalTokens: integer('total_tokens').default(0),
  estimatedCostUsd: varchar('estimated_cost_usd', { length: 20 }), // Stored as string for precision
  pageNumber: integer('page_number'),
  success: boolean('success').default(true),
  errorMessage: text('error_message'),
  processingTimeMs: integer('processing_time_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// PAGE-LEVEL EXTRACTION TRACKING
// ============================================================================

export const pageExtractionResults = pgTable('page_extraction_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id')
    .references(() => books.id, { onDelete: 'cascade' })
    .notNull(),
  pageNumber: integer('page_number').notNull(),
  pageImagePath: text('page_image_path'),
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'partial', 'failed'
  questionsExtracted: integer('questions_extracted').default(0),
  expectedQuestionRange: varchar('expected_question_range', { length: 50 }), // "Q1-Q10"
  extractedQuestions: text('extracted_questions'), // JSON: [1,2,3,4,5,6,7,8,9,10]
  missingQuestions: text('missing_questions'), // JSON: []
  errorMessage: text('error_message'),
  apiCost: varchar('api_cost', { length: 20 }), // Decimal stored as string
  processingTimeMs: integer('processing_time_ms'),
  retryCount: integer('retry_count').default(0),
  lastRetryAt: timestamp('last_retry_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// SECTION-LEVEL EXTRACTION TRACKING
// ============================================================================

export const sectionExtractionResults = pgTable('section_extraction_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id')
    .references(() => books.id, { onDelete: 'cascade' })
    .notNull(),
  subject: varchar('subject', { length: 50 }).notNull(),
  startPage: integer('start_page').notNull(),
  endPage: integer('end_page').notNull(),
  expectedQuestions: integer('expected_questions').notNull(),
  extractedQuestions: integer('extracted_questions').notNull(),
  missingQuestionNumbers: text('missing_question_numbers'), // JSON: [13, 36, 56]
  status: varchar('status', { length: 20 }).notNull(), // 'complete', 'partial', 'failed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// QUESTIONS TABLE
// ============================================================================

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  paperId: uuid('paper_id').references(() => papers.id, { onDelete: 'cascade' }),
  bookId: uuid('book_id').references(() => books.id, { onDelete: 'set null' }), // Source book if extracted from PDF
  curriculumChapterId: uuid('curriculum_chapter_id').references(() => curriculumChapters.id, {
    onDelete: 'set null',
  }), // Link to curriculum chapter
  subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }), // Foreign key to subjects table
  subject: varchar('subject', { length: 50 }).notNull(), // Legacy field - subject name for backward compatibility
  topic: varchar('topic', { length: 255 }).notNull(), // e.g., "Mechanics", "Organic Chemistry"
  subtopic: varchar('subtopic', { length: 255 }), // e.g., "Newton's Laws", "Alkanes"
  examYear: integer('exam_year'), // Year extracted from exam marker, e.g., 2020 from [NEET (Sep.) 2020]
  examType: varchar('exam_type', { length: 100 }), // e.g., "NEET", "CBSE AIPMT"
  questionText: text('question_text').notNull(),
  questionImage: text('question_image'), // URL to question image if any
  questionType: questionTypeEnum('question_type').notNull().default('single_correct'),
  cognitiveLevel: cognitiveLevelEnum('cognitive_level'), // What skill does this question test?
  optionA: text('option_a'),
  optionB: text('option_b'),
  optionC: text('option_c'),
  optionD: text('option_d'),
  optionAImage: text('option_a_image'),
  optionBImage: text('option_b_image'),
  optionCImage: text('option_c_image'),
  optionDImage: text('option_d_image'),
  correctAnswer: text('correct_answer'), // "A", "B", "C", "D", "AB", "1234" for integer type - nullable since we may not have answer key
  explanation: text('explanation'),
  explanationImage: text('explanation_image'),
  marksPositive: decimal('marks_positive', { precision: 4, scale: 2 }).notNull().default('4.00'), // +4 for correct
  marksNegative: decimal('marks_negative', { precision: 4, scale: 2 }).notNull().default('1.00'), // -1 for incorrect
  difficulty: difficultyEnum('difficulty').notNull().default('medium'),
  questionNumber: integer('question_number').notNull(), // Order in paper (1-180)
  isActive: boolean('is_active').notNull().default(true), // Toggle question visibility
  // Structured data fields for diagrams, tables, etc.
  hasDiagram: boolean('has_diagram').default(false), // True if question has a diagram/figure
  diagramDescription: text('diagram_description'), // Description of the diagram (e.g., "P-V diagram showing thermodynamic cycle")
  structuredData: text('structured_data'), // JSON string for tables, match lists, truth tables, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// MOCK TESTS TABLE
// ============================================================================

export const mockTests = pgTable('mock_tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  testType: mockTestTypeEnum('test_type').notNull().default('full_test'),
  subject: varchar('subject', { length: 50 }), // NULL for full test, specific for subject-wise
  duration: integer('duration').notNull(), // in minutes
  totalMarks: integer('total_marks').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  status: examStatusEnum('status').notNull().default('draft'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// MOCK TEST QUESTIONS (Many-to-many relationship)
// ============================================================================

export const mockTestQuestions = pgTable('mock_test_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  mockTestId: uuid('mock_test_id')
    .references(() => mockTests.id, { onDelete: 'cascade' })
    .notNull(),
  questionId: uuid('question_id')
    .references(() => questions.id, { onDelete: 'cascade' })
    .notNull(),
  questionOrder: integer('question_order').notNull(), // Order in mock test
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// STUDENT EXAMS (Exam attempts by students)
// ============================================================================

export const studentExams = pgTable('student_exams', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  paperId: uuid('paper_id').references(() => papers.id, { onDelete: 'cascade' }),
  mockTestId: uuid('mock_test_id').references(() => mockTests.id, { onDelete: 'cascade' }),
  status: studentExamStatusEnum('status').notNull().default('not_started'),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  submittedAt: timestamp('submitted_at'),
  totalScore: decimal('total_score', { precision: 6, scale: 2 }),
  correctAnswers: integer('correct_answers').default(0),
  incorrectAnswers: integer('incorrect_answers').default(0),
  unanswered: integer('unanswered').default(0),
  markedForReview: integer('marked_for_review').default(0),
  timeSpent: integer('time_spent'), // in seconds
  percentile: decimal('percentile', { precision: 5, scale: 2 }),
  rank: integer('rank'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// STUDENT ANSWERS
// ============================================================================

export const studentAnswers = pgTable('student_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentExamId: uuid('student_exam_id')
    .references(() => studentExams.id, { onDelete: 'cascade' })
    .notNull(),
  questionId: uuid('question_id')
    .references(() => questions.id, { onDelete: 'cascade' })
    .notNull(),
  selectedAnswer: text('selected_answer'), // NULL if unanswered
  isCorrect: boolean('is_correct'),
  marksObtained: decimal('marks_obtained', { precision: 4, scale: 2 }),
  isMarkedForReview: boolean('is_marked_for_review').default(false),
  timeSpent: integer('time_spent'), // in seconds for this question
  answeredAt: timestamp('answered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// QUESTION PRACTICE (For questionwise practice tracking)
// ============================================================================

export const questionPractice = pgTable('question_practice', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  questionId: uuid('question_id')
    .references(() => questions.id, { onDelete: 'cascade' })
    .notNull(),
  subject: varchar('subject', { length: 50 }).notNull(),
  topic: varchar('topic', { length: 255 }).notNull(),
  selectedAnswer: text('selected_answer'),
  isCorrect: boolean('is_correct'),
  attemptCount: integer('attempt_count').default(1),
  lastAttemptedAt: timestamp('last_attempted_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// CONTACT MESSAGES (For contact us page)
// ============================================================================

export const contactMessages = pgTable('contact_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 15 }),
  subject: varchar('subject', { length: 255 }).notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false),
  repliedAt: timestamp('replied_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// AI CHAT SESSIONS (For AI bot chat history management)
// ============================================================================

export const aiChatSessions = pgTable('ai_chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'), // Firebase UID (string) or JWT-based UUID - nullable for anonymous users
  sessionId: varchar('session_id', { length: 100 }).notNull().unique(), // unique identifier for anonymous sessions
  subjectCode: varchar('subject_code', { length: 50 }).notNull(),
  chapterSlug: varchar('chapter_slug', { length: 500 }).notNull(),
  isAnonymous: boolean('is_anonymous').notNull().default(true),
  deviceFingerprint: varchar('device_fingerprint', { length: 255 }), // optional tracking for anonymous users
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
});

// ============================================================================
// AI CHAT MESSAGES (Individual messages in chat sessions)
// ============================================================================

export const aiChatMessages = pgTable('ai_chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .references(() => aiChatSessions.id, { onDelete: 'cascade' })
    .notNull(),
  role: aiMessageRoleEnum('role').notNull(), // 'user' or 'assistant'
  content: text('content').notNull(),
  tokenCount: integer('token_count'), // track OpenAI tokens used
  model: varchar('model', { length: 50 }), // e.g., 'gpt-4', 'gpt-3.5-turbo'
  processingTimeMs: integer('processing_time_ms'), // AI response time
  metadata: text('metadata'), // JSON for additional data like chapter context
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// AI USAGE TRACKING (For cost and usage monitoring)
// ============================================================================

export const aiUsageTracking = pgTable('ai_usage_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'), // Firebase UID (string) or JWT-based UUID - nullable for anonymous
  sessionId: varchar('session_id', { length: 100 }), // for anonymous tracking
  date: timestamp('date').notNull().defaultNow(),
  questionCount: integer('question_count').notNull().default(1),
  totalTokensUsed: integer('total_tokens_used').notNull().default(0),
  totalCostUsd: decimal('total_cost_usd', { precision: 10, scale: 4 }).notNull().default('0'),
  model: varchar('model', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  studentExams: many(studentExams),
  questionPractice: many(questionPractice),
  reviewedChapters: many(curriculumChapters),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  curriculumChapters: many(curriculumChapters),
}));

export const curriculumChaptersRelations = relations(curriculumChapters, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [curriculumChapters.subjectId],
    references: [subjects.id],
  }),
  questions: many(questions),
  lastReviewedByUser: one(users, {
    fields: [curriculumChapters.lastReviewedBy],
    references: [users.id],
  }),
}));

export const papersRelations = relations(papers, ({ many }) => ({
  questions: many(questions),
  studentExams: many(studentExams),
}));

export const booksRelations = relations(books, ({ one, many }) => ({
  uploadedByUser: one(users, {
    fields: [books.uploadedBy],
    references: [users.id],
  }),
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  paper: one(papers, {
    fields: [questions.paperId],
    references: [papers.id],
  }),
  book: one(books, {
    fields: [questions.bookId],
    references: [books.id],
  }),
  curriculumChapter: one(curriculumChapters, {
    fields: [questions.curriculumChapterId],
    references: [curriculumChapters.id],
  }),
  mockTestQuestions: many(mockTestQuestions),
  studentAnswers: many(studentAnswers),
  questionPractice: many(questionPractice),
}));

export const mockTestsRelations = relations(mockTests, ({ many }) => ({
  mockTestQuestions: many(mockTestQuestions),
  studentExams: many(studentExams),
}));

export const mockTestQuestionsRelations = relations(mockTestQuestions, ({ one }) => ({
  mockTest: one(mockTests, {
    fields: [mockTestQuestions.mockTestId],
    references: [mockTests.id],
  }),
  question: one(questions, {
    fields: [mockTestQuestions.questionId],
    references: [questions.id],
  }),
}));

export const studentExamsRelations = relations(studentExams, ({ one, many }) => ({
  student: one(users, {
    fields: [studentExams.studentId],
    references: [users.id],
  }),
  paper: one(papers, {
    fields: [studentExams.paperId],
    references: [papers.id],
  }),
  mockTest: one(mockTests, {
    fields: [studentExams.mockTestId],
    references: [mockTests.id],
  }),
  studentAnswers: many(studentAnswers),
}));

export const studentAnswersRelations = relations(studentAnswers, ({ one }) => ({
  studentExam: one(studentExams, {
    fields: [studentAnswers.studentExamId],
    references: [studentExams.id],
  }),
  question: one(questions, {
    fields: [studentAnswers.questionId],
    references: [questions.id],
  }),
}));

export const questionPracticeRelations = relations(questionPractice, ({ one }) => ({
  student: one(users, {
    fields: [questionPractice.studentId],
    references: [users.id],
  }),
  question: one(questions, {
    fields: [questionPractice.questionId],
    references: [questions.id],
  }),
}));

export const aiChatSessionsRelations = relations(aiChatSessions, ({ many }) => ({
  // Note: userId can be either Firebase UID or JWT UUID, so no direct foreign key relation
  messages: many(aiChatMessages),
}));

export const aiChatMessagesRelations = relations(aiChatMessages, ({ one }) => ({
  session: one(aiChatSessions, {
    fields: [aiChatMessages.sessionId],
    references: [aiChatSessions.id],
  }),
}));

export const aiUsageTrackingRelations = relations(aiUsageTracking, () => ({
  // Note: userId can be either Firebase UID or JWT UUID, so no direct foreign key relation
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

export type Paper = typeof papers.$inferSelect;
export type NewPaper = typeof papers.$inferInsert;

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;

export type MockTest = typeof mockTests.$inferSelect;
export type NewMockTest = typeof mockTests.$inferInsert;

export type MockTestQuestion = typeof mockTestQuestions.$inferSelect;
export type NewMockTestQuestion = typeof mockTestQuestions.$inferInsert;

export type StudentExam = typeof studentExams.$inferSelect;
export type NewStudentExam = typeof studentExams.$inferInsert;

export type StudentAnswer = typeof studentAnswers.$inferSelect;
export type NewStudentAnswer = typeof studentAnswers.$inferInsert;

export type QuestionPractice = typeof questionPractice.$inferSelect;
export type NewQuestionPractice = typeof questionPractice.$inferInsert;

export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;

export type CurriculumChapter = typeof curriculumChapters.$inferSelect;
export type NewCurriculumChapter = typeof curriculumChapters.$inferInsert;

export type AIChatSession = typeof aiChatSessions.$inferSelect;
export type NewAIChatSession = typeof aiChatSessions.$inferInsert;

export type AIChatMessage = typeof aiChatMessages.$inferSelect;
export type NewAIChatMessage = typeof aiChatMessages.$inferInsert;

export type AIUsageTracking = typeof aiUsageTracking.$inferSelect;
export type NewAIUsageTracking = typeof aiUsageTracking.$inferInsert;
