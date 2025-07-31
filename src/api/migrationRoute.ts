import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import fs from 'fs';
import path from 'path';

const router = Router();

// Apply LLM tracking migration
router.post('/apply-llm-migration', async (req: Request, res: Response): Promise<Response> => {
  try {
    // Add some basic protection
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'expert-contacts-admin-2025') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const migrationPath = path.join(__dirname, '../../migrations/003_llm_call_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(migrationSQL);

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