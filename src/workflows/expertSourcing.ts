import { logger } from '../config/logger';
import { Database } from '../models/database';
import { OpenAIService } from '../services/openai';
import { ExpertAggregatorService } from '../services/expertAggregator';
import { ExpertType, SearchCandidate } from '../types';

export class ExpertSourcingWorkflow {
  private db: Database;
  private openai: OpenAIService;
  private aggregator: ExpertAggregatorService;

  constructor() {
    this.db = new Database();
    this.openai = new OpenAIService();
    this.aggregator = new ExpertAggregatorService();
  }

  async execute(requestId: string, projectDescription: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info({ requestId }, 'Starting expert sourcing workflow');
      
      // Update status to processing
      await this.db.updateRequestStatus(requestId, 'processing');

      // Step 1: Generate expert types
      logger.info({ requestId }, 'Generating expert types');
      const expertTypes = await this.openai.generateExpertTypes(projectDescription);
      
      // Step 2: Generate search prompts for each expert type
      logger.info({ requestId, expertTypesCount: expertTypes.length }, 'Generating search prompts');
      const searchPrompts = await Promise.all(
        expertTypes.map(type => 
          this.openai.generateSearchPrompt(projectDescription, type)
        )
      );

      // Step 3: Execute parallel searches
      logger.info({ requestId }, 'Executing expert searches');
      const searchResults = await Promise.all(
        searchPrompts.map(prompt => 
          this.openai.searchExperts(prompt)
        )
      );

      // Step 4: Aggregate and score results
      logger.info({ requestId }, 'Aggregating results');
      const experts = this.aggregator.aggregateExperts(expertTypes, searchResults);

      // Step 5: Save results to database
      logger.info({ requestId, expertsCount: experts.length }, 'Saving results');
      await this.db.saveRawOutputs(requestId, expertTypes, searchPrompts, searchResults);
      await this.db.saveExperts(requestId, experts);

      // Update status to completed
      const completedAt = new Date();
      await this.db.updateRequestStatus(requestId, 'completed', completedAt);

      const processingTime = (Date.now() - startTime) / 1000;
      logger.info({ 
        requestId, 
        expertsFound: experts.length,
        processingTimeSeconds: processingTime 
      }, 'Expert sourcing workflow completed');

    } catch (error) {
      logger.error({ error, requestId }, 'Expert sourcing workflow failed');
      await this.db.updateRequestStatus(requestId, 'failed');
      throw error;
    }
  }
}