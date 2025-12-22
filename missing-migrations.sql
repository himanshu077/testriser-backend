-- ============================================================================
-- Missing Migrations for Supabase Database
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- ============================================================================

-- Migration 0001: Add file_hash column to books table
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "file_hash" varchar(64);

-- Migration 0002: Create api_cost_tracking table
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

DO $$ BEGIN
 ALTER TABLE "api_cost_tracking" ADD CONSTRAINT "api_cost_tracking_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Migration 0003: Create page_extraction_results and section_extraction_results tables
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

-- Modify questions table: make correct_answer nullable
ALTER TABLE "questions" ALTER COLUMN "correct_answer" DROP NOT NULL;

-- Add new columns to books table
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "exam_name" varchar(255);
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "exam_year" integer;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "extraction_progress" integer DEFAULT 0;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "current_step" varchar(100);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "page_extraction_results" ADD CONSTRAINT "page_extraction_results_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "section_extraction_results" ADD CONSTRAINT "section_extraction_results_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Migration 0004: Add cognitive_level enum and column to questions table
DO $$ BEGIN
  CREATE TYPE "public"."cognitive_level" AS ENUM('fact', 'conceptual', 'numerical', 'assertion');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "cognitive_level" "cognitive_level";

-- Done!
SELECT 'Migrations completed successfully!' as status;
