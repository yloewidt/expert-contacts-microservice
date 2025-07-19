import crypto from 'crypto';
import logger from '../utils/logger.js';

// Simple API key authentication
export const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // In production, store hashed API keys in database
  // For now, we'll use a simple comparison with the secret
  const apiKeySecret = process.env.API_KEY_SECRET || 'default-secret-change-in-production';
  
  // For testing/demo purposes, accept either the secret itself or its SHA256 hash
  const secretHash = crypto
    .createHash('sha256')
    .update(apiKeySecret)
    .digest('hex');
  
  if (apiKey !== apiKeySecret && apiKey !== secretHash) {
    logger.warn({ apiKey: apiKey.substring(0, 8) + '...' }, 'Invalid API key attempt');
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  // Extract user ID from API key (in production, look up from database)
  req.userId = 'api-user-' + crypto.createHash('md5').update(apiKey).digest('hex').substring(0, 8);
  
  next();
};

// Optional: JWT authentication for web clients
export const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  
  // TODO: Implement JWT verification
  // For now, just extract a mock user ID
  req.userId = 'jwt-user-' + crypto.createHash('md5').update(token).digest('hex').substring(0, 8);
  
  next();
};

// Flexible authentication - accepts either API key or JWT
export const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const token = req.headers.authorization;
  
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  } else if (token) {
    return authenticateJWT(req, res, next);
  } else {
    return res.status(401).json({ error: 'Authentication required' });
  }
};