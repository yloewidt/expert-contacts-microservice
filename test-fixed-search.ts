import dotenv from 'dotenv';
import { OpenAIService } from './src/services/openai';
import { logger } from './src/config/logger';

dotenv.config();

async function testFixedSearch() {
  console.log('🧪 Testing Fixed o3 Search...\n');
  
  const openAIService = new OpenAIService();
  
  const searchPrompt = `Find 2 experts in blockchain technology. 
  For each expert, return a JSON object with: name, title, company, linkedin_url, email, 
  matching_reasons (array of strings), relevancy_to_type_score (0-1), 
  responsiveness (High/Medium/Low), personalised_message.`;
  
  try {
    console.log('📡 Calling searchExperts with fixed code...\n');
    const candidates = await openAIService.searchExperts(searchPrompt);
    
    console.log('✅ Search completed successfully!\n');
    console.log('Number of candidates found:', candidates.length);
    
    if (candidates.length > 0) {
      console.log('\nFirst candidate:');
      console.log(JSON.stringify(candidates[0], null, 2));
    }
    
    return true;
  } catch (error) {
    console.error('❌ Search failed:', error);
    return false;
  }
}

testFixedSearch().then(success => {
  if (success) {
    console.log('\n🎉 Test passed! The fix works.');
  } else {
    console.log('\n💔 Test failed. More debugging needed.');
  }
  process.exit(success ? 0 : 1);
});