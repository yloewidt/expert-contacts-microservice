import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// Update the LLM metrics function to properly calculate metrics
router.post('/fix-llm-metrics-function', async (req: Request, res: Response): Promise<Response> => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'expert-contacts-admin-2025') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Create the proper function
    await pool.query(`
      CREATE OR REPLACE FUNCTION calculate_llm_metrics(p_request_id UUID)
      RETURNS JSONB AS $$
      DECLARE
        v_metrics JSONB;
      BEGIN
        SELECT jsonb_build_object(
          'total_calls', COUNT(*)::int,
          'successful_calls', COUNT(*) FILTER (WHERE status = 'success')::int,
          'failed_calls', COUNT(*) FILTER (WHERE status = 'failed')::int,
          'timeout_calls', COUNT(*) FILTER (WHERE status = 'timeout')::int,
          'total_duration_ms', COALESCE(SUM(duration_ms), 0)::int,
          'avg_duration_ms', COALESCE(AVG(duration_ms), 0)::int,
          'total_retries', COALESCE(SUM(GREATEST(attempt_number - 1, 0)), 0)::int,
          'by_model', COALESCE(
            (SELECT jsonb_object_agg(model, model_stats)
            FROM (
              SELECT 
                model,
                jsonb_build_object(
                  'calls', COUNT(*)::int,
                  'success_rate', CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 2) ELSE 0 END,
                  'avg_duration_ms', ROUND(COALESCE(AVG(duration_ms), 0)::numeric, 2),
                  'total_tokens', COALESCE(SUM((tokens_used->>'total_tokens')::int), 0)
                ) as model_stats
              FROM llm_calls
              WHERE request_id = p_request_id
              GROUP BY model
            ) model_summary), '{}'::jsonb
          ),
          'by_operation', COALESCE(
            (SELECT jsonb_object_agg(operation, op_stats)
            FROM (
              SELECT 
                operation,
                jsonb_build_object(
                  'calls', COUNT(*)::int,
                  'success_rate', CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 2) ELSE 0 END,
                  'avg_duration_ms', ROUND(COALESCE(AVG(duration_ms), 0)::numeric, 2),
                  'retries', COALESCE(SUM(GREATEST(attempt_number - 1, 0)), 0)::int
                ) as op_stats
              FROM llm_calls
              WHERE request_id = p_request_id
              GROUP BY operation
            ) op_summary), '{}'::jsonb
          )
        ) INTO v_metrics
        FROM llm_calls
        WHERE request_id = p_request_id;
        
        -- If no calls found, return empty metrics
        IF v_metrics IS NULL THEN
          v_metrics := jsonb_build_object(
            'total_calls', 0,
            'successful_calls', 0,
            'failed_calls', 0,
            'timeout_calls', 0,
            'total_duration_ms', 0,
            'avg_duration_ms', 0,
            'total_retries', 0,
            'by_model', '{}'::jsonb,
            'by_operation', '{}'::jsonb
          );
        END IF;
        
        RETURN v_metrics;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Test the function with a sample request
    const testResult = await pool.query(`
      SELECT calculate_llm_metrics($1) as metrics
    `, ['1f174f98-8ce4-4aca-b77f-326737bcf109']);

    return res.json({ 
      message: 'LLM metrics function updated successfully',
      testResult: testResult.rows[0].metrics
    });
  } catch (error: any) {
    console.error('Error updating function:', error);
    return res.status(500).json({ 
      error: 'Failed to update function',
      details: error.message,
      code: error.code
    });
  }
});

export default router;