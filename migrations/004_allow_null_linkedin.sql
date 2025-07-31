-- Migration: Allow null LinkedIn URLs
-- Created: 2025-07-31
-- Purpose: Support experts who may not have public LinkedIn profiles

-- Remove NOT NULL constraint from linkedin_url
ALTER TABLE experts 
ALTER COLUMN linkedin_url DROP NOT NULL;

-- Since linkedin_url has a UNIQUE constraint, we need to handle that differently
-- NULL values are allowed in UNIQUE columns (each NULL is considered distinct)
-- No changes needed to the UNIQUE constraint