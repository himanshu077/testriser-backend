-- Migration: Change user_id from UUID to TEXT for Firebase UID support
-- Date: 2025-12-23
-- Purpose: Support both Firebase UIDs (strings) and JWT-based UUIDs in AI chat and usage tracking

-- Step 1: Drop foreign key constraints on user_id columns
ALTER TABLE ai_chat_sessions
DROP CONSTRAINT IF EXISTS ai_chat_sessions_user_id_users_id_fk;

ALTER TABLE ai_usage_tracking
DROP CONSTRAINT IF EXISTS ai_usage_tracking_user_id_users_id_fk;

-- Step 2: Change user_id column type from UUID to TEXT in ai_chat_sessions
ALTER TABLE ai_chat_sessions
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Step 3: Change user_id column type from UUID to TEXT in ai_usage_tracking
ALTER TABLE ai_usage_tracking
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Step 4: Add comments to document the change
COMMENT ON COLUMN ai_chat_sessions.user_id IS 'User identifier - supports both Firebase UID (string) and JWT-based UUID';
COMMENT ON COLUMN ai_usage_tracking.user_id IS 'User identifier - supports both Firebase UID (string) and JWT-based UUID';

-- Step 5: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_user_id ON ai_usage_tracking(user_id);
