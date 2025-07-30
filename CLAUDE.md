# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product Specification

See [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) for the complete product specification, including:
- Detailed functional requirements and API specifications
- AI model prompts and workflows
- Database schema design
- GCP architecture and orchestration details

## Common Development Commands

### Building and Running
```bash
# Development mode with hot reload
npm run dev

# Build TypeScript and copy UI files
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run a single test file
npm test -- tests/path/to/test.test.ts
```

### Code Quality
```bash
# Lint TypeScript files
npm run lint

# Type checking
npm run typecheck
```

### Database Operations
```bash
# Run database migrations
npm run migrate

# Create a new migration
npm run migrate:create <migration-name>

# Initial database setup
psql -U postgres -d expert_contacts -f migrations/001_initial_schema.sql
```

### Deployment
```bash
# Deploy to Cloud Run (after building Docker image)
gcloud run deploy expert-contacts-api \
  --image REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/expert-contacts:latest \
  --region REGION

# Build Docker image
docker build -t expert-contacts .
```

## Architecture Overview

This is an AI-powered expert discovery microservice built on Google Cloud Platform with the following structure:

### Core Components

1. **Express API Server** (`src/index.ts`)
   - Main entry point with middleware setup (helmet, cors, express.json)
   - Serves both API endpoints and static UI files
   - Routes mounted at root level: apiRoutes, internalRoutes, jobsRoute

2. **Service Layer** (`src/services/`)
   - **OpenAIService** (`openai.ts`): Handles LLM interactions for expert type generation, search prompts, and expert discovery using GPT-4o and o3 models
   - **ExpertAggregatorService** (`expertAggregator.ts`): Deduplicates and scores expert matches
   - **CloudTasksService** (`cloudTasks.ts`): Manages asynchronous job processing
   - **CloudStorageService** (`cloudStorage.ts`): Handles raw output storage in GCS

3. **Data Layer**
   - **Database** model (`src/models/database.ts`): PostgreSQL interface using pg library with connection pooling
   - Schema includes: expert_sourcing_requests, experts, expert_request_matches, expert_sourcing_raw_outputs
   - Cloud SQL support with Unix socket connections

### Key API Endpoints

- `POST /api/v1/source`: Initiates expert discovery (validates with Joi, creates DB record, returns 202)
- `GET /api/v1/source/:id`: Retrieves sourcing request status and results with aggregated experts
- Additional routes for internal operations, debugging, and job management

### Technology Stack

- **Runtime**: Node.js with TypeScript (target ES2022)
- **Framework**: Express.js with strict TypeScript configuration
- **Database**: PostgreSQL via pg library
- **LLM Integration**: OpenAI API (GPT-4o and o3 models)
- **Validation**: Joi for request validation
- **Logging**: Pino with structured logging
- **Testing**: Jest with ts-jest preset
- **Build**: TypeScript compiler with UI file copying

### Important Configuration

- Environment variables required: DB_*, OPENAI_API_KEY, GCP_PROJECT_ID, etc.
- Strict TypeScript settings with no implicit any/returns
- ESLint configured with TypeScript rules
- Docker multi-stage build for production deployment
- Cloud SQL connections use Unix sockets when CLOUD_SQL_CONNECTION_NAME is set

## Workflow Processing

The expert sourcing workflow follows these steps:
1. Generate expert types using GPT-4o based on project description
2. Create search prompts for each expert type
3. Execute parallel searches using o3 model with web search enabled
4. Aggregate and deduplicate results based on LinkedIn URLs
5. Calculate final relevance scores and persist to database