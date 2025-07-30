#!/bin/bash

echo "Testing o3 search endpoint directly..."

curl -X POST https://expert-contacts-service-efikrlpu3q-uc.a.run.app/internal/search-experts \
  -H "Content-Type: application/json" \
  -d '{
    "search_prompt": "Find one expert in AI. Return JSON with candidates array."
  }' | jq