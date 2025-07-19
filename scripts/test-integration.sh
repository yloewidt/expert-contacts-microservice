#!/bin/bash

# Expert Contacts Microservice Integration Test Script
# This script runs a complete integration test of the microservice

set -e  # Exit on error

echo "🚀 Expert Contacts Microservice Integration Test"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:3600"
API_KEY="test-secret"
UI_URL="http://localhost:3601"

# Function to check if a port is in use
check_port() {
    lsof -i:$1 > /dev/null 2>&1
}

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        exit 1
    fi
}

# Function to make API call
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth=$4
    
    if [ "$auth" = "true" ]; then
        if [ "$method" = "GET" ]; then
            curl -s -X GET -H "X-API-Key: $API_KEY" "$API_URL$endpoint"
        else
            curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" -d "$data" "$API_URL$endpoint"
        fi
    else
        curl -s -X GET "$API_URL$endpoint"
    fi
}

echo -e "\n${YELLOW}1. Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed${NC}"
    exit 1
fi
print_status 0 "Node.js installed"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed${NC}"
    exit 1
fi
print_status 0 "npm installed"

echo -e "\n${YELLOW}2. Setting up test environment...${NC}"

# Kill any existing processes on our ports
if check_port 3600; then
    echo "Killing existing process on port 3600..."
    lsof -ti:3600 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

if check_port 3601; then
    echo "Killing existing process on port 3601..."
    lsof -ti:3601 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
print_status 0 "Dependencies installed"

echo -e "\n${YELLOW}3. Starting microservice...${NC}"

# Start the microservice
export CORS_ORIGINS="http://localhost:3601,http://localhost:3600,http://localhost:3000"
export API_KEY_SECRET="test-secret"
export NODE_ENV="test"
export DATABASE_PATH=":memory:"
export LOG_LEVEL="error"

npm start > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

# Check if server is running
if ! check_port 3600; then
    echo -e "${RED}Server failed to start${NC}"
    cat server.log
    exit 1
fi
print_status 0 "Microservice started on port 3600 (PID: $SERVER_PID)"

echo -e "\n${YELLOW}4. Running API tests...${NC}"

# Test 1: Health check
echo -n "Testing health endpoint... "
HEALTH_RESPONSE=$(api_call GET /health "" false)
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    print_status 0 "Health check passed"
else
    print_status 1 "Health check failed"
fi

# Test 2: Authentication - No API key
echo -n "Testing authentication (no API key)... "
NO_AUTH_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/experts/search")
if echo "$NO_AUTH_RESPONSE" | grep -q "Authentication required"; then
    print_status 0 "Authentication check passed"
else
    print_status 1 "Authentication check failed"
fi

# Test 3: Authentication - Invalid API key
echo -n "Testing authentication (invalid API key)... "
INVALID_AUTH_RESPONSE=$(curl -s -X GET -H "X-API-Key: invalid-key" "$API_URL/api/v1/experts/search")
if echo "$INVALID_AUTH_RESPONSE" | grep -q "Invalid API key"; then
    print_status 0 "Invalid API key check passed"
else
    print_status 1 "Invalid API key check failed"
fi

# Test 4: Search experts (empty database)
echo -n "Testing expert search... "
SEARCH_RESPONSE=$(api_call GET "/api/v1/experts/search?query=test" "" true)
if echo "$SEARCH_RESPONSE" | grep -q "success"; then
    print_status 0 "Expert search passed"
else
    print_status 1 "Expert search failed"
fi

# Test 5: Get non-existent expert
echo -n "Testing get non-existent expert... "
EXPERT_RESPONSE=$(curl -s -X GET -H "X-API-Key: $API_KEY" "$API_URL/api/v1/experts/999")
if echo "$EXPERT_RESPONSE" | grep -q "Expert not found"; then
    print_status 0 "Non-existent expert check passed"
else
    print_status 1 "Non-existent expert check failed"
fi

# Test 6: Get user requests
echo -n "Testing get user requests... "
REQUESTS_RESPONSE=$(api_call GET "/api/v1/requests" "" true)
if echo "$REQUESTS_RESPONSE" | grep -q "success"; then
    print_status 0 "Get requests passed"
else
    print_status 1 "Get requests failed"
fi

# Test 7: Validation - Invalid project description
echo -n "Testing validation... "
VALIDATION_RESPONSE=$(api_call POST "/api/v1/experts/source" '{"projectDescription":"Short"}' true)
if echo "$VALIDATION_RESPONSE" | grep -q "Validation error"; then
    print_status 0 "Validation check passed"
else
    print_status 1 "Validation check failed"
fi

echo -e "\n${YELLOW}5. Starting UI test server...${NC}"

# Start UI server
node scripts/test-ui-server.js > ui-server.log 2>&1 &
UI_PID=$!

# Wait for UI server to start
sleep 2

if ! check_port 3601; then
    echo -e "${RED}UI server failed to start${NC}"
    exit 1
fi
print_status 0 "UI test server started on port 3601 (PID: $UI_PID)"

echo -e "\n${YELLOW}6. Running unit tests...${NC}"

# Run unit tests
if npm test; then
    print_status 0 "Unit tests passed"
else
    print_status 1 "Unit tests failed"
fi

echo -e "\n${YELLOW}7. Cleanup...${NC}"

# Kill servers
kill $SERVER_PID 2>/dev/null || true
kill $UI_PID 2>/dev/null || true

print_status 0 "Servers stopped"

echo -e "\n${GREEN}✅ All integration tests passed!${NC}"
echo -e "\n📚 To run the microservice:"
echo "   npm start"
echo -e "\n🧪 To run the test UI:"
echo "   1. Start the microservice: npm start"
echo "   2. Start the UI server: node scripts/test-ui-server.js"
echo "   3. Open: http://localhost:3601"
echo -e "\n🔧 To run Puppeteer E2E tests:"
echo "   npm run test:e2e"
echo -e "\n📖 API Documentation:"
echo "   See docs/API.md"