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
ALTER TABLE "questions" ALTER COLUMN "correct_answer" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "exam_name" varchar(255);--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "exam_year" integer;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "extraction_progress" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "current_step" varchar(100);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "page_extraction_results" ADD CONSTRAINT "page_extraction_results_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_extraction_results" ADD CONSTRAINT "section_extraction_results_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
