import { Router, Request, Response } from 'express';
import { logger } from '../config/logger';
import { ExpertSourcingWorkflow } from '../workflows/expertSourcing';

const router = Router();

// Internal endpoint for Cloud Tasks to trigger workflow
router.post('/internal/process-sourcing', async (req: Request, res: Response) => {
  try {
    const { request_id, project_description } = req.body;

    if (!request_id || !project_description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Execute workflow asynchronously
    const workflow = new ExpertSourcingWorkflow();
    
    // Start workflow but don't await - let it run in background
    workflow.execute(request_id, project_description).catch(error => {
      logger.error({ error, request_id }, 'Workflow execution failed');
    });

    // Return immediately
    res.status(200).json({ message: 'Workflow started' });
  } catch (error) {
    logger.error({ error }, 'Error starting workflow');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;