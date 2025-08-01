# Expert Contacts Service - Environments

## Overview

This service has three distinct environments with clear naming conventions and separate resources.

## Environments

### 1. Development
- **Service Name**: `expert-contacts-dev`
- **URL**: https://expert-contacts-dev-efikrlpu3q-uc.a.run.app
- **Database**: `expert-contacts-dev` (34.121.141.137)
- **Workflow**: `expert-sourcing-dev`
- **Deployment**: `./deploy-dev.sh`
- **Purpose**: Active development and testing

### 2. Staging
- **Service Name**: `expert-contacts-staging`
- **URL**: https://expert-contacts-staging-efikrlpu3q-uc.a.run.app
- **Database**: Currently shares dev database (should be separated)
- **Workflow**: `expert-sourcing-dev` (should have staging workflow)
- **Deployment**: `./deploy-staging.sh`
- **Purpose**: Pre-production testing and QA

### 3. Production
- **Service Name**: `expert-contacts-prod`
- **URL**: https://expert-contacts-prod-efikrlpu3q-uc.a.run.app
- **Database**: `expert-contacts-prod` (34.63.118.13)
- **Workflow**: `expert-sourcing-workflow`
- **Deployment**: `./deploy-prod.sh`
- **Purpose**: Live production environment

## Deployment Commands

```bash
# Deploy to specific environments
./deploy-dev.sh      # Deploy to development
./deploy-staging.sh  # Deploy to staging
./deploy-prod.sh     # Deploy to production (requires confirmation)

# Default deployment (goes to development)
./deploy.sh
```

## Environment Variables

Each environment has its own configuration:
- `ENVIRONMENT`: Set to 'development', 'staging', or 'production'
- `DB_HOST`: Points to the appropriate database
- `WORKFLOW_NAME`: Uses the correct workflow for the environment
- Secrets are environment-specific (e.g., `expert-contacts-db-password-dev` vs `expert-contacts-db-password-prod`)

## Legacy Services (Removed)

The following services have been removed to clean up the infrastructure:
- `expert-contacts-api-dev` - Old development service
- `expert-contacts-service` - Generic named service (replaced with environment-specific names)

## Cloud Functions

The following Cloud Functions support the expert sourcing workflow:
- `sourceexperts-development-expert-contacts`
- `findexpertsfortype-development-expert-contacts`
- `expertsourcingwebhook-development-expert-contacts`

These are deployed as Cloud Run services and are part of the development workflow infrastructure.