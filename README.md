# Expert Contacts Microservice

An AI-powered expert discovery microservice that leverages LLMs to identify and recommend domain experts for specific business needs.

## Features

- **AI-Powered Discovery**: Uses GPT-4o and o3 models for intelligent expert identification
- **Real Professional Profiles**: Provides verified LinkedIn URLs and contact information
- **Relevance Scoring**: Multi-dimensional matching based on skills, experience, and domain expertise
- **Scalable Architecture**: Built on Google Cloud Platform with serverless components
- **Asynchronous Processing**: Handles long-running searches efficiently

## Architecture

The microservice is built using:
- **Node.js/TypeScript**: Core application
- **Cloud Run**: Serverless container hosting
- **Cloud SQL (PostgreSQL)**: Data persistence
- **Cloud Tasks**: Asynchronous job processing
- **Cloud Workflows**: Multi-step orchestration
- **OpenAI API**: LLM capabilities

## API Endpoints

### POST /api/v1/source
Initiates an expert discovery request.

**Request:**
```json
{
  "project_description": "Need blockchain expert for DeFi protocol audit"
}
```

**Response:**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "message": "Expert sourcing initiated. Check status using GET /api/v1/source/{request_id}"
}
```

### GET /api/v1/source/:id
Retrieves the status and results of a sourcing request.

**Response (when completed):**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "experts": [
    {
      "id": "uuid",
      "name": "Expert Name",
      "title": "Current Professional Title",
      "company": "Current Company",
      "linkedin_url": "https://linkedin.com/in/profile",
      "email": "email@domain.com",
      "relevance_score": 0.95,
      "matching_reasons": [
        "10+ years in domain X",
        "Published research on topic Y"
      ],
      "personalised_message": "Personalized outreach message"
    }
  ],
  "metadata": {
    "created_at": "2024-01-01T00:00:00Z",
    "processing_time_seconds": 8.5
  }
}
```

## Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd expert-contacts-microservice
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   # Run migrations
   psql -U postgres -d expert_contacts -f migrations/001_initial_schema.sql
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

## Testing

Run the test suite:
```bash
npm test
```

Run with coverage:
```bash
npm test -- --coverage
```

## Deployment

### Using Terraform

1. **Initialize Terraform**
   ```bash
   cd terraform
   terraform init
   ```

2. **Create workspace for your environment**
   ```bash
   terraform workspace new dev
   ```

3. **Apply infrastructure**
   ```bash
   terraform apply -var="project_id=your-project-id" -var="environment=dev"
   ```

### Manual Deployment

1. **Build Docker image**
   ```bash
   docker build -t expert-contacts .
   ```

2. **Push to Artifact Registry**
   ```bash
   docker tag expert-contacts:latest REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/expert-contacts:latest
   docker push REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/expert-contacts:latest
   ```

3. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy expert-contacts-api \
     --image REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/expert-contacts:latest \
     --region REGION
   ```

## Environment Variables

- `NODE_ENV`: Environment (development/staging/production)
- `PORT`: Server port (default: 8080)
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `OPENAI_API_KEY`: OpenAI API key
- `GCP_PROJECT_ID`: Google Cloud project ID
- `GCP_REGION`: Google Cloud region
- `CLOUD_SQL_CONNECTION_NAME`: Cloud SQL instance connection name

## License

ISC