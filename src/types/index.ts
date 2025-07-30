export interface ExpertSourcingRequest {
  project_description: string;
}

export interface Expert {
  id: string;
  name: string;
  title: string;
  company: string;
  linkedin_url: string;
  email: string;
  relevance_score: number;
  matching_reasons: string[];
  personalised_message: string;
  areas_of_expertise: string[];
  conversation_topics: string[];
}

export interface ExpertType {
  expert_title: string;
  why: string;
  importance_score: number;
}

export interface SearchCandidate {
  name: string;
  title: string;
  company: string;
  linkedin_url: string;
  email: string;
  matching_reasons: string[];
  relevancy_to_type_score: number;
  responsiveness: 'High' | 'Medium' | 'Low';
  personalised_message: string;
  areas_of_expertise: string[];
  conversation_topics: string[];
}

export interface SourcingResponse {
  request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  project_description?: string;
  experts?: Expert[];
  metadata?: {
    created_at: string;
    processing_time_seconds: number;
  };
  raw_outputs?: {
    expert_types: ExpertType[];
    search_prompts: string[];
    search_results: SearchCandidate[][];
  };
  message?: string;
}