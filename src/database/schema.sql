-- Expert Sourcing Database Schema

-- Experts table
CREATE TABLE IF NOT EXISTS experts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  linkedin_url TEXT UNIQUE,
  company TEXT,
  title TEXT,
  bio TEXT,
  expertise_areas TEXT, -- JSON array
  proof_links TEXT, -- JSON array
  responsiveness_score REAL DEFAULT 5.0,
  source TEXT DEFAULT 'ai_suggested',
  confidence_score REAL DEFAULT 5.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Expert skills table (normalized)
CREATE TABLE IF NOT EXISTS expert_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expert_id INTEGER NOT NULL,
  skill TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expert_id) REFERENCES experts(id) ON DELETE CASCADE,
  UNIQUE(expert_id, skill)
);

-- Expert sourcing requests
CREATE TABLE IF NOT EXISTS expert_sourcing_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  project_description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  expert_types TEXT, -- JSON array
  results TEXT, -- JSON object
  cloud_request_id TEXT,
  cloud_status TEXT,
  cloud_results TEXT, -- JSON object from cloud function
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Expert request matches (junction table)
CREATE TABLE IF NOT EXISTS expert_request_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  expert_id INTEGER NOT NULL,
  expert_type TEXT,
  relevancy_score REAL DEFAULT 5.0,
  importance_score REAL DEFAULT 5.0,
  likelihood_to_respond REAL DEFAULT 5.0,
  combined_score REAL DEFAULT 0.0,
  linkedin_message TEXT,
  what_to_discuss TEXT,
  relevance_reason TEXT,
  contact_status TEXT DEFAULT 'not_contacted',
  contact_date DATETIME,
  response_received BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES expert_sourcing_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (expert_id) REFERENCES experts(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_experts_linkedin ON experts(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_experts_company ON experts(company);
CREATE INDEX IF NOT EXISTS idx_expert_skills_skill ON expert_skills(skill);
CREATE INDEX IF NOT EXISTS idx_expert_requests_user ON expert_sourcing_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_expert_requests_status ON expert_sourcing_requests(status);
CREATE INDEX IF NOT EXISTS idx_expert_matches_request ON expert_request_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_expert_matches_expert ON expert_request_matches(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_matches_score ON expert_request_matches(combined_score DESC);