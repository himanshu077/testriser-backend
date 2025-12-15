-- Migration: Add cognitive_level field to questions table
-- Date: 2025-12-15

-- Step 1: Create the cognitive_level enum type
DO $$ BEGIN
    CREATE TYPE cognitive_level AS ENUM ('fact', 'conceptual', 'numerical', 'assertion');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add the cognitive_level column to questions table
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS cognitive_level cognitive_level;

-- Step 3: Add comment
COMMENT ON COLUMN questions.cognitive_level IS 'Cognitive level of the question - what skill it tests (fact recall, conceptual understanding, numerical problem-solving, or assertion-based reasoning)';

-- Step 4: Create index for filtering by cognitive level
CREATE INDEX IF NOT EXISTS idx_questions_cognitive_level ON questions(cognitive_level);

-- Step 5: (Optional) Set default values based on existing questionType
-- Uncomment if you want to populate existing data
/*
UPDATE questions
SET cognitive_level =
    CASE
        WHEN question_type = 'integer_type' THEN 'numerical'::cognitive_level
        WHEN question_type = 'assertion_reason' THEN 'assertion'::cognitive_level
        ELSE NULL
    END
WHERE cognitive_level IS NULL;
*/
