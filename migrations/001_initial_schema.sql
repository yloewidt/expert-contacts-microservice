-- Create experts table
CREATE TABLE IF NOT EXISTS experts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT,
    company TEXT,
    linkedin_url TEXT UNIQUE NOT NULL,
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create expert_sourcing_requests table
CREATE TABLE IF NOT EXISTS expert_sourcing_requests (
    id TEXT PRIMARY KEY,
    project_description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create expert_request_matches table
CREATE TABLE IF NOT EXISTS expert_request_matches (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    expert_id TEXT NOT NULL,
    relevance_score REAL,
    email TEXT,
    matching_reasons TEXT, -- JSON array of strings
    personalised_message TEXT,
    responsiveness TEXT CHECK (responsiveness IN ('High', 'Medium', 'Low')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES expert_sourcing_requests(id),
    FOREIGN KEY (expert_id) REFERENCES experts(id)
);

-- Create expert_sourcing_raw_outputs table
CREATE TABLE IF NOT EXISTS expert_sourcing_raw_outputs (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    expert_types TEXT, -- Raw JSON from GPT-4o
    search_prompts TEXT, -- Raw text/JSON of generated prompts
    search_results TEXT, -- Raw JSON from o3
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES expert_sourcing_requests(id)
);

-- Create indexes
CREATE INDEX idx_expert_sourcing_requests_status ON expert_sourcing_requests(status);
CREATE INDEX idx_expert_request_matches_request_id ON expert_request_matches(request_id);
CREATE INDEX idx_expert_request_matches_expert_id ON expert_request_matches(expert_id);
CREATE INDEX idx_experts_linkedin_url ON experts(linkedin_url);