import dotenv from 'dotenv';
import { OpenAIService } from './src/services/openai';
import { logger } from './src/config/logger';

dotenv.config();

async function testAllChanges() {
  console.log('🧪 Testing All Changes Locally...\n');
  
  const openAIService = new OpenAIService();
  
  // Test 1: Generate expert types
  console.log('📋 Test 1: Generating Expert Types...');
  const projectDescription = `Building a B2B SaaS platform for supply chain optimization using AI`;
  
  try {
    const expertTypes = await openAIService.generateExpertTypes(projectDescription);
    console.log('✅ Expert types generated:', expertTypes.length);
    console.log('First expert type:', expertTypes[0]);
  } catch (error) {
    console.error('❌ Failed to generate expert types:', error);
    return false;
  }
  
  // Test 2: Search for experts with new fields
  console.log('\n🔍 Test 2: Searching for Experts with New Fields...');
  const searchPrompt = `Find 2 experts in AI and supply chain optimization. 
  For each expert, include:
  - name, title, company, linkedin_url, email
  - matching_reasons (array of strings with citations)
  - relevancy_to_type_score (0-1)
  - responsiveness (High/Medium/Low)
  - personalised_message
  - areas_of_expertise (3-5 specific technical/domain areas)
  - conversation_topics (3-5 specific topics to discuss based on our project)`;
  
  try {
    const candidates = await openAIService.searchExperts(searchPrompt);
    console.log('✅ Found', candidates.length, 'candidates');
    
    if (candidates.length > 0) {
      const first = candidates[0];
      console.log('\nFirst candidate structure:');
      console.log('- Name:', first.name);
      console.log('- Title:', first.title);
      console.log('- Company:', first.company);
      console.log('- LinkedIn:', first.linkedin_url);
      console.log('- Areas of Expertise:', first.areas_of_expertise);
      console.log('- Conversation Topics:', first.conversation_topics);
      console.log('- Matching Reasons:', first.matching_reasons.length);
      
      // Validate new fields
      if (!first.areas_of_expertise || first.areas_of_expertise.length < 3) {
        console.error('❌ Missing or insufficient areas_of_expertise');
        return false;
      }
      
      if (!first.conversation_topics || first.conversation_topics.length < 3) {
        console.error('❌ Missing or insufficient conversation_topics');
        return false;
      }
      
      console.log('\n✅ All required fields present!');
    }
  } catch (error) {
    console.error('❌ Search failed:', error);
    return false;
  }
  
  // Test 3: Check parallel execution simulation
  console.log('\n🔀 Test 3: Simulating Parallel Execution...');
  const prompts = [
    'Find experts in blockchain',
    'Find experts in machine learning',
    'Find experts in cloud architecture'
  ];
  
  console.log('Starting 3 searches in parallel...');
  const startTime = Date.now();
  
  try {
    const results = await Promise.all(
      prompts.map(prompt => 
        openAIService.searchExperts(prompt)
          .then(r => ({ prompt, count: r.length }))
          .catch(e => ({ prompt, error: e.message }))
      )
    );
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ Parallel searches completed in ${duration.toFixed(1)}s`);
    
    results.forEach(result => {
      if ('error' in result) {
        console.log(`- "${result.prompt}": Error - ${result.error}`);
      } else {
        console.log(`- "${result.prompt}": Found ${result.count} experts`);
      }
    });
  } catch (error) {
    console.error('❌ Parallel execution failed:', error);
    return false;
  }
  
  return true;
}

// Test the workflow YAML syntax
import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';

async function testWorkflowYaml() {
  console.log('\n📄 Test 4: Validating Workflow YAML...');
  
  try {
    const workflowContent = readFileSync('./workflows/expert-sourcing-workflow.yaml', 'utf8');
    const workflow = yaml.load(workflowContent);
    
    // Check for parallel step
    const hasParallel = JSON.stringify(workflow).includes('parallel');
    if (hasParallel) {
      console.log('✅ Workflow contains parallel execution');
    } else {
      console.log('❌ Workflow missing parallel execution');
      return false;
    }
    
    console.log('✅ Workflow YAML is valid');
    return true;
  } catch (error) {
    console.error('❌ Workflow YAML error:', error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running Comprehensive Local Tests\n');
  
  const testsPass = await testAllChanges();
  const workflowPass = await testWorkflowYaml();
  
  if (testsPass && workflowPass) {
    console.log('\n🎉 All tests passed! Ready to deploy.');
    process.exit(0);
  } else {
    console.log('\n💔 Some tests failed. Please fix before deploying.');
    process.exit(1);
  }
}

runAllTests().catch(console.error);