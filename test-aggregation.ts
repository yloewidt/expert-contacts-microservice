import { ExpertAggregatorService } from './src/services/expertAggregator';
import { ExpertType, SearchCandidate } from './src/types';

// Test the aggregation logic
function testAggregation() {
  console.log('🧪 Testing Aggregation Logic...\n');
  
  const aggregator = new ExpertAggregatorService();
  
  // Mock expert types
  const expertTypes: ExpertType[] = [
    { expert_title: 'Blockchain Developer', why: 'test', importance_score: 0.9 },
    { expert_title: 'Supply Chain Expert', why: 'test', importance_score: 0.8 }
  ];
  
  // Test Case 1: Correct format (what aggregator expects)
  console.log('✅ Test Case 1: Correct format');
  const correctFormat: SearchCandidate[][] = [
    [
      { name: 'John Doe', title: 'Senior Blockchain Dev', company: 'ABC Corp', linkedin_url: 'https://linkedin.com/in/johndoe', email: '', relevancy_to_type_score: 0.9, responsiveness: 'High' as const, matching_reasons: ['test'], personalised_message: 'test', areas_of_expertise: ['Blockchain'], conversation_topics: ['Smart contracts'] }
    ],
    [
      { name: 'Jane Smith', title: 'Supply Chain Manager', company: 'XYZ Ltd', linkedin_url: 'https://linkedin.com/in/janesmith', email: '', relevancy_to_type_score: 0.85, responsiveness: 'Medium' as const, matching_reasons: ['test'], personalised_message: 'test', areas_of_expertise: ['Logistics'], conversation_topics: ['Optimization'] }
    ]
  ];
  
  try {
    const result1 = aggregator.aggregateExperts(expertTypes, correctFormat);
    console.log(`Success: Aggregated ${result1.length} experts`);
  } catch (error) {
    console.error('Failed:', error);
  }
  
  // Test Case 2: What workflow might be sending (wrapped in response object)
  console.log('\n❌ Test Case 2: Wrapped format (what workflow sends)');
  const wrappedFormat = [
    { candidates: correctFormat[0] },
    { candidates: correctFormat[1] }
  ];
  
  try {
    const result2 = aggregator.aggregateExperts(expertTypes, wrappedFormat as any);
    console.log(`Success: Aggregated ${result2.length} experts`);
  } catch (error) {
    console.error('Failed:', error);
  }
  
  // Test Case 3: Fixed extraction
  console.log('\n🔧 Test Case 3: Fixed extraction');
  const fixedExtraction = wrappedFormat.map((r: any) => r.candidates || []);
  
  try {
    const result3 = aggregator.aggregateExperts(expertTypes, fixedExtraction);
    console.log(`Success: Aggregated ${result3.length} experts`);
  } catch (error) {
    console.error('Failed:', error);
  }
  
  // Test Case 4: What if some searches fail?
  console.log('\n⚠️ Test Case 4: Some searches fail');
  const mixedResults = [
    { candidates: correctFormat[0] },
    { error: 'Timeout' },
    { candidates: [] }
  ];
  
  const safeExtraction = mixedResults.map((r: any) => r.candidates || []);
  
  try {
    const result4 = aggregator.aggregateExperts(expertTypes, safeExtraction);
    console.log(`Success: Aggregated ${result4.length} experts (some searches failed)`);
  } catch (error) {
    console.error('Failed:', error);
  }
}

testAggregation();