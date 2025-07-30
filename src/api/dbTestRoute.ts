import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

router.get('/api/v1/db-test', async (_req: Request, res: Response): Promise<Response> => {
  try {
    // Test basic connection
    const result = await pool.query('SELECT NOW() as time, current_database() as database, current_user as user');
    
    // Test tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    // Test record counts
    const countsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM expert_sourcing_requests) as requests_count,
        (SELECT COUNT(*) FROM experts) as experts_count,
        (SELECT COUNT(*) FROM expert_request_matches) as matches_count
    `);
    
    return res.json({
      connection: 'success',
      timestamp: result.rows[0].time,
      database: result.rows[0].database,
      user: result.rows[0].user,
      tables: tablesResult.rows.map(r => r.table_name),
      counts: countsResult.rows[0],
      config: {
        host: process.env.DB_HOST || 'not set',
        database: process.env.DB_NAME || 'not set',
        user: process.env.DB_USER || 'not set',
        usePublicIp: process.env.USE_PUBLIC_IP || 'not set'
      }
    });
  } catch (error) {
    logger.error({ error }, 'Database test failed');
    return res.status(500).json({ 
      error: 'Database test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      config: {
        host: process.env.DB_HOST || 'not set',
        database: process.env.DB_NAME || 'not set',
        user: process.env.DB_USER || 'not set',
        usePublicIp: process.env.USE_PUBLIC_IP || 'not set'
      }
    });
  }
});

export default router;