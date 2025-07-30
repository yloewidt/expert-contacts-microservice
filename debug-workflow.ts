import dotenv from 'dotenv';
import { OpenAIService } from './src/services/openai';
import { ExpertAggregatorService } from './src/services/expertAggregator';
import { Database } from './src/models/database';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

async function debugWorkflow() {
  console.log('🔍 Debugging Workflow Steps...\n');
  
  const openAIService = new OpenAIService();
  const aggregatorService = new ExpertAggregatorService();
  const db = new Database();
  
  const testRequestId = uuidv4();
  const projectDescription = 'Testing workflow: Building a blockchain-based supply chain system';
  
  try {
    // Step 1: Create request
    console.log('📝 Step 1: Creating request in database...');
    await db.createSourcingRequest(projectDescription);
    console.log(`✅ Request created: ${testRequestId}`);
    
    // Step 2: Update status to processing
    console.log('\n🔄 Step 2: Updating status to processing...');
    await db.updateRequestStatus(testRequestId, 'processing');
    console.log('✅ Status updated');
    
    // Step 3: Generate expert types
    console.log('\n🎯 Step 3: Generating expert types...');
    const startTypes = Date.now();
    const expertTypes = await openAIService.generateExpertTypes(projectDescription);
    const typesTime = (Date.now() - startTypes) / 1000;
    console.log(`✅ Generated ${expertTypes.length} expert types in ${typesTime.toFixed(1)}s`);
    expertTypes.forEach((type, i) => {
      console.log(`   ${i + 1}. ${type.expert_title} (importance: ${type.importance_score})`);
    });
    
    // Step 4: Generate search prompts
    console.log('\n📋 Step 4: Generating search prompts...');
    const searchPrompts: string[] = [];
    const startPrompts = Date.now();
    
    for (const expertType of expertTypes) {
      const prompt = await openAIService.generateSearchPrompt(projectDescription, expertType);
      searchPrompts.push(prompt);
      console.log(`✅ Generated prompt for ${expertType.expert_title}`);
    }
    
    const promptsTime = (Date.now() - startPrompts) / 1000;
    console.log(`Total prompt generation time: ${promptsTime.toFixed(1)}s`);
    
    // Step 5: Execute searches (testing both sequential and parallel)
    console.log('\n🔍 Step 5: Executing expert searches...');
    
    // Sequential test
    console.log('\n--- Sequential Execution ---');
    const seqStart = Date.now();
    const seqResults = [];
    
    for (let i = 0; i < searchPrompts.length; i++) {
      const searchStart = Date.now();
      console.log(`Searching ${i + 1}/${searchPrompts.length}...`);
      
      try {
        const result = await openAIService.searchExperts(searchPrompts[i]);
        seqResults.push(result);
        const searchTime = (Date.now() - searchStart) / 1000;
        console.log(`✅ Found ${result.length} experts in ${searchTime.toFixed(1)}s`);
      } catch (error) {
        console.error(`❌ Search failed: ${error instanceof Error ? error.message : String(error)}`);
        seqResults.push([]);
      }
    }
    
    const seqTime = (Date.now() - seqStart) / 1000;
    console.log(`Sequential total time: ${seqTime.toFixed(1)}s`);
    
    // Parallel test
    console.log('\n--- Parallel Execution (Simulated) ---');
    const parStart = Date.now();
    
    const parPromises = searchPrompts.map(async (prompt, i) => {
      const searchStart = Date.now();
      try {
        const result = await openAIService.searchExperts(prompt);
        const searchTime = (Date.now() - searchStart) / 1000;
        console.log(`✅ Parallel search ${i + 1} completed in ${searchTime.toFixed(1)}s - Found ${result.length} experts`);
        return result;
      } catch (error) {
        console.error(`❌ Parallel search ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    });
    
    const parResults = await Promise.all(parPromises);
    const parTime = (Date.now() - parStart) / 1000;
    console.log(`Parallel total time: ${parTime.toFixed(1)}s`);
    console.log(`\n🚀 Speed improvement: ${(seqTime / parTime).toFixed(2)}x faster`);
    
    // Step 6: Aggregate results
    console.log('\n📊 Step 6: Aggregating results...');
    const experts = aggregatorService.aggregateExperts(expertTypes, parResults);
    console.log(`✅ Aggregated ${experts.length} unique experts`);
    
    // Step 7: Save to database
    console.log('\n💾 Step 7: Saving to database...');
    await db.saveRawOutputs(testRequestId, expertTypes, searchPrompts, parResults);
    await db.saveExperts(testRequestId, experts);
    console.log('✅ Data saved successfully');
    
    // Step 8: Update status to completed
    console.log('\n✅ Step 8: Updating status to completed...');
    await db.updateRequestStatus(testRequestId, 'completed', new Date());
    
    // Total time
    console.log('\n⏱️  Total workflow time would be:');
    console.log(`- Sequential: ~${(typesTime + promptsTime + seqTime + 2).toFixed(1)}s`);
    console.log(`- Parallel: ~${(typesTime + promptsTime + parTime + 2).toFixed(1)}s`);
    
    console.log('\n✨ Workflow simulation completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Workflow failed:', error);
    await db.updateRequestStatus(testRequestId, 'failed');
  }
}

// Run the debug
debugWorkflow().catch(console.error);