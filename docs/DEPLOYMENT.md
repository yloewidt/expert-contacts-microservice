# Deployment Guide

## Prerequisites

- Node.js 18+ installed
- Docker (for containerized deployment)
- OpenAI API key
- Git

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key
API_KEY_SECRET=your_secure_secret_key

# Optional (with defaults)
PORT=3600
DATABASE_PATH=./expert_contacts.db
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGINS=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Deployment Options

### Option 1: Direct Node.js Deployment

1. Clone the repository:
```bash
git clone https://github.com/yourusername/expert-contacts-microservice.git
cd expert-contacts-microservice
```

2. Install dependencies:
```bash
npm install --production
```

3. Set up environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the service:
```bash
npm start
```

5. (Optional) Use PM2 for process management:
```bash
npm install -g pm2
pm2 start src/server.js --name expert-contacts
pm2 save
pm2 startup
```

### Option 2: Docker Deployment

1. Build the image:
```bash
docker build -t expert-contacts-microservice .
```

2. Run with Docker:
```bash
docker run -d \
  --name expert-contacts \
  -p 3600:3600 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  expert-contacts-microservice
```

3. Or use Docker Compose:
```bash
docker-compose up -d
```

### Option 3: Kubernetes Deployment

1. Create ConfigMap for environment variables:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: expert-contacts-config
data:
  NODE_ENV: "production"
  PORT: "3600"
  LOG_LEVEL: "info"
```

2. Create Secret for sensitive data:
```bash
kubectl create secret generic expert-contacts-secrets \
  --from-literal=OPENAI_API_KEY=your_key \
  --from-literal=API_KEY_SECRET=your_secret
```

3. Apply deployment:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: expert-contacts
spec:
  replicas: 3
  selector:
    matchLabels:
      app: expert-contacts
  template:
    metadata:
      labels:
        app: expert-contacts
    spec:
      containers:
      - name: expert-contacts
        image: expert-contacts-microservice:latest
        ports:
        - containerPort: 3600
        envFrom:
        - configMapRef:
            name: expert-contacts-config
        - secretRef:
            name: expert-contacts-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 3600
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3600
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Cloud Provider Deployments

### AWS ECS

1. Build and push to ECR:
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URI
docker build -t expert-contacts .
docker tag expert-contacts:latest $ECR_URI/expert-contacts:latest
docker push $ECR_URI/expert-contacts:latest
```

2. Create task definition with environment variables
3. Create ECS service with ALB

### Google Cloud Run

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT_ID/expert-contacts

# Deploy to Cloud Run
gcloud run deploy expert-contacts \
  --image gcr.io/PROJECT_ID/expert-contacts \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="OPENAI_API_KEY=openai-key:latest,API_KEY_SECRET=api-secret:latest"
```

### Azure Container Instances

```bash
# Create container instance
az container create \
  --resource-group myResourceGroup \
  --name expert-contacts \
  --image expert-contacts-microservice:latest \
  --dns-name-label expert-contacts \
  --ports 3600 \
  --environment-variables NODE_ENV=production \
  --secure-environment-variables OPENAI_API_KEY=$OPENAI_API_KEY
```

## Database Considerations

### SQLite (Default)
- Good for: Development, small deployments
- Limitations: Single file, no concurrent writes
- Backup: Copy the `.db` file regularly

### PostgreSQL (Recommended for Production)
1. Update database connection in code
2. Use connection pooling
3. Set up regular backups
4. Consider read replicas for scaling

### Migration to PostgreSQL

```sql
-- Create tables in PostgreSQL
-- Same schema as SQLite but with PostgreSQL types
CREATE TABLE experts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  linkedin_url TEXT UNIQUE,
  -- ... rest of schema
);
```

## Monitoring

### Health Checks
- Endpoint: `/health`
- Check every 30 seconds
- Alert if unhealthy for 2+ checks

### Metrics to Monitor
- Response times
- Error rates
- OpenAI API usage
- Database size
- Memory usage

### Logging
- Structured JSON logs with Pino
- Log aggregation with ELK or CloudWatch
- Set appropriate log levels per environment

## Security Checklist

- [ ] Use HTTPS in production
- [ ] Secure API keys in environment/secrets
- [ ] Enable CORS for specific domains only
- [ ] Implement request signing for extra security
- [ ] Regular security updates
- [ ] Database backups encrypted at rest
- [ ] Network isolation for database
- [ ] Rate limiting configured appropriately

## Performance Optimization

1. **Caching**
   - Cache expert search results
   - Cache OpenAI responses where appropriate
   - Use Redis for distributed caching

2. **Database**
   - Add indexes for common queries
   - Regular VACUUM for SQLite
   - Connection pooling for PostgreSQL

3. **API**
   - Implement pagination
   - Use compression (gzip)
   - CDN for static assets

## Troubleshooting

### Common Issues

1. **OpenAI API Errors**
   - Check API key is valid
   - Monitor rate limits
   - Check OpenAI service status

2. **Database Locked (SQLite)**
   - Reduce concurrent writes
   - Consider PostgreSQL for production

3. **High Memory Usage**
   - Check for memory leaks
   - Limit concurrent requests
   - Increase container memory

### Debug Mode

```bash
LOG_LEVEL=debug npm start
```

## Rollback Strategy

1. Keep previous Docker images tagged
2. Database migrations should be reversible
3. Blue-green deployment for zero downtime
4. Feature flags for gradual rollout