#!/bin/bash
# Database setup script for Expert Contacts

set -e

echo "🗄️  Setting up Expert Contacts database..."

# Configuration
INSTANCE_NAME="expert-contacts-prod"
DB_NAME="expert_contacts"
DB_USER="postgres"
DB_PASSWORD="ExpertC0ntacts2025!"
PROJECT_ID="ideasgenerator"

# Wait for instance to be ready
echo "⏳ Waiting for Cloud SQL instance to be ready..."
while [ "$(/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud sql instances describe $INSTANCE_NAME --format='value(state)')" != "RUNNABLE" ]; do
  echo -n "."
  sleep 5
done
echo " Ready!"

# Get instance IP
INSTANCE_IP=$(/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud sql instances describe $INSTANCE_NAME --format='value(ipAddresses[0].ipAddress)')
echo "📍 Instance IP: $INSTANCE_IP"

# Set postgres password
echo "🔐 Setting postgres password..."
/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud sql users set-password postgres \
  --instance=$INSTANCE_NAME \
  --password="$DB_PASSWORD"

# Create database
echo "📦 Creating database..."
/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud sql databases create $DB_NAME \
  --instance=$INSTANCE_NAME || echo "Database might already exist"

# Create secret for password
echo "🔒 Creating secret for database password..."
echo -n "$DB_PASSWORD" | /Users/yonatanloewidt/google-cloud-sdk/bin/gcloud secrets create expert-contacts-db-password \
  --data-file=- || echo "Secret might already exist"

# Allow Cloud Run to access secret
echo "🔓 Granting secret access..."
/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud secrets add-iam-policy-binding expert-contacts-db-password \
  --member="serviceAccount:1045570267679-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" || true

# Whitelist current IP for direct access
echo "🌐 Whitelisting current IP..."
CURRENT_IP=$(curl -s https://api.ipify.org)
/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud sql instances patch $INSTANCE_NAME \
  --authorized-networks=$CURRENT_IP/32 \
  --quiet

# Run migrations
echo "🚀 Running migrations..."
PGPASSWORD="$DB_PASSWORD" psql -h $INSTANCE_IP -U $DB_USER -d $DB_NAME -f migrations/001_initial_schema.sql

# Seed test data
echo "🌱 Seeding test data..."
PGPASSWORD="$DB_PASSWORD" psql -h $INSTANCE_IP -U $DB_USER -d $DB_NAME -f seed-test-data.sql

echo "✅ Database setup complete!"
echo ""
echo "Connection details:"
echo "  Host: $INSTANCE_IP"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Instance Connection Name: $PROJECT_ID:us-central1:$INSTANCE_NAME"