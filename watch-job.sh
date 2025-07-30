#!/bin/bash
# Watch job status script

JOB_ID="${1:-440fc35e-cbe2-4f89-bd4a-06ed498fe2c0}"
API_URL="https://expert-contacts-service-efikrlpu3q-uc.a.run.app/api/v1/source"

echo "Watching job: $JOB_ID"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    # Clear the screen
    clear
    
    # Get current timestamp
    echo "Time: $(date)"
    echo "Job ID: $JOB_ID"
    echo "-----------------------------------"
    
    # Fetch and display job status
    curl -s "$API_URL/$JOB_ID" | jq '{
        status: .status,
        created_at: .metadata.created_at,
        processing_time: .metadata.processing_time_seconds,
        experts_found: (.experts | length),
        has_raw_outputs: (if .raw_outputs then true else false end)
    }'
    
    # Wait 5 seconds before next check
    sleep 5
done