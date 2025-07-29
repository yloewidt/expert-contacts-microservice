import { ExpertAggregatorService } from '../../src/services/expertAggregator';
import { ExpertType, SearchCandidate } from '../../src/types';

describe('ExpertAggregatorService', () => {
  let aggregator: ExpertAggregatorService;

  beforeEach(() => {
    aggregator = new ExpertAggregatorService();
  });

  describe('aggregateExperts', () => {
    it('should aggregate and score experts correctly', () => {
      const expertTypes: ExpertType[] = [
        {
          expert_title: 'Blockchain Architect',
          why: 'Deep technical knowledge',
          importance_score: 0.9
        },
        {
          expert_title: 'DeFi Protocol Expert',
          why: 'Domain expertise',
          importance_score: 0.8
        }
      ];

      const searchResults: SearchCandidate[][] = [
        // Results for Blockchain Architect
        [
          {
            name: 'John Doe',
            title: 'Senior Blockchain Engineer',
            company: 'Tech Corp',
            linkedin_url: 'https://linkedin.com/in/johndoe',
            email: 'john@example.com',
            matching_reasons: ['10 years blockchain experience'],
            relevancy_to_type_score: 0.95,
            responsiveness: 'High',
            personalised_message: 'Hi John...'
          }
        ],
        // Results for DeFi Protocol Expert
        [
          {
            name: 'John Doe', // Same person
            title: 'Senior Blockchain Engineer',
            company: 'Tech Corp',
            linkedin_url: 'https://linkedin.com/in/johndoe',
            email: 'john@example.com',
            matching_reasons: ['Built DeFi protocols'],
            relevancy_to_type_score: 0.85,
            responsiveness: 'High',
            personalised_message: 'Hi John...'
          },
          {
            name: 'Jane Smith',
            title: 'DeFi Consultant',
            company: 'Crypto Advisory',
            linkedin_url: 'https://linkedin.com/in/janesmith',
            email: 'jane@example.com',
            matching_reasons: ['DeFi expert'],
            relevancy_to_type_score: 0.90,
            responsiveness: 'Medium',
            personalised_message: 'Hi Jane...'
          }
        ]
      ];

      const experts = aggregator.aggregateExperts(expertTypes, searchResults);

      expect(experts).toHaveLength(2);
      
      // John should be first (higher weighted score)
      expect(experts[0].name).toBe('John Doe');
      expect(experts[0].relevance_score).toBeCloseTo(0.91); // (0.95*0.9 + 0.85*0.8) / (0.9+0.8)
      
      // Jane should be second
      expect(experts[1].name).toBe('Jane Smith');
      expect(experts[1].relevance_score).toBe(0.90);
    });

    it('should handle empty search results', () => {
      const expertTypes: ExpertType[] = [
        {
          expert_title: 'Test Expert',
          why: 'Testing',
          importance_score: 1.0
        }
      ];

      const searchResults: SearchCandidate[][] = [[]];

      const experts = aggregator.aggregateExperts(expertTypes, searchResults);

      expect(experts).toHaveLength(0);
    });

    it('should deduplicate experts by LinkedIn URL case-insensitively', () => {
      const expertTypes: ExpertType[] = [
        {
          expert_title: 'Expert 1',
          why: 'Test',
          importance_score: 1.0
        }
      ];

      const searchResults: SearchCandidate[][] = [
        [
          {
            name: 'Test User',
            title: 'Title',
            company: 'Company',
            linkedin_url: 'https://LinkedIn.com/in/testuser',
            email: 'test@example.com',
            matching_reasons: ['Reason 1'],
            relevancy_to_type_score: 0.9,
            responsiveness: 'High',
            personalised_message: 'Message'
          },
          {
            name: 'Test User',
            title: 'Title',
            company: 'Company',
            linkedin_url: 'https://linkedin.com/in/TESTUSER',
            email: 'test@example.com',
            matching_reasons: ['Reason 2'],
            relevancy_to_type_score: 0.8,
            responsiveness: 'High',
            personalised_message: 'Message'
          }
        ]
      ];

      const experts = aggregator.aggregateExperts(expertTypes, searchResults);

      expect(experts).toHaveLength(1);
      expect(experts[0].relevance_score).toBe(0.9); // Should use the first occurrence
    });
  });
});