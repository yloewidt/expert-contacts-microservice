#!/usr/bin/env node

import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = 'test-secret';
const BASE_URL = 'http://localhost:3600';

// Test cases
const tests = [
  {
    name: 'Health Check',
    method: 'GET',
    endpoint: '/health',
    headers: {},
    expectedStatus: 200
  },
  {
    name: 'Search Experts (Authenticated)',
    method: 'GET', 
    endpoint: '/api/v1/experts/search',
    headers: { 'X-API-Key': API_KEY },
    expectedStatus: 200
  },
  {
    name: 'Search Experts (Unauthenticated)',
    method: 'GET',
    endpoint: '/api/v1/experts/search',
    headers: {},
    expectedStatus: 401
  },
  {
    name: 'Get Non-existent Expert',
    method: 'GET',
    endpoint: '/api/v1/experts/999',
    headers: { 'X-API-Key': API_KEY },
    expectedStatus: 404
  }
];

async function runTest(test) {
  try {
    console.log(`\nRunning test: ${test.name}`);
    
    const response = await fetch(`${BASE_URL}${test.endpoint}`, {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        ...test.headers
      },
      body: test.body ? JSON.stringify(test.body) : undefined
    });
    
    const data = await response.json();
    
    if (response.status === test.expectedStatus) {
      console.log(`✅ PASSED: Status ${response.status}`);
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ FAILED: Expected ${test.expectedStatus}, got ${response.status}`);
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    
    return response.status === test.expectedStatus;
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    return false;
  }
}

async function startServer() {
  console.log('Starting server...');
  
  const serverProcess = spawn('node', ['src/server.js'], {
    cwd: join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: '3600',
      NODE_ENV: 'test',
      API_KEY_SECRET: 'test-secret',
      DATABASE_PATH: ':memory:',
      LOG_LEVEL: 'error'
    },
    detached: true
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return serverProcess;
}

async function main() {
  let serverProcess;
  
  try {
    // Start server
    serverProcess = await startServer();
    
    // Run tests
    console.log('\n🧪 Running microservice tests...\n');
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      const result = await runTest(test);
      if (result) passed++;
      else failed++;
    }
    
    console.log('\n📊 Test Summary:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Total: ${tests.length}`);
    
    // Test with mock OpenAI response (manual test)
    console.log('\n📝 Note: Expert sourcing requires valid OpenAI API key.');
    console.log('   In production, set OPENAI_API_KEY environment variable.');
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    // Clean up
    if (serverProcess) {
      process.kill(-serverProcess.pid);
    }
  }
}

main().catch(console.error);