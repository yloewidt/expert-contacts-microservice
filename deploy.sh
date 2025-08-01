#!/bin/bash
# Default deployment script - deploys to DEVELOPMENT
# For specific environments use: deploy-dev.sh, deploy-staging.sh, deploy-prod.sh

echo "⚠️  This script deploys to DEVELOPMENT by default"
echo "   For other environments use:"
echo "   - ./deploy-dev.sh      for development"
echo "   - ./deploy-staging.sh  for staging"
echo "   - ./deploy-prod.sh     for production"
echo ""

# Run development deployment
./deploy-dev.sh