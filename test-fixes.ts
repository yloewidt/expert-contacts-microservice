import express from 'express';
import dotenv from 'dotenv';
import internalRouter from './src/api/internalRoutes';
import { ExpertAggregatorService } from './src/services/expertAggregator';
import { ExpertType, SearchCandidate } from './src/types';

dotenv.config();

async function testFixes() {
  console.log('🧪 Testing All Fixes...\n');
  
  // Start test server
  const app = express();
  app.use(express.json());
  app.use('/', internalRouter);
  
  const server = app.listen(0, () => {
    console.log(`✅ Test server started on port ${(server.address() as any).port}\n`);
  });
  
  const baseUrl = `http://localhost:${(server.address() as any).port}`;
  
  try {
    // Test 1: Aggregation with correct format
    console.log('📋 Test 1: Aggregation with correct format');
    const goodPayload = {
      request_id: 'test-123',
      expert_types: [
        { expert_title: 'Blockchain Developer', why: 'test', importance_score: 0.9 }
      ],
      search_prompts: ['Find blockchain developers'],
      search_results: [
        {
          candidates: [
            {
              name: 'John Doe',
              title: 'Senior Developer',
              company: 'Tech Corp',
              linkedin_url: 'https://linkedin.com/in/johndoe',
              email: '',
              relevancy_to_type_score: 0.9,
              responsiveness: 'High',
              matching_reasons: ['Expert'],
              personalised_message: 'Hi',
              areas_of_expertise: ['Blockchain'],
              conversation_topics: ['DeFi']
            }
          ]
        }
      ]
    };
    
    const res1 = await fetch(`${baseUrl}/internal/aggregate-results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goodPayload)
    });
    
    if (res1.ok) {
      console.log('✅ Success: Aggregation works with correct format');
    } else {
      console.error(`❌ Failed: ${res1.status} - ${await res1.text()}`);
    }
    
    // Test 2: Aggregation with non-array search_results
    console.log('\n📋 Test 2: Aggregation with non-array search_results');
    const badPayload = {
      ...goodPayload,
      search_results: { candidates: [] } // Not an array!
    };
    
    const res2 = await fetch(`${baseUrl}/internal/aggregate-results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(badPayload)
    });
    
    if (res2.status === 400) {
      const error = await res2.json() as any;
      console.log(`✅ Correctly rejected: ${error.error}`);
    } else {
      console.error('❌ Should have rejected non-array search_results');
    }
    
    // Test 3: Aggregation with empty results (simulating timeouts)
    console.log('\n📋 Test 3: Aggregation with empty results from timeouts');
    const timeoutPayload = {
      ...goodPayload,
      search_results: [
        { candidates: [] },  // Timeout result 1
        { candidates: [], error: 'request timed out' },  // Timeout result 2
        { candidates: [      // One successful result
          {
            name: 'Jane Smith',
            title: 'CTO',
            company: 'Blockchain Inc',
            linkedin_url: 'https://linkedin.com/in/janesmith',
            email: '',
            relevancy_to_type_score: 0.85,
            responsiveness: 'Medium',
            matching_reasons: ['Leader'],
            personalised_message: 'Hello',
            areas_of_expertise: ['Architecture'],
            conversation_topics: ['Strategy']
          }
        ]}
      ]
    };
    
    const res3 = await fetch(`${baseUrl}/internal/aggregate-results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(timeoutPayload)
    });
    
    if (res3.ok) {
      const result = await res3.json() as any;
      console.log(`✅ Success: Aggregated ${result.experts_count} experts despite timeouts`);
    } else {
      console.error(`❌ Failed: ${res3.status} - ${await res3.text()}`);
    }
    
    // Test 4: Direct aggregator test
    console.log('\n📋 Test 4: Direct aggregator test with mixed results');
    const aggregator = new ExpertAggregatorService();
    const expertTypes: ExpertType[] = [
      { expert_title: 'Type 1', why: 'test', importance_score: 0.9 },
      { expert_title: 'Type 2', why: 'test', importance_score: 0.8 }
    ];
    
    const searchResults = [
      [], // Empty result for type 1
      [   // Result for type 2
        {
          name: 'Test Expert',
          title: 'Title',
          company: 'Company',
          linkedin_url: 'https://linkedin.com/in/test',
          email: '',
          relevancy_to_type_score: 0.8,
          responsiveness: 'High' as const,
          matching_reasons: ['test'],
          personalised_message: 'test',
          areas_of_expertise: ['test'],
          conversation_topics: ['test']
        } as SearchCandidate
      ]
    ];
    
    try {
      const experts = aggregator.aggregateExperts(expertTypes, searchResults);
      console.log(`✅ Direct aggregation works: ${experts.length} experts`);
    } catch (error) {
      console.error('❌ Direct aggregation failed:', error);
    }
    
    console.log('\n✨ All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  } finally {
    server.close();
    process.exit(0);
  }
}

testFixes().catch(console.error);