import request from 'supertest';
import crypto from 'crypto';
import ExpertContactsServer from '../src/server.js';
import { jest } from '@jest/globals';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      },
      responses: {
        create: jest.fn()
      }
    }))
  };
});

describe('Expert Contacts API', () => {
  let server;
  let app;
  let apiKey;

  beforeAll(async () => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.API_KEY_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    
    // Generate valid API key
    apiKey = crypto.createHash('sha256').update('test-secret').digest('hex');
    
    server = new ExpertContactsServer();
    await server.init();
    app = server.app;
  });

  afterAll(async () => {
    await server.db.close();
  });

  describe('GET /health', () => {
    it('should return health status without authentication', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'expert-contacts-microservice',
        version: '1.0.0'
      });
    });
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await request(app)
        .get('/api/v1/experts/search')
        .expect(401);
      
      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .get('/api/v1/experts/search')
        .set('X-API-Key', 'invalid-key')
        .expect(401);
      
      expect(response.body.error).toBe('Invalid API key');
    });

    it('should accept requests with valid API key', async () => {
      const response = await request(app)
        .get('/api/v1/experts/search')
        .set('X-API-Key', apiKey)
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/experts/source', () => {
    beforeEach(() => {
      // Reset mocks
      server.expertService.openai.chat.completions.create.mockReset();
      server.expertService.openai.responses.create.mockReset();
    });

    it('should source experts for a project', async () => {
      // Mock expert type generation
      server.expertService.openai.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              expertTypes: [{
                type: 'AI Expert',
                description: 'Expert in AI',
                importance: 9,
                keywords: ['AI', 'ML'],
                skills: ['Machine Learning']
              }]
            })
          }
        }]
      });

      // Mock expert finding (o3 response)
      server.expertService.openai.responses.create.mockResolvedValueOnce({
        content: [{
          text: JSON.stringify({
            experts: [{
              name: 'John Doe',
              title: 'AI Lead',
              company: 'Tech Corp',
              linkedinUrl: 'https://linkedin.com/in/johndoe',
              skills: ['AI', 'ML']
            }]
          })
        }]
      });

      // Mock scoring
      server.expertService.openai.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              experts: [{
                name: 'John Doe',
                relevancyScore: 8
              }]
            })
          }
        }]
      });

      // Mock details generation
      server.expertService.openai.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              experts: [{
                name: 'John Doe',
                linkedinMessage: 'Hi John...',
                whatToDiscuss: ['Topic 1', 'Topic 2'],
                likelihoodToRespond: 7,
                criticalRelevance: 8,
                relevanceReason: 'Strong AI background'
              }]
            })
          }
        }]
      });

      const response = await request(app)
        .post('/api/v1/experts/source')
        .set('X-API-Key', apiKey)
        .send({
          projectDescription: 'AI-powered healthcare platform'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('requestId');
      expect(response.body.data).toHaveProperty('expertTypes');
      expect(response.body.data).toHaveProperty('results');
    });

    it('should validate project description', async () => {
      const response = await request(app)
        .post('/api/v1/experts/source')
        .set('X-API-Key', apiKey)
        .send({
          projectDescription: 'Too short'
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/v1/experts/search', () => {
    beforeEach(async () => {
      // Insert test data
      await server.db.run(
        `INSERT INTO experts (name, linkedin_url, company, title, expertise_areas, confidence_score) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Test Expert', 'https://linkedin.com/in/test', 'Test Corp', 'Lead', '["AI"]', 8]
      );
    });

    it('should search experts by query', async () => {
      const response = await request(app)
        .get('/api/v1/experts/search')
        .set('X-API-Key', apiKey)
        .query({ query: 'Test' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Test Expert');
    });

    it('should filter by confidence score', async () => {
      const response = await request(app)
        .get('/api/v1/experts/search')
        .set('X-API-Key', apiKey)
        .query({ minConfidence: 9 })
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/experts/:id', () => {
    it('should get expert by ID', async () => {
      // Insert test expert
      await server.db.run(
        `INSERT INTO experts (id, name, linkedin_url, expertise_areas, proof_links) 
         VALUES (?, ?, ?, ?, ?)`,
        [100, 'Expert Name', 'https://linkedin.com/in/expert', '["AI"]', '[]']
      );

      const response = await request(app)
        .get('/api/v1/experts/100')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Expert Name');
    });

    it('should return 404 for non-existent expert', async () => {
      const response = await request(app)
        .get('/api/v1/experts/999')
        .set('X-API-Key', apiKey)
        .expect(404);

      expect(response.body.error).toBe('Expert not found');
    });
  });

  describe('GET /api/v1/requests', () => {
    it('should get user requests', async () => {
      const userId = 'api-user-' + crypto.createHash('md5').update(apiKey).digest('hex').substring(0, 8);
      
      // Insert test request
      await server.db.run(
        `INSERT INTO expert_sourcing_requests (user_id, project_description, status) 
         VALUES (?, ?, ?)`,
        [userId, 'Test Project', 'completed']
      );

      const response = await request(app)
        .get('/api/v1/requests')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].project_description).toBe('Test Project');
    });
  });

  describe('POST /api/v1/requests/:requestId/experts/:expertId/contact', () => {
    it('should update contact status', async () => {
      const userId = 'api-user-' + crypto.createHash('md5').update(apiKey).digest('hex').substring(0, 8);
      
      // Insert test data
      await server.db.run(
        'INSERT INTO expert_sourcing_requests (id, user_id, project_description) VALUES (?, ?, ?)',
        [1, userId, 'test project']
      );
      
      await server.db.run(
        'INSERT INTO experts (id, name, linkedin_url) VALUES (?, ?, ?)',
        [1, 'Expert 1', 'https://linkedin.com/in/expert1']
      );
      
      await server.db.run(
        'INSERT INTO expert_request_matches (request_id, expert_id) VALUES (?, ?)',
        [1, 1]
      );

      const response = await request(app)
        .post('/api/v1/requests/1/experts/1/contact')
        .set('X-API-Key', apiKey)
        .send({
          status: 'contacted',
          notes: 'Sent LinkedIn message'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Contact status updated');
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .post('/api/v1/requests/1/experts/1/contact')
        .set('X-API-Key', apiKey)
        .send({
          status: 'invalid-status'
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Error handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/unknown-route')
        .set('X-API-Key', apiKey)
        .expect(404);

      expect(response.body.error).toBe('Not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/experts/source')
        .set('X-API-Key', apiKey)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });
});