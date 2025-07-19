# Expert Contacts Microservice

A standalone microservice for sourcing and managing domain experts using AI-powered discovery.

## Features

- **AI-Powered Expert Discovery**: Uses OpenAI's o3 model with web search to find real experts
- **Expert Scoring & Ranking**: Intelligent relevance scoring based on project requirements
- **Personalized Outreach**: Generates customized LinkedIn messages for each expert
- **RESTful API**: Clean API design with comprehensive validation
- **Secure**: API key authentication with rate limiting
- **Production-Ready**: Docker support, health checks, and CI/CD pipelines

## Tech Stack

- Node.js 20+ with ES modules
- Express.js
- SQLite (easily replaceable with PostgreSQL)
- OpenAI API (GPT-4o and o3 models)
- Docker & Docker Compose
- Jest for testing

## Quick Start

### Prerequisites

- Node.js 18+ 
- OpenAI API key
- Docker (optional)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/expert-contacts-microservice.git
cd expert-contacts-microservice
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run the service:
```bash
npm start
```

### Using Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t expert-contacts-microservice .
docker run -p 3600:3600 --env-file .env expert-contacts-microservice
```

## API Documentation

### Authentication

All API endpoints require authentication via API key:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3600/api/v1/...
```

### Endpoints

#### Source Experts

```bash
POST /api/v1/experts/source
Content-Type: application/json

{
  "projectDescription": "AI-powered healthcare platform for remote patient monitoring..."
}
```

Response:
```json
{
  "success": true,
  "data": {
    "requestId": "123",
    "expertTypes": [...],
    "results": [...]
  }
}
```

#### Search Experts

```bash
GET /api/v1/experts/search?query=healthcare&minConfidence=7
```

#### Get Expert Details

```bash
GET /api/v1/experts/123
```

#### Get Sourcing Requests

```bash
GET /api/v1/requests
```

#### Update Contact Status

```bash
POST /api/v1/requests/123/experts/456/contact
Content-Type: application/json

{
  "status": "contacted",
  "notes": "Sent LinkedIn message"
}
```

## Configuration

Key environment variables:

- `PORT`: Server port (default: 3600)
- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `DATABASE_PATH`: SQLite database path
- `API_KEY_SECRET`: Secret for API key generation
- `CORS_ORIGINS`: Comma-separated allowed origins
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Development

```bash
# Run in development mode
npm run dev

# Lint code
npm run lint

# Format code
npm run format
```

## Production Deployment

### Health Check

The service exposes a health endpoint at `/health` that returns:

```json
{
  "status": "healthy",
  "service": "expert-contacts-microservice",
  "version": "1.0.0",
  "timestamp": "2023-..."
}
```

### Monitoring

- Structured logging with Pino
- Request/response logging
- Error tracking with stack traces

### Security

- Helmet.js for security headers
- Rate limiting per IP
- Input validation with Joi
- SQL injection prevention via parameterized queries

## Architecture

```
src/
├── server.js              # Main server entry point
├── database/             
│   ├── index.js          # Database connection & helpers
│   └── schema.sql        # Database schema
├── services/
│   └── expertSourcingService.js  # Core business logic
├── middleware/
│   ├── auth.js           # Authentication middleware
│   └── errorHandler.js   # Error handling
└── utils/
    ├── logger.js         # Logging configuration
    └── validation.js     # Request validation schemas
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details