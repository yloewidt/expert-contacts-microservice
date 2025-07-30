-- Add areas_of_expertise and conversation_topics columns to expert_request_matches
ALTER TABLE expert_request_matches 
ADD COLUMN IF NOT EXISTS areas_of_expertise TEXT DEFAULT '[]',
ADD COLUMN IF NOT EXISTS conversation_topics TEXT DEFAULT '[]';