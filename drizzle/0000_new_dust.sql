CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."book_type" AS ENUM('pyq', 'standard');--> statement-breakpoint
CREATE TYPE "public"."book_upload_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."chapter_status" AS ENUM('draft', 'active', 'archived', 'under_review');--> statement-breakpoint
CREATE TYPE "public"."cognitive_level" AS ENUM('fact', 'conceptual', 'numerical', 'assertion');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."exam_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."grade_level" AS ENUM('11', '12');--> statement-breakpoint
CREATE TYPE "public"."mock_test_type" AS ENUM('full_test', 'subject_wise', 'chapter_wise');--> statement-breakpoint
CREATE TYPE "public"."pyq_type" AS ENUM('subject_wise', 'full_length');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('single_correct', 'multiple_correct', 'assertion_reason', 'integer_type', 'match_list');--> statement-breakpoint
CREATE TYPE "public"."student_exam_status" AS ENUM('not_started', 'in_progress', 'submitted', 'evaluated');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'student');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"token_count" integer,
	"model" varchar(50),
	"processing_time_ms" integer,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" varchar(100) NOT NULL,
	"subject_code" varchar(50) NOT NULL,
	"chapter_slug" varchar(500) NOT NULL,
	"is_anonymous" boolean DEFAULT true NOT NULL,
	"device_fingerprint" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_chat_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" varchar(100),
	"date" timestamp DEFAULT now() NOT NULL,
	"question_count" integer DEFAULT 1 NOT NULL,
	"total_tokens_used" integer DEFAULT 0 NOT NULL,
	"total_cost_usd" numeric(10, 4) DEFAULT '0' NOT NULL,
	"model" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_cost_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid,
	"api_provider" varchar(50) NOT NULL,
	"model_name" varchar(100) NOT NULL,
	"operation_type" varchar(50) NOT NULL,
	"input_tokens" integer DEFAULT 0,
	"output_tokens" integer DEFAULT 0,
	"total_tokens" integer DEFAULT 0,
	"estimated_cost_usd" varchar(20),
	"page_number" integer,
	"success" boolean DEFAULT true,
	"error_message" text,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"filename" varchar(500) NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_hash" varchar(64),
	"exam_name" varchar(255),
	"exam_year" integer,
	"subject" varchar(50),
	"book_type" "book_type" DEFAULT 'standard' NOT NULL,
	"pyq_type" "pyq_type",
	"upload_status" "book_upload_status" DEFAULT 'pending' NOT NULL,
	"total_questions_extracted" integer DEFAULT 0,
	"extraction_progress" integer DEFAULT 0,
	"current_step" varchar(100),
	"uploaded_by" uuid,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(15),
	"subject" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"replied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"chapter_number" integer NOT NULL,
	"name" varchar(500) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"description" text,
	"grade_level" "grade_level" NOT NULL,
	"status" "chapter_status" DEFAULT 'draft' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"syllabus_year" integer DEFAULT 2024 NOT NULL,
	"estimated_hours" integer,
	"difficulty_level" "difficulty",
	"weightage" integer,
	"total_questions" integer DEFAULT 0,
	"pyq_count" integer DEFAULT 0,
	"easy_count" integer DEFAULT 0,
	"medium_count" integer DEFAULT 0,
	"hard_count" integer DEFAULT 0,
	"display_order" integer NOT NULL,
	"notes" text,
	"last_reviewed_at" timestamp,
	"last_reviewed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mock_test_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mock_test_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"question_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mock_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"test_type" "mock_test_type" DEFAULT 'full_test' NOT NULL,
	"subject" varchar(50),
	"duration" integer NOT NULL,
	"total_marks" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"status" "exam_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_extraction_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"page_image_path" text,
	"status" varchar(20) NOT NULL,
	"questions_extracted" integer DEFAULT 0,
	"expected_question_range" varchar(50),
	"extracted_questions" text,
	"missing_questions" text,
	"error_message" text,
	"api_cost" varchar(20),
	"processing_time_ms" integer,
	"retry_count" integer DEFAULT 0,
	"last_retry_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"year" integer NOT NULL,
	"duration" integer NOT NULL,
	"total_marks" integer DEFAULT 720 NOT NULL,
	"total_questions" integer DEFAULT 180 NOT NULL,
	"status" "exam_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_practice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"subject" varchar(50) NOT NULL,
	"topic" varchar(255) NOT NULL,
	"selected_answer" text,
	"is_correct" boolean,
	"attempt_count" integer DEFAULT 1,
	"last_attempted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid,
	"book_id" uuid,
	"curriculum_chapter_id" uuid,
	"subject" varchar(50) NOT NULL,
	"topic" varchar(255) NOT NULL,
	"subtopic" varchar(255),
	"exam_year" integer,
	"exam_type" varchar(100),
	"question_text" text NOT NULL,
	"question_image" text,
	"question_type" "question_type" DEFAULT 'single_correct' NOT NULL,
	"cognitive_level" "cognitive_level",
	"option_a" text,
	"option_b" text,
	"option_c" text,
	"option_d" text,
	"option_a_image" text,
	"option_b_image" text,
	"option_c_image" text,
	"option_d_image" text,
	"correct_answer" text,
	"explanation" text,
	"explanation_image" text,
	"marks_positive" numeric(4, 2) DEFAULT '4.00' NOT NULL,
	"marks_negative" numeric(4, 2) DEFAULT '1.00' NOT NULL,
	"difficulty" "difficulty" DEFAULT 'medium' NOT NULL,
	"question_number" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"has_diagram" boolean DEFAULT false,
	"diagram_description" text,
	"structured_data" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "section_extraction_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"subject" varchar(50) NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"expected_questions" integer NOT NULL,
	"extracted_questions" integer NOT NULL,
	"missing_question_numbers" text,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_exam_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_answer" text,
	"is_correct" boolean,
	"marks_obtained" numeric(4, 2),
	"is_marked_for_review" boolean DEFAULT false,
	"time_spent" integer,
	"answered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"paper_id" uuid,
	"mock_test_id" uuid,
	"status" "student_exam_status" DEFAULT 'not_started' NOT NULL,
	"start_time" timestamp,
	"end_time" timestamp,
	"submitted_at" timestamp,
	"total_score" numeric(6, 2),
	"correct_answers" integer DEFAULT 0,
	"incorrect_answers" integer DEFAULT 0,
	"unanswered" integer DEFAULT 0,
	"marked_for_review" integer DEFAULT 0,
	"time_spent" integer,
	"percentile" numeric(5, 2),
	"rank" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"icon" varchar(100),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_name_unique" UNIQUE("name"),
	CONSTRAINT "subjects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(15),
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"registration_number" varchar(50),
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"reset_password_token" text,
	"reset_password_expiry" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_registration_number_unique" UNIQUE("registration_number")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_session_id_ai_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_usage_tracking" ADD CONSTRAINT "ai_usage_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_cost_tracking" ADD CONSTRAINT "api_cost_tracking_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "books" ADD CONSTRAINT "books_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum_chapters" ADD CONSTRAINT "curriculum_chapters_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum_chapters" ADD CONSTRAINT "curriculum_chapters_last_reviewed_by_users_id_fk" FOREIGN KEY ("last_reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mock_test_questions" ADD CONSTRAINT "mock_test_questions_mock_test_id_mock_tests_id_fk" FOREIGN KEY ("mock_test_id") REFERENCES "public"."mock_tests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mock_test_questions" ADD CONSTRAINT "mock_test_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "page_extraction_results" ADD CONSTRAINT "page_extraction_results_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "question_practice" ADD CONSTRAINT "question_practice_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "question_practice" ADD CONSTRAINT "question_practice_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions" ADD CONSTRAINT "questions_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions" ADD CONSTRAINT "questions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions" ADD CONSTRAINT "questions_curriculum_chapter_id_curriculum_chapters_id_fk" FOREIGN KEY ("curriculum_chapter_id") REFERENCES "public"."curriculum_chapters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_extraction_results" ADD CONSTRAINT "section_extraction_results_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_answers" ADD CONSTRAINT "student_answers_student_exam_id_student_exams_id_fk" FOREIGN KEY ("student_exam_id") REFERENCES "public"."student_exams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_answers" ADD CONSTRAINT "student_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_exams" ADD CONSTRAINT "student_exams_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_exams" ADD CONSTRAINT "student_exams_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_exams" ADD CONSTRAINT "student_exams_mock_test_id_mock_tests_id_fk" FOREIGN KEY ("mock_test_id") REFERENCES "public"."mock_tests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
