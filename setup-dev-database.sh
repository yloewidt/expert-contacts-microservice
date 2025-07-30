#!/bin/bash
# Database setup script for Expert Contacts Dev

set -e

echo "🗄️  Setting up Expert Contacts DEV database..."

# Configuration
INSTANCE_NAME="expert-contacts-dev"
DB_NAME="expert_contacts"
DB_USER="postgres"
PROJECT_ID="ideasgenerator"

# Get instance IP
INSTANCE_IP=$(/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud sql instances describe $INSTANCE_NAME --format='value(ipAddresses[0].ipAddress)')
echo "📍 Instance IP: $INSTANCE_IP"

# Get the password from secret manager
echo "🔐 Getting database password from secret manager..."
DB_PASSWORD=$(/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud secrets versions access latest --secret="expert-contacts-db-password-dev")

# Run migrations
echo "🚀 Running migrations..."
PGPASSWORD="$DB_PASSWORD" psql -h $INSTANCE_IP -U $DB_USER -d $DB_NAME -f migrations/001_initial_schema.sql

echo "✅ Database setup complete!"
echo ""
echo "Connection details:"
echo "  Host: $INSTANCE_IP"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Instance Connection Name: $PROJECT_ID:us-central1:$INSTANCE_NAME"