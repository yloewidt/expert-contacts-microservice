import { logger } from '../config/logger';

export class CloudTasksService {
  constructor() {
    // CloudTasksClient would be initialized here if needed
  }

  async createWorkflowTask(requestId: string, projectDescription: string): Promise<void> {
    try {
      const workflowsClient = new (await import('@google-cloud/workflows')).WorkflowsClient();
      const executionsClient = new (await import('@google-cloud/workflows')).ExecutionsClient();
      
      const projectId = process.env.GCP_PROJECT_ID || '';
      const location = process.env.GCP_REGION || 'us-central1';
      const workflowName = process.env.WORKFLOW_NAME || 'expert-sourcing-workflow';
      
      const workflowPath = workflowsClient.workflowPath(projectId, location, workflowName);
      
      // Execute the workflow directly
      const [execution] = await executionsClient.createExecution({
        parent: workflowPath,
        execution: {
          argument: JSON.stringify({
            request_id: requestId,
            project_description: projectDescription
          })
        }
      });
      
      logger.info({ 
        executionName: execution.name, 
        requestId 
      }, 'Cloud Workflow execution created');
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to create workflow execution');
      throw error;
    }
  }
}