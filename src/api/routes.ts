import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { logger } from '../config/logger';
import { Database } from '../models/database';
import { CloudTasksService } from '../services/cloudTasks';
import { ExpertSourcingRequest, SourcingResponse } from '../types';

const router = Router();
const db = new Database();
const cloudTasks = new CloudTasksService();

// Validation schema
const sourcingRequestSchema = Joi.object({
  project_description: Joi.string().min(10).max(5000).required()
});

// POST /api/v1/source
router.post('/api/v1/source', async (req: Request, res: Response): Promise<Response> => {
  try {
    // Validate request body
    const { error, value } = sourcingRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { project_description } = value as ExpertSourcingRequest;

    // Create request in database
    const requestId = await db.createSourcingRequest(project_description);
    
    logger.info({ request_id: requestId }, 'Expert sourcing request created');

    // Create Cloud Task to trigger Cloud Workflow
    try {
      await cloudTasks.createWorkflowTask(requestId, project_description);
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to create Cloud Task, falling back to direct processing');
      // If Cloud Tasks fails, update status to failed
      await db.updateRequestStatus(requestId, 'failed');
      throw error;
    }

    // Return immediate response
    const response: SourcingResponse = {
      request_id: requestId,
      status: 'processing',
      message: `Expert sourcing initiated. Check status using GET /api/v1/source/${requestId}`
    };

    return res.status(202).json(response);
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error 
    }, 'Error creating sourcing request');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/source/:id
router.get('/api/v1/source/:id', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Get request from database
    const request = await db.getRequest(id);
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const response: SourcingResponse = {
      request_id: request.id,
      status: request.status,
      project_description: request.project_description
    };

    // If completed, include experts and metadata
    if (request.status === 'completed') {
      const experts = await db.getExpertsByRequestId(id);
      const rawOutputs = await db.getRawOutputs(id);
      
      const processingTime = request.completed_at 
        ? (new Date(request.completed_at).getTime() - new Date(request.created_at).getTime()) / 1000
        : 0;

      response.experts = experts;
      response.metadata = {
        created_at: request.created_at,
        processing_time_seconds: processingTime
      };
      
      if (rawOutputs) {
        response.raw_outputs = rawOutputs;
      }
    }

    return res.json(response);
  } catch (error) {
    logger.error({ error }, 'Error retrieving sourcing request');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;