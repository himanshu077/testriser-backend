CREATE TYPE "public"."cognitive_level" AS ENUM('fact', 'conceptual', 'numerical', 'assertion');--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "cognitive_level" "cognitive_level";