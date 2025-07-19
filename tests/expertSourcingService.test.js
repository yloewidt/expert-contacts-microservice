import ExpertSourcingService from '../src/services/expertSourcingService.js';
import Database from '../src/database/index.js';
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

describe('ExpertSourcingService', () => {
  let service;
  let db;
  let mockOpenAI;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    await db.init();
    
    service = new ExpertSourcingService(db);
    mockOpenAI = service.openai;
  });

  afterEach(async () => {
    await db.close();
  });

  describe('generateExpertTypes', () => {
    it('should generate expert types for a project', async () => {
      const projectDescription = 'AI-powered healthcare platform for remote patient monitoring';
      
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              expertTypes: [
                {
                  type: 'Healthcare AI Specialist',
                  description: 'Expert in AI applications for healthcare',
                  importance: 9,
                  keywords: ['healthcare AI', 'medical AI', 'patient monitoring'],
                  skills: ['Machine Learning', 'Healthcare Compliance', 'Medical Data']
                },
                {
                  type: 'Telemedicine Platform Architect',
                  description: 'Expert in remote healthcare systems',
                  importance: 8,
                  keywords: ['telemedicine', 'remote monitoring', 'healthcare platform'],
                  skills: ['Platform Architecture', 'HIPAA Compliance', 'Real-time Systems']
                }
              ]
            })
          }
        }]
      });

      const expertTypes = await service.generateExpertTypes(projectDescription);
      
      expect(expertTypes).toHaveLength(2);
      expect(expertTypes[0].type).toBe('Healthcare AI Specialist');
      expect(expertTypes[0].importance).toBe(9);
      expect(expertTypes[0].skills).toContain('Machine Learning');
    });

    it('should handle API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));
      
      await expect(service.generateExpertTypes('test project')).rejects.toThrow('API Error');
    });
  });

  describe('scoreExperts', () => {
    it('should score experts based on relevance', async () => {
      const experts = [
        {
          name: 'John Doe',
          title: 'AI Healthcare Lead',
          company: 'MedTech Inc',
          linkedinUrl: 'https://linkedin.com/in/johndoe'
        },
        {
          name: 'Jane Smith',
          title: 'Software Engineer',
          company: 'Tech Corp',
          linkedinUrl: 'https://linkedin.com/in/janesmith'
        }
      ];

      const expertType = {
        type: 'Healthcare AI Specialist',
        description: 'Expert in AI applications for healthcare'
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              experts: [
                { ...experts[0], relevancyScore: 9 },
                { ...experts[1], relevancyScore: 4 }
              ]
            })
          }
        }]
      });

      const scoredExperts = await service.scoreExperts(experts, expertType, 'AI healthcare project');
      
      expect(scoredExperts[0].relevancyScore).toBe(9);
      expect(scoredExperts[1].relevancyScore).toBe(4);
    });
  });

  describe('createSourcingRequest', () => {
    it('should create a new sourcing request', async () => {
      const userId = 'test-user-123';
      const projectDescription = 'Test project description';
      
      const requestId = await service.createSourcingRequest(userId, projectDescription);
      
      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('number');
      
      const request = await db.get(
        'SELECT * FROM expert_sourcing_requests WHERE id = ?',
        [requestId]
      );
      
      expect(request.user_id).toBe(userId);
      expect(request.project_description).toBe(projectDescription);
      expect(request.status).toBe('pending');
    });
  });

  describe('findOrCreateExpert', () => {
    it('should create a new expert if not exists', async () => {
      const expertData = {
        name: 'Test Expert',
        linkedinUrl: 'https://linkedin.com/in/testexpert',
        company: 'Test Company',
        title: 'Test Title',
        skills: ['Skill1', 'Skill2']
      };
      
      const expertId = await service.findOrCreateExpert(expertData);
      
      expect(expertId).toBeDefined();
      
      const expert = await db.get('SELECT * FROM experts WHERE id = ?', [expertId]);
      expect(expert.name).toBe(expertData.name);
      expect(expert.linkedin_url).toBe(expertData.linkedinUrl);
      
      // Check skills were added
      const skills = await db.all(
        'SELECT skill FROM expert_skills WHERE expert_id = ?',
        [expertId]
      );
      expect(skills).toHaveLength(2);
      expect(skills.map(s => s.skill)).toContain('Skill1');
    });

    it('should return existing expert if LinkedIn URL matches', async () => {
      const expertData = {
        name: 'Test Expert',
        linkedinUrl: 'https://linkedin.com/in/testexpert',
        company: 'Test Company'
      };
      
      const firstId = await service.findOrCreateExpert(expertData);
      const secondId = await service.findOrCreateExpert(expertData);
      
      expect(firstId).toBe(secondId);
    });
  });

  describe('searchExperts', () => {
    beforeEach(async () => {
      // Insert test experts
      await db.run(
        `INSERT INTO experts (name, linkedin_url, company, title, expertise_areas, confidence_score) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['AI Expert', 'https://linkedin.com/in/ai', 'AI Corp', 'AI Lead', '["AI", "ML"]', 9]
      );
      
      await db.run(
        `INSERT INTO experts (name, linkedin_url, company, title, expertise_areas, confidence_score) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Healthcare Expert', 'https://linkedin.com/in/health', 'Med Inc', 'Health Lead', '["Healthcare"]', 8]
      );
    });

    it('should search experts by query', async () => {
      const results = await service.searchExperts('AI');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('AI Expert');
    });

    it('should filter by minimum confidence', async () => {
      const results = await service.searchExperts(null, { minConfidence: 8.5 });
      
      expect(results).toHaveLength(1);
      expect(results[0].confidence_score).toBe(9);
    });

    it('should limit results', async () => {
      const results = await service.searchExperts(null, { limit: 1 });
      
      expect(results).toHaveLength(1);
    });
  });

  describe('updateExpertContactStatus', () => {
    it('should update contact status for an expert match', async () => {
      // Create test data
      await db.run(
        'INSERT INTO expert_sourcing_requests (id, user_id, project_description) VALUES (?, ?, ?)',
        [1, 'user1', 'test project']
      );
      
      await db.run(
        'INSERT INTO experts (id, name, linkedin_url) VALUES (?, ?, ?)',
        [1, 'Expert 1', 'https://linkedin.com/in/expert1']
      );
      
      await db.run(
        'INSERT INTO expert_request_matches (request_id, expert_id) VALUES (?, ?)',
        [1, 1]
      );
      
      await service.updateExpertContactStatus(1, 1, 'contacted');
      
      const match = await db.get(
        'SELECT * FROM expert_request_matches WHERE request_id = ? AND expert_id = ?',
        [1, 1]
      );
      
      expect(match.contact_status).toBe('contacted');
      expect(match.contact_date).toBeDefined();
    });
  });
});