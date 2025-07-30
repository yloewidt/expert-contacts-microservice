import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('Testing database connection...\n');
  
  // Test 1: Try with public IP directly
  console.log('Test 1: Public IP connection');
  const publicIpConfig = {
    host: '34.121.141.137',
    port: 5432,
    database: 'expert_contacts',
    user: 'app_user',
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
    ssl: false
  };
  
  console.log('Config:', {
    ...publicIpConfig,
    password: publicIpConfig.password ? `[${publicIpConfig.password.length} chars]` : 'undefined'
  });
  
  const pool1 = new Pool(publicIpConfig);
  
  try {
    const result = await pool1.query('SELECT NOW()');
    console.log('✅ Public IP connection successful:', result.rows[0]);
  } catch (err: any) {
    console.error('❌ Public IP connection failed:', {
      message: err.message,
      code: err.code,
      errno: err.errno,
      syscall: err.syscall,
      address: err.address,
      port: err.port
    });
  } finally {
    await pool1.end();
  }
  
  // Test 2: Try with localhost (for comparison)
  console.log('\nTest 2: Localhost connection');
  const localhostConfig = {
    host: 'localhost',
    port: 5432,
    database: 'expert_contacts',
    user: 'app_user',
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000
  };
  
  const pool2 = new Pool(localhostConfig);
  
  try {
    const result = await pool2.query('SELECT NOW()');
    console.log('✅ Localhost connection successful:', result.rows[0]);
  } catch (err: any) {
    console.error('❌ Localhost connection failed:', {
      message: err.message,
      code: err.code
    });
  } finally {
    await pool2.end();
  }
  
  // Test 3: Check environment variables
  console.log('\nTest 3: Environment variables');
  console.log('DB_PASSWORD exists:', !!process.env.DB_PASSWORD);
  console.log('DB_PASSWORD length:', process.env.DB_PASSWORD?.length || 0);
  console.log('K_SERVICE (Cloud Run):', process.env.K_SERVICE);
  console.log('CLOUD_SQL_CONNECTION_NAME:', process.env.CLOUD_SQL_CONNECTION_NAME);
  console.log('USE_PUBLIC_IP:', process.env.USE_PUBLIC_IP);
}

testConnection().catch(console.error);