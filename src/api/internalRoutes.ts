import { Router, Request, Response } from 'express';
import { logger } from '../config/logger';
import { Database } from '../models/database';
import { OpenAIService } from '../services/openai';
import { ExpertAggregatorService } from '../services/expertAggregator';
import { CloudStorageService } from '../services/cloudStorage';

const router = Router();
const db = new Database();
const cloudStorage = new CloudStorageService();

// Note: This endpoint is deprecated - Cloud Workflows should be triggered by Cloud Tasks directly

// Update request status
router.post('/internal/update-status', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { request_id, status } = req.body;
    
    if (!request_id || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await db.updateRequestStatus(request_id, status);
    
    if (status === 'completed') {
      await db.updateRequestCompletedAt(request_id);
    }
    
    return res.json({ status: 'success' });
  } catch (error) {
    logger.error({ error }, 'Error updating status');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate expert types
router.post('/internal/generate-expert-types', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { project_description } = req.body;
    
    if (!project_description) {
      return res.status(400).json({ error: 'Missing project_description' });
    }
    
    const { request_id } = req.body;
    const openai = new OpenAIService(request_id);
    const expertTypes = await openai.generateExpertTypes(project_description);
    return res.json({ expert_types: expertTypes });
  } catch (error) {
    logger.error({ error }, 'Error generating expert types');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate search prompt
router.post('/internal/generate-search-prompt', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { project_description, expert_type } = req.body;
    
    if (!project_description || !expert_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const { request_id } = req.body;
    const openai = new OpenAIService(request_id);
    const searchPrompt = await openai.generateSearchPrompt(project_description, expert_type);
    return res.json({ search_prompt: searchPrompt });
  } catch (error) {
    logger.error({ error }, 'Error generating search prompt');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Search for experts
router.post('/internal/search-experts', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { search_prompt } = req.body;
    
    if (!search_prompt) {
      return res.status(400).json({ error: 'Missing search_prompt' });
    }
    
    const { request_id } = req.body;
    const openai = new OpenAIService(request_id);
    const candidates = await openai.searchExperts(search_prompt);
    return res.json({ candidates });
  } catch (error) {
    logger.error({ error }, 'Error searching experts');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Aggregate results
router.post('/internal/aggregate-results', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { request_id, expert_types, search_prompts, search_results } = req.body;
    
    if (!request_id || !expert_types || !search_prompts || !search_results) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate search_results is an array
    if (!Array.isArray(search_results)) {
      logger.error({ search_results, type: typeof search_results }, 'search_results is not an array');
      return res.status(400).json({ error: 'search_results must be an array' });
    }
    
    // Save raw outputs to Cloud Storage
    try {
      await cloudStorage.uploadRawOutput(request_id, 'expert_types', expert_types);
      await cloudStorage.uploadRawOutput(request_id, 'search_prompts', search_prompts);
      await cloudStorage.uploadRawOutput(request_id, 'search_results', search_results);
    } catch (storageError) {
      logger.warn({ error: storageError }, 'Failed to upload to Cloud Storage, saving to database only');
    }
    
    // Save raw outputs to database
    await db.saveRawOutputs(request_id, expert_types, search_prompts, search_results);
    
    // Aggregate experts
    const aggregator = new ExpertAggregatorService(request_id);
    const experts = await aggregator.aggregateExperts(expert_types, search_results.map((r: any) => r.candidates || []));
    
    // Save experts to database
    await db.saveExperts(request_id, experts);
    
    return res.json({ 
      status: 'success',
      experts_count: experts.length 
    });
  } catch (error) {
    logger.error({ error }, 'Error aggregating results');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;