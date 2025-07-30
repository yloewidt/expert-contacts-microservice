import express from 'express';
import dotenv from 'dotenv';
import internalRouter from './src/api/internalRoutes';

dotenv.config();

async function testInternalEndpoints() {
  console.log('🧪 Testing Internal Endpoints...\n');
  
  // Create a test express app
  const app = express();
  app.use(express.json());
  app.use('/', internalRouter);
  
  // Start server
  const server = app.listen(0, () => {
    const port = (server.address() as any).port;
    console.log(`✅ Test server started on port ${port}\n`);
  });
  
  const baseUrl = `http://localhost:${(server.address() as any).port}`;
  
  try {
    // Test 1: Generate expert types
    console.log('📋 Test 1: Generate Expert Types');
    const typesRes = await fetch(`${baseUrl}/internal/generate-expert-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_description: 'Building a blockchain-based supply chain tracking system'
      })
    });
    
    if (!typesRes.ok) {
      const error = await typesRes.text();
      console.error(`❌ Failed: ${typesRes.status} - ${error}`);
    } else {
      const data = await typesRes.json() as any;
      console.log(`✅ Success: Generated ${data.expert_types.length} expert types`);
      console.log(`   First type: ${data.expert_types[0].expert_title}`);
    }
    
    // Test 2: Generate search prompt
    console.log('\n🔍 Test 2: Generate Search Prompt');
    const promptRes = await fetch(`${baseUrl}/internal/generate-search-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_description: 'Building a blockchain-based supply chain tracking system',
        expert_type: {
          expert_title: 'Blockchain Developer',
          why: 'Needed for smart contract development',
          importance_score: 0.9
        }
      })
    });
    
    if (!promptRes.ok) {
      const error = await promptRes.text();
      console.error(`❌ Failed: ${promptRes.status} - ${error}`);
    } else {
      const data = await promptRes.json() as any;
      console.log(`✅ Success: Generated search prompt`);
      console.log(`   Prompt preview: ${data.search_prompt.substring(0, 100)}...`);
    }
    
    // Test 3: Search experts
    console.log('\n👥 Test 3: Search Experts');
    console.log('⏳ This may take 30-60 seconds...');
    const searchRes = await fetch(`${baseUrl}/internal/search-experts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        search_prompt: 'Find 2 experts in blockchain development with supply chain experience'
      })
    });
    
    if (!searchRes.ok) {
      const error = await searchRes.text();
      console.error(`❌ Failed: ${searchRes.status} - ${error}`);
    } else {
      const data = await searchRes.json() as any;
      console.log(`✅ Success: Found ${data.candidates.length} candidates`);
      if (data.candidates.length > 0) {
        console.log(`   First candidate: ${data.candidates[0].name} - ${data.candidates[0].title}`);
      }
    }
    
    // Test 4: Check timeout handling
    console.log('\n⏱️ Test 4: Check Timeout Handling');
    console.log('Testing with 5 second timeout on search...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const timeoutRes = await fetch(`${baseUrl}/internal/search-experts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_prompt: 'Find experts in quantum computing'
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!timeoutRes.ok) {
        console.log(`⚠️ Request failed with status: ${timeoutRes.status}`);
      } else {
        console.log('✅ Request completed within timeout');
      }
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        console.log('⏱️ Request timed out after 5 seconds');
      } else {
        console.error('❌ Unexpected error:', error);
      }
    }
    
    console.log('\n✨ All endpoint tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    server.close();
    process.exit(0);
  }
}

// Run tests
testInternalEndpoints().catch(console.error);