#!/bin/bash
# Deployment script for Production Environment
# Service URL: https://expert-contacts-prod-*.run.app

set -e

echo "🚀 Starting deployment to PRODUCTION environment..."
echo "📍 Target: expert-contacts-prod"
echo "⚠️  WARNING: This will deploy to PRODUCTION!"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Build locally first
echo "📦 Building application..."
npm run build

# Deploy to production
echo "☁️  Deploying to Cloud Run (PRODUCTION)..."
/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud run deploy expert-contacts-prod \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances ideasgenerator:us-central1:expert-contacts-prod \
  --set-env-vars USE_PUBLIC_IP=true,CLOUD_SQL_CONNECTION_NAME=ideasgenerator:us-central1:expert-contacts-prod,DB_HOST=34.63.118.13,DB_NAME=expert_contacts,DB_USER=app_user,DB_PORT=5432,GCP_PROJECT_ID=ideasgenerator,GCP_REGION=us-central1,WORKFLOW_NAME=expert-sourcing-workflow,SEARCH_MODEL=o3,ENVIRONMENT=production \
  --update-secrets DB_PASSWORD=expert-contacts-db-password-prod:latest \
  --update-secrets OPENAI_API_KEY=expert-contacts-openai-key-prod:latest \
  --timeout=10m

echo "✅ Deployment to PRODUCTION complete!"
echo "🌐 Production URL: https://expert-contacts-prod-efikrlpu3q-uc.a.run.app"