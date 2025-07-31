import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// Admin endpoint to truncate all job data (protected in production)
router.delete('/truncate-all', async (req: Request, res: Response): Promise<Response> => {
  try {
    // Add some basic protection
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'expert-contacts-admin-2025') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query('BEGIN');
    
    // Delete in correct order to respect foreign keys
    await pool.query('DELETE FROM llm_calls');
    await pool.query('DELETE FROM expert_request_matches');
    await pool.query('DELETE FROM expert_sourcing_raw_outputs');
    await pool.query('DELETE FROM experts');
    await pool.query('DELETE FROM expert_sourcing_requests');
    
    await pool.query('COMMIT');
    
    // Get counts to verify
    const counts = await pool.query(`
      SELECT 'expert_sourcing_requests' as table_name, COUNT(*) as count FROM expert_sourcing_requests
      UNION ALL
      SELECT 'experts', COUNT(*) FROM experts
      UNION ALL
      SELECT 'expert_request_matches', COUNT(*) FROM expert_request_matches
      UNION ALL
      SELECT 'expert_sourcing_raw_outputs', COUNT(*) FROM expert_sourcing_raw_outputs
      UNION ALL
      SELECT 'llm_calls', COUNT(*) FROM llm_calls
    `);
    
    return res.json({
      message: 'All job data truncated successfully',
      counts: counts.rows
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error truncating data:', error);
    return res.status(500).json({ error: 'Failed to truncate data' });
  }
});

export default router;