-- Add columns to expert_request_matches for storing detailed score breakdown
ALTER TABLE expert_request_matches 
ADD COLUMN IF NOT EXISTS areas_of_expertise TEXT, -- JSON array
ADD COLUMN IF NOT EXISTS conversation_topics TEXT, -- JSON array
ADD COLUMN IF NOT EXISTS type_importance_score REAL,
ADD COLUMN IF NOT EXISTS relevancy_to_type_score REAL,
ADD COLUMN IF NOT EXISTS responsiveness_score REAL,
ADD COLUMN IF NOT EXISTS expert_type TEXT;

-- Create a new table to store the raw expert data per type for client-side aggregation
CREATE TABLE IF NOT EXISTS expert_type_matches (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    expert_id TEXT NOT NULL,
    expert_type TEXT NOT NULL,
    type_importance_score REAL,
    relevancy_to_type_score REAL,
    responsiveness_score REAL,
    matching_reasons TEXT, -- JSON array of strings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES expert_sourcing_requests(id),
    FOREIGN KEY (expert_id) REFERENCES experts(id)
);

-- Create indexes for the new table
CREATE INDEX idx_expert_type_matches_request_id ON expert_type_matches(request_id);
CREATE INDEX idx_expert_type_matches_expert_id ON expert_type_matches(expert_id);
CREATE INDEX idx_expert_type_matches_type ON expert_type_matches(expert_type);