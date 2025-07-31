import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// Create just the LLM calls table
router.post('/create-llm-table', async (req: Request, res: Response): Promise<Response> => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'expert-contacts-admin-2025') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Create the table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS llm_calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID NOT NULL,
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
      )
    `);

    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_llm_calls_request_id ON llm_calls(request_id)');
    
    return res.json({ 
      message: 'LLM calls table created successfully'
    });
  } catch (error: any) {
    console.error('Error creating table:', error);
    return res.status(500).json({ 
      error: 'Failed to create table',
      details: error.message,
      code: error.code
    });
  }
});

export default router;