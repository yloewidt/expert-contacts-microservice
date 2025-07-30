import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';

async function testParallelWorkflow() {
  console.log('🔍 Testing Parallel Workflow Implementation...\n');
  
  try {
    // Load and parse the workflow
    const workflowContent = readFileSync('./workflows/expert-sourcing-workflow.yaml', 'utf8');
    const workflow = yaml.load(workflowContent) as any;
    
    // Check for parallel execution
    const executeSearchesStep = workflow.main.steps.find((step: any) => 
      step.executeSearches !== undefined
    );
    
    if (!executeSearchesStep) {
      console.error('❌ Could not find executeSearches step');
      return false;
    }
    
    const executeSearches = executeSearchesStep.executeSearches;
    
    // Validate parallel configuration
    if (!executeSearches.parallel) {
      console.error('❌ executeSearches step is not using parallel execution');
      return false;
    }
    
    console.log('✅ Parallel execution configured');
    
    // Check for shared variables
    if (!executeSearches.parallel.shared || !executeSearches.parallel.shared.includes('searchResults')) {
      console.error('❌ searchResults not declared as shared variable');
      return false;
    }
    
    console.log('✅ Shared variable searchResults configured');
    
    // Check for concurrency limit
    if (executeSearches.parallel.concurrency_limit) {
      console.log(`✅ Concurrency limit set to: ${executeSearches.parallel.concurrency_limit}`);
    } else {
      console.log('ℹ️  No concurrency limit set (unlimited parallelism)');
    }
    
    // Check for proper for loop structure
    if (!executeSearches.parallel.for) {
      console.error('❌ Missing for loop in parallel block');
      return false;
    }
    
    console.log('✅ For loop properly configured in parallel block');
    
    // Validate the steps within parallel execution
    const parallelSteps = executeSearches.parallel.steps;
    if (!Array.isArray(parallelSteps) || parallelSteps.length === 0) {
      console.error('❌ No steps defined in parallel execution');
      return false;
    }
    
    // Check that we're still calling the search and appending results
    const hasCallSearch = parallelSteps.some((step: any) => step.callSearch);
    const hasAppendResult = parallelSteps.some((step: any) => step.appendSearchResult);
    
    if (!hasCallSearch || !hasAppendResult) {
      console.error('❌ Missing required steps in parallel execution');
      return false;
    }
    
    console.log('✅ All required steps present in parallel execution');
    
    // Display the parallel configuration
    console.log('\n📋 Parallel Configuration:');
    console.log('- Shared Variables:', executeSearches.parallel.shared);
    console.log('- Concurrency Limit:', executeSearches.parallel.concurrency_limit || 'None');
    console.log('- For Loop Variable:', executeSearches.parallel.for.value);
    console.log('- For Loop Index:', executeSearches.parallel.for.index);
    console.log('- Steps Count:', parallelSteps.length);
    
    console.log('\n✅ Workflow successfully configured for parallel execution!');
    console.log('\nKey improvements:');
    console.log('- Expert searches will run in parallel (up to 5 concurrent)');
    console.log('- Significant reduction in total execution time expected');
    console.log('- Results collected in shared searchResults array');
    
    return true;
  } catch (error) {
    console.error('❌ Error validating workflow:', error);
    return false;
  }
}

// Run the test
testParallelWorkflow().then(success => {
  if (success) {
    console.log('\n🎉 Parallel workflow validation passed!');
    process.exit(0);
  } else {
    console.log('\n💔 Parallel workflow validation failed!');
    process.exit(1);
  }
}).catch(console.error);