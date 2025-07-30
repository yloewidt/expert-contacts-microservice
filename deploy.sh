#!/bin/bash
# Fast deployment script for Expert Contacts Service
# Uses source-based deployment for speed

set -e

echo "🚀 Starting fast deployment (source-based)..."

# Build locally first
echo "📦 Building application..."
npm run build

# Deploy directly from source (Cloud Build)
echo "☁️  Deploying to Cloud Run (this builds in the cloud)..."
/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud run deploy expert-contacts-service \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances ideasgenerator:us-central1:expert-contacts-dev \
  --set-env-vars USE_PUBLIC_IP=true,CLOUD_SQL_CONNECTION_NAME=ideasgenerator:us-central1:expert-contacts-dev,DB_NAME=expert_contacts,DB_USER=app_user,GCP_PROJECT_ID=ideasgenerator,GCP_REGION=us-central1,WORKFLOW_NAME=expert-sourcing-dev \
  --update-secrets DB_PASSWORD=expert-contacts-db-password-dev:latest \
  --update-secrets OPENAI_API_KEY=expert-contacts-openai-key-dev:latest \
  --timeout=10m

echo "✅ Deployment complete!"
echo "🌐 Service URL: https://expert-contacts-service-1045570267679.us-central1.run.app/"