// Simulate what the workflow is actually sending to the aggregation endpoint

async function testWorkflowFormat() {
  console.log('🔍 Testing Workflow Data Format...\n');
  
  // This is what the workflow sends after parallel execution
  // searchResults: ${list.concat(searchResults, searchResult.body)}
  
  // Where searchResult.body is the response from /internal/search-experts
  // which returns: { candidates: [...] }
  
  console.log('📋 Step 1: What /internal/search-experts returns');
  const searchEndpointResponse = {
    candidates: [
      {
        name: 'John Doe',
        title: 'Blockchain Developer',
        company: 'Tech Corp',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        email: '',
        relevancy_to_type_score: 0.9,
        responsiveness: 'High' as const,
        matching_reasons: ['Expert in blockchain'],
        personalised_message: 'Hi John...',
        areas_of_expertise: ['Blockchain', 'Smart Contracts'],
        conversation_topics: ['DeFi protocols']
      }
    ]
  };
  
  console.log('Response structure:', JSON.stringify(searchEndpointResponse, null, 2));
  
  console.log('\n📋 Step 2: What workflow accumulates in searchResults');
  // The workflow does: searchResults = list.concat(searchResults, searchResult.body)
  // So searchResults becomes an array of response bodies
  const searchResults = [
    searchEndpointResponse, // First search result
    searchEndpointResponse, // Second search result
    { candidates: [] }      // Third search (no results)
  ];
  
  console.log('searchResults array:', JSON.stringify(searchResults, null, 2).substring(0, 200) + '...');
  
  console.log('\n📋 Step 3: What aggregation endpoint receives');
  const aggregationPayload = {
    request_id: 'test-123',
    expert_types: [
      { expert_title: 'Blockchain Developer', why: 'test', importance_score: 0.9 }
    ],
    search_prompts: ['Find blockchain developers...'],
    search_results: searchResults  // This is the key part!
  };
  
  console.log('Aggregation receives search_results as:', typeof aggregationPayload.search_results);
  console.log('Is it an array?', Array.isArray(aggregationPayload.search_results));
  console.log('First element:', aggregationPayload.search_results[0]);
  
  console.log('\n❌ The Problem:');
  console.log('- Aggregator expects: search_results to be an array of arrays of candidates');
  console.log('- Workflow sends: search_results as an array of response objects with candidates property');
  
  console.log('\n✅ The Fix:');
  console.log('In internalRoutes.ts, line 113 should be:');
  console.log('OLD: search_results.map((r: any) => r.candidates || [])');
  console.log('NEW: This already handles the transformation correctly!');
  
  console.log('\n🤔 So why is it failing?');
  console.log('Let me check if search_results might not be an array...');
  
  // Test with non-array
  const badPayload = {
    search_results: { candidates: [] } // Not an array!
  };
  
  console.log('\nIf search_results is not an array:');
  console.log('typeof:', typeof badPayload.search_results);
  console.log('Array.isArray:', Array.isArray(badPayload.search_results));
  
  try {
    const result = (badPayload.search_results as any).map((r: any) => r.candidates || []);
    console.log('Map result:', result);
  } catch (error) {
    console.log('❌ Error:', (error as Error).message);
  }
}

testWorkflowFormat();