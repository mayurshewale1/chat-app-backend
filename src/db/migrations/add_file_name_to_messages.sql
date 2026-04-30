-- Migration: Add file_name column to messages table for document uploads
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
