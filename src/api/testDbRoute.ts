import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// Test database connection
router.get('/test-db', async (_req: Request, res: Response): Promise<Response> => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM expert_sourcing_requests');
    return res.json({
      success: true,
      jobCount: result.rows[0].count,
      database: pool.options.database,
      host: pool.options.host
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      detail: error.detail
    });
  }
});

// Get all job IDs
router.get('/all-job-ids', async (_req: Request, res: Response): Promise<Response> => {
  try {
    const result = await pool.query('SELECT id FROM expert_sourcing_requests ORDER BY created_at DESC LIMIT 100');
    return res.json({
      success: true,
      count: result.rows.length,
      jobIds: result.rows.map(r => r.id)
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;