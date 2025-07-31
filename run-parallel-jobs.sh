#!/bin/bash

API_URL="https://expert-contacts-service-efikrlpu3q-uc.a.run.app/api/v1/source"

# Job descriptions
JOBS=(
  "Building a real-time collaborative code editor with AI-powered pair programming features, syntax highlighting, and multi-language support"
  "Developing a blockchain-based supply chain tracking system for pharmaceutical companies to ensure drug authenticity and prevent counterfeiting"
  "Creating an AI-powered medical diagnosis assistant that uses computer vision to analyze X-rays and MRI scans for early disease detection"
  "Building a quantum computing simulation platform for educational purposes with visual circuit builders and algorithm tutorials"
  "Developing a sustainable energy management system that uses IoT sensors and machine learning to optimize power consumption in smart buildings"
)

echo "Starting ${#JOBS[@]} jobs in parallel..."

# Run all jobs in parallel
for i in "${!JOBS[@]}"; do
  {
    echo "Starting job $((i+1)): ${JOBS[$i]:0:50}..."
    RESPONSE=$(curl -s -X POST "$API_URL" \
      -H "Content-Type: application/json" \
      -d "{\"project_description\": \"${JOBS[$i]}\"}")
    
    REQUEST_ID=$(echo "$RESPONSE" | jq -r '.request_id')
    echo "Job $((i+1)) started with ID: $REQUEST_ID"
  } &
done

# Wait for all background jobs to complete
wait

echo "All jobs submitted successfully!"