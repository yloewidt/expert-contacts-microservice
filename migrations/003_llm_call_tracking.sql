-- Migration: Add LLM call tracking
-- Created: 2025-07-30

-- Create table for tracking LLM calls
CREATE TABLE IF NOT EXISTS llm_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES expert_sourcing_requests(id) ON DELETE CASCADE,
    model VARCHAR(50) NOT NULL,
    operation VARCHAR(100) NOT NULL, -- 'generate_expert_types', 'generate_search_prompt', 'search_experts'
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'success', 'failed', 'timeout'
    attempt_number INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    tokens_used JSONB, -- {prompt_tokens, completion_tokens, total_tokens}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_llm_calls_request_id ON llm_calls(request_id);
CREATE INDEX idx_llm_calls_status ON llm_calls(status);
CREATE INDEX idx_llm_calls_model ON llm_calls(model);
CREATE INDEX idx_llm_calls_operation ON llm_calls(operation);

-- Add llm_metrics column to expert_sourcing_requests for summary
ALTER TABLE expert_sourcing_requests 
ADD COLUMN IF NOT EXISTS llm_metrics JSONB;

-- Function to calculate LLM metrics for a request
CREATE OR REPLACE FUNCTION calculate_llm_metrics(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_metrics JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_calls', COUNT(*),
        'successful_calls', COUNT(*) FILTER (WHERE status = 'success'),
        'failed_calls', COUNT(*) FILTER (WHERE status = 'failed'),
        'timeout_calls', COUNT(*) FILTER (WHERE status = 'timeout'),
        'total_duration_ms', SUM(duration_ms),
        'avg_duration_ms', AVG(duration_ms),
        'total_retries', SUM(GREATEST(attempt_number - 1, 0)),
        'by_model', (
            SELECT jsonb_object_agg(model, model_stats)
            FROM (
                SELECT 
                    model,
                    jsonb_build_object(
                        'calls', COUNT(*),
                        'success_rate', ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 2),
                        'avg_duration_ms', ROUND(AVG(duration_ms)::numeric, 2),
                        'total_tokens', SUM((tokens_used->>'total_tokens')::int)
                    ) as model_stats
                FROM llm_calls
                WHERE request_id = p_request_id
                GROUP BY model
            ) model_summary
        ),
        'by_operation', (
            SELECT jsonb_object_agg(operation, op_stats)
            FROM (
                SELECT 
                    operation,
                    jsonb_build_object(
                        'calls', COUNT(*),
                        'success_rate', ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 2),
                        'avg_duration_ms', ROUND(AVG(duration_ms)::numeric, 2),
                        'retries', SUM(GREATEST(attempt_number - 1, 0))
                    ) as op_stats
                FROM llm_calls
                WHERE request_id = p_request_id
                GROUP BY operation
            ) op_summary
        )
    ) INTO v_metrics
    FROM llm_calls
    WHERE request_id = p_request_id;
    
    RETURN v_metrics;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update metrics when request is completed
CREATE OR REPLACE FUNCTION update_llm_metrics_on_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE expert_sourcing_requests
        SET llm_metrics = calculate_llm_metrics(NEW.id)
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_llm_metrics
    AFTER UPDATE ON expert_sourcing_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_llm_metrics_on_completion();