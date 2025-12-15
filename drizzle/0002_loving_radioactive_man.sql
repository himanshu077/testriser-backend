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
DO $$ BEGIN
 ALTER TABLE "api_cost_tracking" ADD CONSTRAINT "api_cost_tracking_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
