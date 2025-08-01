export interface ExpertSourcingRequest {
  project_description: string;
}

export interface Expert {
  id: string;
  name: string;
  title: string;
  company: string;
  linkedin_url: string | null;
  email: string | null;
  relevance_score: number;
  matching_reasons: string[];
  personalised_message: string;
  areas_of_expertise: string[];
  conversation_topics: string[];
  // Score breakdown components
  type_importance_score?: number;
  relevancy_to_type_score?: number;
  responsiveness_score?: number;
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
  linkedin_url: string | null;
  email: string | null;
  matching_reasons: string[];
  relevancy_to_type_score: number;
  responsiveness: number;
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
  llm_metrics?: LLMMetrics;
}

export interface LLMCall {
  id: string;
  request_id: string;
  model: string;
  operation: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  status: 'in_progress' | 'success' | 'failed' | 'timeout';
  attempt_number: number;
  error_message?: string;
  tokens_used?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMMetrics {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  timeout_calls: number;
  total_duration_ms: number;
  avg_duration_ms: number;
  total_retries: number;
  by_model: {
    [model: string]: {
      calls: number;
      success_rate: number;
      avg_duration_ms: number;
      total_tokens: number;
    };
  };
  by_operation: {
    [operation: string]: {
      calls: number;
      success_rate: number;
      avg_duration_ms: number;
      retries: number;
    };
  };
}