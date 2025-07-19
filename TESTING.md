# Testing Guide for Expert Contacts Microservice

This guide provides comprehensive instructions for testing the Expert Contacts Microservice.

## 🚀 Quick Start Testing

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yloewidt/expert-contacts-microservice.git
cd expert-contacts-microservice

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your OpenAI API key (optional for basic testing)
```

### 2. Run Integration Tests

The fastest way to verify everything works:

```bash
./scripts/test-integration.sh
```

This script will:
- ✅ Check prerequisites
- ✅ Start the microservice
- ✅ Run API tests
- ✅ Run unit tests
- ✅ Verify all endpoints

## 🧪 Testing Methods

### Method 1: Manual UI Testing

1. **Start the microservice:**
   ```bash
   npm start
   ```

2. **Start the UI test server:**
   ```bash
   node scripts/test-ui-server.js
   ```

3. **Open the test UI:**
   Navigate to http://localhost:3601 in your browser

4. **Test features:**
   - Health Check: Verify service is running
   - Search Experts: Test with various queries
   - Source Experts: Submit project descriptions (requires OpenAI API key)
   - My Requests: View sourcing history

### Method 2: Automated Testing

#### Unit Tests
```bash
# Run unit tests only
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

#### E2E Tests with Puppeteer
```bash
# Run headless (default)
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed

# Run all tests (unit + E2E)
npm run test:all
```

### Method 3: API Testing with cURL

```bash
# 1. Health check (no auth required)
curl http://localhost:3600/health

# 2. Search experts (requires API key)
curl -H "X-API-Key: test-secret" \
  http://localhost:3600/api/v1/experts/search

# 3. Source experts (requires API key + OpenAI key in env)
curl -X POST -H "X-API-Key: test-secret" \
  -H "Content-Type: application/json" \
  -d '{"projectDescription": "AI healthcare platform"}' \
  http://localhost:3600/api/v1/experts/source

# 4. Test authentication failure
curl http://localhost:3600/api/v1/experts/search
# Should return: {"error":"Authentication required"}
```

## 📋 Test Coverage

### API Endpoints Tested

| Endpoint | Method | Test Coverage |
|----------|--------|---------------|
| `/health` | GET | ✅ Health status |
| `/api/v1/experts/source` | POST | ✅ Validation, Authentication, OpenAI integration |
| `/api/v1/experts/search` | GET | ✅ Query params, Filtering, Authentication |
| `/api/v1/experts/:id` | GET | ✅ 404 handling, Authentication |
| `/api/v1/requests` | GET | ✅ User isolation, Authentication |
| `/api/v1/requests/:id` | GET | ✅ Access control, 404 handling |
| `/api/v1/requests/:id/experts/:id/contact` | POST | ✅ Status updates, Validation |

### Security Tests

- ✅ API key authentication
- ✅ Invalid API key rejection
- ✅ Missing API key handling
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Input validation

## 🐛 Troubleshooting

### Common Issues

1. **"Failed to fetch" error in UI**
   - Ensure microservice is running on port 3600
   - Check CORS settings include http://localhost:3601

2. **"Invalid API key" error**
   - Default test API key is: `test-secret`
   - Ensure API_KEY_SECRET in .env matches

3. **Expert sourcing fails**
   - Requires valid OPENAI_API_KEY in .env
   - Check OpenAI API quota/billing

4. **Port already in use**
   ```bash
   # Kill process on port 3600
   lsof -ti:3600 | xargs kill -9
   ```

### Debug Mode

Enable detailed logging:
```bash
LOG_LEVEL=debug npm start
```

## 🔧 Advanced Testing

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Create load test config
cat > load-test.yml << EOF
config:
  target: "http://localhost:3600"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Health Check"
    flow:
      - get:
          url: "/health"
EOF

# Run load test
artillery run load-test.yml
```

### Docker Testing

```bash
# Build image
docker build -t expert-contacts-microservice .

# Run container
docker run -p 3600:3600 \
  -e API_KEY_SECRET=test-secret \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  expert-contacts-microservice

# Test
curl http://localhost:3600/health
```

## 📊 Test Reports

After running tests, find reports in:
- Coverage report: `coverage/lcov-report/index.html`
- Test logs: `server.log`, `ui-server.log`

## 🎯 Next Steps

1. **Add more experts to database:**
   Use the sourcing endpoint with various project descriptions

2. **Test with real OpenAI API:**
   Set OPENAI_API_KEY in .env for full functionality

3. **Performance testing:**
   Monitor response times under load

4. **Security testing:**
   Try SQL injection, XSS attempts (should all fail)

## 📚 Additional Resources

- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [GitHub Repository](https://github.com/yloewidt/expert-contacts-microservice)