import dotenv from 'dotenv';
import { OpenAIService } from './src/services/openai';
import { logger } from './src/config/logger';

// Load environment variables
dotenv.config();

async function testOpenAIIntegration() {
  console.log('🧪 Testing OpenAI Integration...\n');
  
  try {
    // Initialize OpenAI service
    const openAIService = new OpenAIService();
    
    // Test project description
    const projectDescription = `
      I'm building a B2B SaaS platform that helps small to medium-sized manufacturing companies 
      optimize their supply chain management using AI-powered demand forecasting and inventory 
      optimization. The platform will integrate with existing ERP systems and provide real-time 
      insights on inventory levels, supplier performance, and demand patterns.
    `;
    
    // Test 1: Generate Expert Types
    console.log('📋 Test 1: Generating Expert Types...');
    console.log('Project Description:', projectDescription.trim());
    console.log('\n');
    
    const expertTypes = await openAIService.generateExpertTypes(projectDescription);
    
    console.log('✅ Expert Types Generated Successfully:');
    console.log(JSON.stringify(expertTypes, null, 2));
    console.log(`\nTotal Expert Types: ${expertTypes.length}`);
    
    // Validate expert types
    for (const expertType of expertTypes) {
      if (!expertType.expert_title || !expertType.why || typeof expertType.importance_score !== 'number') {
        throw new Error(`Invalid expert type: ${JSON.stringify(expertType)}`);
      }
      if (expertType.importance_score < 0 || expertType.importance_score > 1) {
        throw new Error(`Invalid importance score: ${expertType.importance_score}`);
      }
    }
    console.log('✅ All expert types are valid\n');
    
    // Test 2: Generate Search Prompt
    console.log('🔍 Test 2: Generating Search Prompt...');
    const firstExpertType = expertTypes[0];
    console.log(`For Expert Type: ${firstExpertType.expert_title}`);
    
    const searchPrompt = await openAIService.generateSearchPrompt(projectDescription, firstExpertType);
    console.log('\n✅ Search Prompt Generated:');
    console.log(searchPrompt);
    console.log('\n');
    
    // Test 3: Search Experts (with o3)
    console.log('🌐 Test 3: Searching for Experts with o3...');
    console.log('This may take a minute as o3 performs web searches...\n');
    
    const searchCandidates = await openAIService.searchExperts(searchPrompt);
    
    console.log('✅ Expert Search Completed:');
    console.log(`Found ${searchCandidates.length} candidates\n`);
    
    // Display first 2 candidates
    searchCandidates.slice(0, 2).forEach((candidate, index) => {
      console.log(`Candidate ${index + 1}:`);
      console.log(`- Name: ${candidate.name}`);
      console.log(`- Title: ${candidate.title}`);
      console.log(`- Company: ${candidate.company}`);
      console.log(`- LinkedIn: ${candidate.linkedin_url}`);
      console.log(`- Email: ${candidate.email || 'Not found'}`);
      console.log(`- Relevancy Score: ${candidate.relevancy_to_type_score}`);
      console.log(`- Responsiveness: ${candidate.responsiveness}`);
      console.log(`- Matching Reasons: ${candidate.matching_reasons.length} reasons`);
      console.log('\n');
    });
    
    // Validate search results
    for (const candidate of searchCandidates) {
      if (!candidate.name || !candidate.title || !candidate.company || !candidate.linkedin_url) {
        throw new Error(`Invalid candidate: ${JSON.stringify(candidate)}`);
      }
      if (!candidate.linkedin_url.includes('linkedin.com')) {
        throw new Error(`Invalid LinkedIn URL: ${candidate.linkedin_url}`);
      }
      if (typeof candidate.relevancy_to_type_score !== 'number') {
        throw new Error(`Invalid relevancy score: ${candidate.relevancy_to_type_score}`);
      }
    }
    console.log('✅ All candidates are valid\n');
    
    console.log('🎉 All tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testOpenAIIntegration().catch(console.error);