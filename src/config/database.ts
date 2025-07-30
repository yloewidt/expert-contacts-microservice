import { Pool, PoolConfig } from 'pg';
import * as dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

// Check if running in Cloud Run with Cloud SQL
const isCloudRun = process.env.K_SERVICE !== undefined;
const cloudSqlConnection = process.env.CLOUD_SQL_CONNECTION_NAME;

let config: PoolConfig;

if (isCloudRun && cloudSqlConnection) {
  // Try Unix socket first, fallback to public IP if needed
  const usePublicIp = process.env.USE_PUBLIC_IP === 'true';
  
  if (usePublicIp) {
    // Fallback to public IP due to known Cloud Run Unix socket issues
    config = {
      host: '34.121.141.137', // expert-contacts-dev public IP
      port: 5432,
      database: process.env.DB_NAME || 'expert_contacts',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: false, // Cloud SQL doesn't require SSL from authorized networks
    };
    logger.info('Using public IP connection due to Unix socket issues');
  } else {
    // Use Unix socket for Cloud Run
    config = {
      host: `/cloudsql/${cloudSqlConnection}`,
      database: process.env.DB_NAME || 'expert_contacts',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increase timeout
    };
  }
  
  logger.info({
    host: config.host,
    database: config.database,
    user: config.user,
    passwordLength: config.password?.length,
    isCloudRun: true,
    usePublicIp
  }, 'Database configuration for Cloud Run');
} else {
  // Use TCP connection for local development
  config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'expert_contacts',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

export const pool = new Pool(config);

// Add connection event listeners for debugging
pool.on('error', (err) => {
  logger.error({ error: err }, 'Unexpected pool error');
});

pool.on('connect', () => {
  logger.info('New client connected to pool');
});

pool.on('acquire', () => {
  logger.debug('Client acquired from pool');
});

pool.on('remove', () => {
  logger.debug('Client removed from pool');
});