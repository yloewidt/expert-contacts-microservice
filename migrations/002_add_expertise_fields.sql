-- Add new fields for expert expertise and conversation topics
ALTER TABLE expert_request_matches 
ADD COLUMN areas_of_expertise JSONB DEFAULT '[]'::jsonb,
ADD COLUMN conversation_topics JSONB DEFAULT '[]'::jsonb;