import { Storage } from '@google-cloud/storage';
import { logger } from '../config/logger';

export class CloudStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    this.storage = new Storage();
    this.bucketName = process.env.GCS_BUCKET_NAME || 'expert-contacts-raw-outputs';
  }

  async uploadRawOutput(requestId: string, outputType: string, data: any): Promise<string> {
    try {
      const fileName = `${requestId}/${outputType}-${Date.now()}.json`;
      const file = this.storage.bucket(this.bucketName).file(fileName);
      
      await file.save(JSON.stringify(data, null, 2), {
        metadata: {
          contentType: 'application/json',
        },
      });

      logger.info({ fileName, requestId }, 'Raw output uploaded to Cloud Storage');
      return `gs://${this.bucketName}/${fileName}`;
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to upload to Cloud Storage');
      throw error;
    }
  }

  async getRawOutput(fileName: string): Promise<any> {
    try {
      const file = this.storage.bucket(this.bucketName).file(fileName);
      const [content] = await file.download();
      return JSON.parse(content.toString());
    } catch (error) {
      logger.error({ error, fileName }, 'Failed to retrieve from Cloud Storage');
      throw error;
    }
  }
}