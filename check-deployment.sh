#!/bin/bash
echo "Checking deployment status..."

# Check if favicon link is in the HTML (indicates new version)
if curl -s "https://expert-contacts-service-efikrlpu3q-uc.a.run.app/" | grep -q "link rel=\"icon\""; then
    echo "✅ New version is deployed (favicon link found)"
else
    echo "❌ Old version still active (no favicon link)"
fi

# Get latest revision
LATEST_REV=$(/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud run services describe expert-contacts-service --region us-central1 --format="value(status.latestReadyRevisionName)")
echo "Current revision: $LATEST_REV"

# Get revision creation time
REV_TIME=$(/Users/yonatanloewidt/google-cloud-sdk/bin/gcloud run revisions describe $LATEST_REV --region us-central1 --format="value(metadata.creationTimestamp)")
echo "Created at: $REV_TIME"