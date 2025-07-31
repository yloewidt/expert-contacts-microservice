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
    
    // Extract failed attempts for easy viewing
    const failedAttempts = result.rows.filter(call => 
      call.status === 'failed' || call.status === 'timeout'
    ).map(call => ({
      operation: call.operation,
      attempt: call.attempt_number,
      status: call.status,
      duration_ms: call.duration_ms,
      error: call.error_message,
      timestamp: call.started_at
    }));
    
    // Calculate retry statistics
    const retryStats: Record<string, any> = {};
    Object.entries(byOperation).forEach(([operation, calls]) => {
      const maxAttempt = Math.max(...calls.map((c: any) => c.attempt_number));
      const failures = calls.filter((c: any) => c.status === 'failed' || c.status === 'timeout');
      const successes = calls.filter((c: any) => c.status === 'success');
      
      retryStats[operation] = {
        total_attempts: calls.length,
        max_attempt_number: maxAttempt,
        successful_attempts: successes.length,
        failed_attempts: failures.length,
        retry_reasons: failures.map((f: any) => ({
          attempt: f.attempt_number,
          error: f.error_message,
          duration_ms: f.duration_ms
        }))
      };
    });
    
    return res.json({ 
      total_calls: result.rows.length,
      failed_attempts: failedAttempts,
      retry_statistics: retryStats,
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