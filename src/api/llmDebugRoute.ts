import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all LLM calls for a request with error details
router.get('/llm-calls/:requestId', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { requestId } = req.params;
    
    const query = `
      SELECT 
        id,
        model,
        operation,
        started_at,
        completed_at,
        duration_ms,
        status,
        attempt_number,
        error_message,
        tokens_used
      FROM llm_calls
      WHERE request_id = $1
      ORDER BY started_at ASC
    `;
    
    const result = await pool.query(query, [requestId]);
    
    // Group by operation to show retries
    const byOperation: Record<string, any[]> = {};
    result.rows.forEach(call => {
      if (!byOperation[call.operation]) {
        byOperation[call.operation] = [];
      }
      byOperation[call.operation].push(call);
    });
    
    return res.json({ 
      total_calls: result.rows.length,
      calls_by_operation: byOperation,
      all_calls: result.rows
    });
  } catch (error: any) {
    console.error('Error fetching LLM calls:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch LLM calls',
      details: error.message
    });
  }
});

export default router;