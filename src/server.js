import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import dotenv from 'dotenv';

import Database from './database/index.js';
import ExpertSourcingService from './services/expertSourcingService.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { schemas, validate, validateParams } from './utils/validation.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

class ExpertContactsServer {
  constructor() {
    this.app = express();
    this.db = null;
    this.expertService = null;
    this.port = process.env.PORT || 3600;
  }

  async init() {
    try {
      // Initialize database
      this.db = new Database();
      await this.db.init();
      
      // Initialize services
      this.expertService = new ExpertSourcingService(this.db);
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Error handling
      this.app.use(notFound);
      this.app.use(errorHandler);
      
      logger.info('Server initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize server');
      throw error;
    }
  }

  setupMiddleware() {
    // Security headers
    this.app.use(helmet());
    
    // CORS
    const corsOptions = {
      origin: process.env.CORS_ORIGINS?.split(',') || '*',
      credentials: true
    };
    this.app.use(cors(corsOptions));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);
    
    // Request logging
    this.app.use(pinoHttp({ logger }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Health check (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'expert-contacts-microservice',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });
  }

  setupRoutes() {
    const router = express.Router();
    
    // All routes require authentication
    router.use(authenticate);
    
    // Expert sourcing endpoints
    router.post('/experts/source', 
      validate(schemas.sourceExperts),
      this.handleSourceExperts.bind(this)
    );
    
    router.get('/experts/search',
      validate(schemas.searchExperts),
      this.handleSearchExperts.bind(this)
    );
    
    router.get('/experts/:id',
      validateParams(schemas.idParam),
      this.handleGetExpert.bind(this)
    );
    
    // Expert request endpoints
    router.get('/requests',
      this.handleGetRequests.bind(this)
    );
    
    router.get('/requests/:id',
      validateParams(schemas.idParam),
      this.handleGetRequest.bind(this)
    );
    
    router.post('/requests/:requestId/experts/:expertId/contact',
      validate(schemas.updateContactStatus),
      this.handleUpdateContactStatus.bind(this)
    );
    
    // Mount router
    this.app.use('/api/v1', router);
  }

  // Route handlers
  async handleSourceExperts(req, res, next) {
    try {
      const { projectDescription } = req.body;
      const userId = req.body.userId || req.userId;
      
      const result = await this.expertService.sourceExperts(userId, projectDescription);
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async handleSearchExperts(req, res, next) {
    try {
      const { query, ...filters } = req.query;
      
      const experts = await this.expertService.searchExperts(query, filters);
      
      res.json({
        success: true,
        data: experts,
        count: experts.length
      });
    } catch (error) {
      next(error);
    }
  }

  async handleGetExpert(req, res, next) {
    try {
      const expert = await this.expertService.getExpertById(req.params.id);
      
      if (!expert) {
        return res.status(404).json({
          error: 'Expert not found'
        });
      }
      
      res.json({
        success: true,
        data: expert
      });
    } catch (error) {
      next(error);
    }
  }

  async handleGetRequests(req, res, next) {
    try {
      const requests = await this.expertService.getUserRequests(req.userId);
      
      res.json({
        success: true,
        data: requests,
        count: requests.length
      });
    } catch (error) {
      next(error);
    }
  }

  async handleGetRequest(req, res, next) {
    try {
      const request = await this.expertService.getSourcingRequest(req.params.id);
      
      if (!request) {
        return res.status(404).json({
          error: 'Request not found'
        });
      }
      
      // Verify user owns this request
      if (request.user_id !== req.userId) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }
      
      res.json({
        success: true,
        data: request
      });
    } catch (error) {
      next(error);
    }
  }

  async handleUpdateContactStatus(req, res, next) {
    try {
      const { requestId, expertId } = req.params;
      const { status, notes } = req.body;
      
      // Verify user owns this request
      const request = await this.expertService.getSourcingRequest(requestId);
      if (!request || request.user_id !== req.userId) {
        return res.status(403).json({
          error: 'Access denied'
        });
      }
      
      await this.expertService.updateExpertContactStatus(
        requestId, 
        expertId, 
        status, 
        notes
      );
      
      res.json({
        success: true,
        message: 'Contact status updated'
      });
    } catch (error) {
      next(error);
    }
  }

  async start() {
    await this.init();
    
    this.server = this.app.listen(this.port, () => {
      logger.info({ port: this.port }, 'Server started');
    });
    
    // Graceful shutdown
    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGINT', this.shutdown.bind(this));
  }

  async shutdown() {
    logger.info('Shutting down server...');
    
    if (this.server) {
      this.server.close(() => {
        logger.info('HTTP server closed');
      });
    }
    
    if (this.db) {
      await this.db.close();
      logger.info('Database connection closed');
    }
    
    process.exit(0);
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ExpertContactsServer();
  server.start().catch(error => {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  });
}

export default ExpertContactsServer;