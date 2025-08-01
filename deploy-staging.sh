#!/bin/bash
# Deployment script for Staging Environment
# Service URL: https://expert-contacts-staging-*.run.app

set -e

echo "🚀 Starting deployment to STAGING environment..."
echo "📍 Target: expert-contacts-staging"

# Build locally first
echo "📦 Building application..."
npm run build

# Deploy to staging (using dev database for now, should have separate staging DB in future)
echo "☁️  Deploying to Cloud Run (STAGING)..."
/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud run deploy expert-contacts-staging \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances ideasgenerator:us-central1:expert-contacts-dev \
  --set-env-vars USE_PUBLIC_IP=true,CLOUD_SQL_CONNECTION_NAME=ideasgenerator:us-central1:expert-contacts-dev,DB_HOST=34.121.141.137,DB_NAME=expert_contacts,DB_USER=app_user,DB_PORT=5432,GCP_PROJECT_ID=ideasgenerator,GCP_REGION=us-central1,WORKFLOW_NAME=expert-sourcing-dev,SEARCH_MODEL=o3,ENVIRONMENT=staging \
  --update-secrets DB_PASSWORD=expert-contacts-db-password-dev:latest \
  --update-secrets OPENAI_API_KEY=expert-contacts-openai-key-dev:latest \
  --timeout=10m

echo "✅ Deployment to STAGING complete!"
echo "🌐 Staging URL: https://expert-contacts-staging-efikrlpu3q-uc.a.run.app"
echo "⚠️  Note: Currently using development database. Consider creating separate staging resources."