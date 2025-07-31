import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// Simple endpoint to check and create the function if needed
router.post('/fix-llm-function', async (req: Request, res: Response): Promise<Response> => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'expert-contacts-admin-2025') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if function exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'calculate_llm_metrics'
      ) as exists
    `);

    if (checkResult.rows[0].exists) {
      return res.json({ message: 'Function already exists' });
    }

    // Create a simple stub function that returns empty metrics
    await pool.query(`
      CREATE OR REPLACE FUNCTION calculate_llm_metrics(p_request_id UUID)
      RETURNS JSONB AS $$
      BEGIN
        -- Return empty metrics for now
        RETURN jsonb_build_object(
          'total_calls', 0,
          'successful_calls', 0,
          'failed_calls', 0,
          'timeout_calls', 0,
          'total_duration_ms', 0,
          'avg_duration_ms', 0,
          'total_retries', 0,
          'by_model', jsonb_build_object(),
          'by_operation', jsonb_build_object()
        );
      END;
      $$ LANGUAGE plpgsql;
    `);

    return res.json({ 
      message: 'LLM metrics function created successfully',
      note: 'This is a stub function that returns empty metrics'
    });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Failed to create function',
      details: error.message,
      code: error.code
    });
  }
});

export default router;