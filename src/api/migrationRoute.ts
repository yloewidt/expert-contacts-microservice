import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

const LLM_TRACKING_MIGRATION = `
-- Create table for tracking LLM calls
CREATE TABLE IF NOT EXISTS llm_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES expert_sourcing_requests(id) ON DELETE CASCADE,
    model VARCHAR(50) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    attempt_number INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    tokens_used JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_llm_calls_request_id ON llm_calls(request_id);
CREATE INDEX IF NOT EXISTS idx_llm_calls_status ON llm_calls(status);
CREATE INDEX IF NOT EXISTS idx_llm_calls_model ON llm_calls(model);
CREATE INDEX IF NOT EXISTS idx_llm_calls_operation ON llm_calls(operation);

-- Add llm_metrics column
ALTER TABLE expert_sourcing_requests 
ADD COLUMN IF NOT EXISTS llm_metrics JSONB;

-- Function to calculate LLM metrics
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
`;

// Apply LLM tracking migration
router.post('/apply-llm-migration', async (req: Request, res: Response): Promise<Response> => {
  try {
    // Add some basic protection
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'expert-contacts-admin-2025') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Execute migration
    await pool.query(LLM_TRACKING_MIGRATION);

    // Verify migration worked
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'llm_calls'
      ) as table_exists,
      EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'calculate_llm_metrics'
      ) as function_exists
    `);

    return res.json({
      success: true,
      message: 'LLM tracking migration applied successfully',
      verification: tableCheck.rows[0]
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return res.status(500).json({ 
      error: 'Migration failed',
      details: error.message,
      code: error.code
    });
  }
});

export default router;