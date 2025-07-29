import { CloudTasksClient } from '@google-cloud/tasks';
import { logger } from '../config/logger';

export class CloudTasksService {
  private client: CloudTasksClient;
  private queuePath: string;
  private serviceUrl: string;

  constructor() {
    this.client = new CloudTasksClient();
    const projectId = process.env.GCP_PROJECT_ID || '';
    const location = process.env.GCP_REGION || 'us-central1';
    const queue = process.env.TASK_QUEUE_NAME || 'expert-sourcing';
    
    this.queuePath = this.client.queuePath(projectId, location, queue);
    this.serviceUrl = process.env.CLOUD_RUN_SERVICE_URL || '';
  }

  async createSourcingTask(requestId: string, projectDescription: string): Promise<void> {
    try {
      const task = {
        httpRequest: {
          httpMethod: 'POST' as const,
          url: `${this.serviceUrl}/internal/process-sourcing`,
          headers: {
            'Content-Type': 'application/json',
          },
          body: Buffer.from(JSON.stringify({
            request_id: requestId,
            project_description: projectDescription
          })).toString('base64'),
        },
        scheduleTime: {
          seconds: Date.now() / 1000,
        },
      };

      const request = {
        parent: this.queuePath,
        task: task,
      };

      const [response] = await this.client.createTask(request);
      logger.info({ taskName: response.name, requestId }, 'Cloud Task created');
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to create Cloud Task');
      throw error;
    }
  }
}