import { Router, Request, Response } from 'express';
import { logger } from '../config/logger';
import { Database } from '../models/database';

const router = Router();
const db = new Database();

// GET /api/v1/jobs - Get all sourcing jobs
router.get('/api/v1/jobs', async (_req: Request, res: Response): Promise<Response> => {
  try {
    const jobs = await db.getAllJobs();
    
    return res.json({
      jobs: jobs,
      total: jobs.length
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching jobs');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;