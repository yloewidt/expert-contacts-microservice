import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { Database } from '../models/database';

const router = Router();
const db = new Database();

// Debug endpoint to test specific job
router.get('/debug/:id', async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const results: any = {
    requestId: id,
    timestamp: new Date().toISOString()
  };

  try {
    // Test 1: Basic request query
    try {
      const requestQuery = await pool.query('SELECT * FROM expert_sourcing_requests WHERE id = $1', [id]);
      results.request = requestQuery.rows[0] || null;
      results.requestFound = !!requestQuery.rows[0];
    } catch (e: any) {
      results.requestError = { message: e.message, code: e.code };
    }

    // Test 2: Expert count
    try {
      const expertCountQuery = await pool.query(`
        SELECT COUNT(*) as count 
        FROM expert_request_matches erm
        WHERE erm.request_id = $1
      `, [id]);
      results.expertCount = parseInt(expertCountQuery.rows[0].count);
    } catch (e: any) {
      results.expertCountError = { message: e.message, code: e.code };
    }

    // Test 3: LLM calls count
    try {
      const llmQuery = await pool.query(`
        SELECT COUNT(*) as count 
        FROM llm_calls 
        WHERE request_id = $1
      `, [id]);
      results.llmCallCount = parseInt(llmQuery.rows[0].count);
    } catch (e: any) {
      results.llmCallError = { message: e.message, code: e.code };
    }

    // Test 4: Try to get LLM metrics
    try {
      const metrics = await db.getLLMMetrics(id);
      results.llmMetrics = metrics;
    } catch (e: any) {
      results.llmMetricsError = { message: e.message, code: e.code };
    }

    // Test 5: Check if calculate_llm_metrics function exists
    try {
      const funcQuery = await pool.query(`
        SELECT EXISTS (
          SELECT 1 
          FROM pg_proc 
          WHERE proname = 'calculate_llm_metrics'
        ) as exists
      `);
      results.llmMetricsFunctionExists = funcQuery.rows[0].exists;
    } catch (e: any) {
      results.functionCheckError = { message: e.message, code: e.code };
    }

    return res.json(results);
  } catch (error: any) {
    results.generalError = { message: error.message, code: error.code };
    return res.status(500).json(results);
  }
});

export default router;