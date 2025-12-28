ALTER TABLE "ai_chat_sessions" DROP CONSTRAINT "ai_chat_sessions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_usage_tracking" DROP CONSTRAINT "ai_usage_tracking_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_chat_sessions" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_usage_tracking" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "expected_questions" integer DEFAULT 200;