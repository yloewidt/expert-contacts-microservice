import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import { logger } from './config/logger';
import apiRoutes from './api/routes';
import internalRoutes from './api/internalRoutes';
import jobsRoute from './api/jobsRoute';
import dbTestRoute from './api/dbTestRoute';
import adminRoute from './api/adminRoute';
import testDbRoute from './api/testDbRoute';
import debugRoute from './api/debugRoute';
import migrationRoute from './api/migrationRoute';
import simpleMigrationRoute from './api/simpleMigrationRoute';
import createLLMTableRoute from './api/createLLMTableRoute';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    headers: req.headers,
  }, 'Incoming request');
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve UI
app.use(express.static('dist/ui'));

// Root route for UI
app.get('/', (_req, res) => {
  res.sendFile('index.html', { root: 'dist/ui' });
});

// Routes
app.use('/', apiRoutes);
app.use('/', internalRoutes);
app.use('/', jobsRoute);
app.use('/', dbTestRoute);
app.use('/admin', adminRoute);
app.use('/test', testDbRoute);
app.use('/debug', debugRoute);
app.use('/migration', migrationRoute);
app.use('/fix', simpleMigrationRoute);
app.use('/fix', createLLMTableRoute);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ error: err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server started');
});