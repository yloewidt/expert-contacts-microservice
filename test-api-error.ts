import express from 'express';
import dotenv from 'dotenv';
import apiRoutes from './src/api/routes';
import { Database } from './src/models/database';

dotenv.config();

async function testAPIError() {
  console.log('🔍 Testing API Error...\n');
  
  // Create a test express app
  const app = express();
  app.use(express.json());
  app.use('/', apiRoutes);
  
  // Add error logging middleware
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('❌ Error caught:', err);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  });
  
  // Start server
  const server = app.listen(0, () => {
    console.log(`✅ Test server started on port ${(server.address() as any).port}\n`);
  });
  
  const port = (server.address() as any).port;
  
  try {
    // Test 1: Create a job
    console.log('📋 Test 1: Creating a job');
    const createRes = await fetch(`http://localhost:${port}/api/v1/source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_description: 'Test job' })
    });
    
    if (createRes.ok) {
      const data = await createRes.json() as any;
      console.log(`✅ Job created: ${data.request_id}`);
      
      // Test 2: Get the job details
      console.log('\n📋 Test 2: Getting job details');
      const getRes = await fetch(`http://localhost:${port}/api/v1/source/${data.request_id}`);
      
      if (!getRes.ok) {
        const error = await getRes.json();
        console.error(`❌ Failed to get job: ${getRes.status}`);
        console.error('Error response:', error);
      } else {
        const jobData = await getRes.json();
        console.log('✅ Job retrieved:', jobData);
      }
    } else {
      const error = await createRes.json();
      console.error('❌ Failed to create job:', error);
    }
    
    // Test 3: Get a non-existent job
    console.log('\n📋 Test 3: Getting non-existent job');
    const badRes = await fetch(`http://localhost:${port}/api/v1/source/bad-id-123`);
    
    if (badRes.status === 404) {
      console.log('✅ Correctly returned 404 for non-existent job');
    } else {
      console.error(`❌ Unexpected status: ${badRes.status}`);
    }
    
    // Test 4: Direct database test
    console.log('\n📋 Test 4: Direct database connection test');
    const db = new Database();
    
    try {
      const testId = 'abff1974-88f3-431f-9a09-16ed904e4ffc';
      console.log(`Testing getRequest for ID: ${testId}`);
      const request = await db.getRequest(testId);
      
      if (request) {
        console.log('✅ Database query successful:', request.id);
      } else {
        console.log('⚠️ No request found with that ID');
      }
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    server.close();
    process.exit(0);
  }
}

// Run the test
testAPIError().catch(console.error);