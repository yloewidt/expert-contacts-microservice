import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import express from 'express';
import apiRoutes from './src/api/routes';
import jobsRoute from './src/api/jobsRoute';
// import { Database } from './src/models/database';

dotenv.config();

async function runAllTests() {
  console.log('🔍 COMPREHENSIVE ISSUE ANALYSIS\n');
  
  const issues: string[] = [];
  
  // Test 1: Database Connection
  console.log('1️⃣ Testing Database Connection');
  console.log('================================');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'expert_contacts',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000
  };
  
  console.log('Config:', {
    ...config,
    password: config.password ? `[${config.password.length} chars]` : 'undefined'
  });
  
  const pool = new Pool(config);
  
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
  } catch (err: any) {
    console.log('❌ Database connection failed:', err.message);
    issues.push(`Database connection: ${err.message}`);
  }
  
  // Test 2: Table Schema
  console.log('\n2️⃣ Testing Table Schema');
  console.log('========================');
  
  try {
    const tables = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'expert_request_matches'
      ORDER BY ordinal_position
    `);
    
    const columns = tables.rows.map(r => r.column_name);
    console.log('Columns in expert_request_matches:', columns);
    
    if (!columns.includes('areas_of_expertise')) {
      console.log('❌ Missing column: areas_of_expertise');
      issues.push('Missing column: areas_of_expertise');
    }
    if (!columns.includes('conversation_topics')) {
      console.log('❌ Missing column: conversation_topics');
      issues.push('Missing column: conversation_topics');
    }
    
    if (columns.includes('areas_of_expertise') && columns.includes('conversation_topics')) {
      console.log('✅ All required columns exist');
    }
  } catch (err: any) {
    console.log('❌ Schema check failed:', err.message);
    issues.push(`Schema check: ${err.message}`);
  }
  
  // Test 3: API Endpoints
  console.log('\n3️⃣ Testing API Endpoints');
  console.log('=========================');
  
  const app = express();
  app.use(express.json());
  app.use('/', apiRoutes);
  app.use('/', jobsRoute);
  
  const server = app.listen(0);
  const port = (server.address() as any).port;
  
  // Test jobs endpoint
  try {
    const response = await fetch(`http://localhost:${port}/api/v1/jobs`);
    const data = await response.json() as any;
    
    if (response.ok) {
      console.log('✅ Jobs endpoint working');
      console.log(`   Found ${data.jobs?.length || 0} jobs`);
    } else {
      console.log('❌ Jobs endpoint failed:', response.status);
      issues.push(`Jobs endpoint: ${response.status} - ${JSON.stringify(data)}`);
    }
  } catch (err: any) {
    console.log('❌ Jobs endpoint error:', err.message);
    issues.push(`Jobs endpoint: ${err.message}`);
  }
  
  // Test specific job endpoint
  try {
    const testId = '3de1b5cd-7017-4a61-8833-e5f4a6d7d901';
    const response = await fetch(`http://localhost:${port}/api/v1/source/${testId}`);
    const data = await response.json() as any;
    
    if (response.ok) {
      console.log('✅ Get job endpoint working');
      console.log(`   Job status: ${data.status}`);
    } else {
      console.log('❌ Get job endpoint failed:', response.status);
      issues.push(`Get job endpoint: ${response.status} - ${JSON.stringify(data)}`);
    }
  } catch (err: any) {
    console.log('❌ Get job endpoint error:', err.message);
    issues.push(`Get job endpoint: ${err.message}`);
  }
  
  // Test 4: Environment Variables
  console.log('\n4️⃣ Testing Environment Variables');
  console.log('==================================');
  
  const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingEnvVars.length > 0) {
    console.log('❌ Missing environment variables:', missingEnvVars);
    issues.push(`Missing env vars: ${missingEnvVars.join(', ')}`);
  } else {
    console.log('✅ All required environment variables present');
  }
  
  // Test 5: Cloud Run specific checks
  console.log('\n5️⃣ Cloud Run Configuration Check');
  console.log('==================================');
  
  console.log('K_SERVICE (Cloud Run):', process.env.K_SERVICE || 'Not running in Cloud Run');
  console.log('USE_PUBLIC_IP:', process.env.USE_PUBLIC_IP || 'Not set');
  console.log('CLOUD_SQL_CONNECTION_NAME:', process.env.CLOUD_SQL_CONNECTION_NAME || 'Not set');
  
  // Summary
  console.log('\n📊 ISSUE SUMMARY');
  console.log('=================');
  
  if (issues.length === 0) {
    console.log('✅ No issues found!');
  } else {
    console.log(`❌ Found ${issues.length} issues:`);
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }
  
  // Cleanup
  server.close();
  await pool.end();
  
  return issues;
}

runAllTests().catch(console.error).then(() => process.exit(0));