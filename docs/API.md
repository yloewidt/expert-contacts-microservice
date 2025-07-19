# Expert Contacts Microservice API Documentation

## Overview

The Expert Contacts Microservice provides AI-powered expert discovery and management capabilities. It uses OpenAI's o3 model with web search to find real domain experts for project validation.

Base URL: `http://localhost:3600` (development)

## Authentication

All API endpoints (except `/health`) require authentication via API key.

### Headers

```
X-API-Key: your-api-key
```

### Example

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3600/api/v1/experts/search
```

## Endpoints

### Health Check

Check service health status.

**Endpoint:** `GET /health`  
**Authentication:** Not required  

**Response:**
```json
{
  "status": "healthy",
  "service": "expert-contacts-microservice",
  "version": "1.0.0",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

---

### Source Experts

Discover experts for a project using AI-powered search.

**Endpoint:** `POST /api/v1/experts/source`  
**Authentication:** Required  

**Request Body:**
```json
{
  "projectDescription": "Detailed description of your project (10-5000 characters)",
  "userId": "optional-user-id" // If not provided, uses authenticated user ID
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requestId": "123",
    "expertTypes": [
      {
        "type": "Healthcare AI Specialist",
        "description": "Expert in AI applications for healthcare",
        "importance": 9,
        "keywords": ["healthcare AI", "medical AI"],
        "skills": ["Machine Learning", "Healthcare Compliance"]
      }
    ],
    "results": [
      {
        "expertType": "Healthcare AI Specialist",
        "importance": 9,
        "experts": [
          {
            "name": "Dr. Jane Smith",
            "title": "VP of AI at HealthTech Inc",
            "company": "HealthTech Inc",
            "linkedinUrl": "https://linkedin.com/in/janesmith",
            "skills": ["AI", "Healthcare"],
            "proofLinks": ["https://example.com/paper"],
            "relevancyScore": 9,
            "likelihoodToRespond": 6,
            "combinedScore": 486,
            "linkedinMessage": "Personalized outreach message...",
            "whatToDiscuss": "• Specific discussion points...",
            "relevance": "Strong match due to..."
          }
        ]
      }
    ]
  }
}
```

**Validation:**
- `projectDescription`: Required, 10-5000 characters

**Error Responses:**
- `400`: Invalid project description
- `401`: Authentication required
- `500`: Server error (e.g., OpenAI API issues)

---

### Search Experts

Search for existing experts in the database.

**Endpoint:** `GET /api/v1/experts/search`  
**Authentication:** Required  

**Query Parameters:**
- `query` (optional): Search term for name, company, title, bio, or expertise
- `minConfidence` (optional): Minimum confidence score (0-10)
- `source` (optional): Filter by source: `ai_suggested`, `manual`, `verified`
- `skills` (optional): Comma-separated list of required skills
- `limit` (optional): Maximum results (default: 50, max: 100)

**Example:**
```
GET /api/v1/experts/search?query=healthcare&minConfidence=7&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Dr. Jane Smith",
      "linkedin_url": "https://linkedin.com/in/janesmith",
      "company": "HealthTech Inc",
      "title": "VP of AI",
      "bio": "Leading AI initiatives...",
      "expertise_areas": ["AI", "Healthcare"],
      "proof_links": ["https://example.com/paper"],
      "responsiveness_score": 7,
      "source": "ai_suggested",
      "confidence_score": 8.5,
      "created_at": "2023-12-01T10:00:00.000Z",
      "updated_at": "2023-12-01T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### Get Expert by ID

Retrieve detailed information about a specific expert.

**Endpoint:** `GET /api/v1/experts/:id`  
**Authentication:** Required  

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Dr. Jane Smith",
    "linkedin_url": "https://linkedin.com/in/janesmith",
    "company": "HealthTech Inc",
    "title": "VP of AI",
    "bio": "Leading AI initiatives...",
    "expertise_areas": ["AI", "Healthcare"],
    "proof_links": ["https://example.com/paper"],
    "responsiveness_score": 7,
    "source": "ai_suggested",
    "confidence_score": 8.5,
    "skills": ["Machine Learning", "Healthcare AI", "Python"],
    "created_at": "2023-12-01T10:00:00.000Z",
    "updated_at": "2023-12-01T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `404`: Expert not found

---

### Get User's Sourcing Requests

List all expert sourcing requests for the authenticated user.

**Endpoint:** `GET /api/v1/requests`  
**Authentication:** Required  

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "project_description": "AI healthcare platform...",
      "status": "completed",
      "created_at": "2023-12-01T10:00:00.000Z",
      "updated_at": "2023-12-01T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### Get Sourcing Request Details

Get detailed information about a specific sourcing request.

**Endpoint:** `GET /api/v1/requests/:id`  
**Authentication:** Required  

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "user-123",
    "project_description": "AI healthcare platform...",
    "status": "completed",
    "expert_types": [...],
    "results": [...],
    "matches": [
      {
        "id": 1,
        "request_id": 1,
        "expert_id": 1,
        "expert_type": "Healthcare AI Specialist",
        "relevancy_score": 9,
        "importance_score": 9,
        "likelihood_to_respond": 6,
        "combined_score": 486,
        "linkedin_message": "Personalized message...",
        "what_to_discuss": "Discussion points...",
        "relevance_reason": "Strong match because...",
        "contact_status": "not_contacted",
        "contact_date": null,
        "response_received": false,
        "name": "Dr. Jane Smith",
        "linkedin_url": "https://linkedin.com/in/janesmith",
        "company": "HealthTech Inc",
        "title": "VP of AI",
        "expertise_areas": ["AI", "Healthcare"],
        "proof_links": ["https://example.com/paper"]
      }
    ],
    "created_at": "2023-12-01T10:00:00.000Z",
    "updated_at": "2023-12-01T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `403`: Access denied (not your request)
- `404`: Request not found

---

### Update Expert Contact Status

Update the contact status for an expert in a sourcing request.

**Endpoint:** `POST /api/v1/requests/:requestId/experts/:expertId/contact`  
**Authentication:** Required  

**Request Body:**
```json
{
  "status": "contacted", // contacted, responded, declined, scheduled
  "notes": "Optional notes about the contact"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Contact status updated"
}
```

**Validation:**
- `status`: Required, must be one of: `contacted`, `responded`, `declined`, `scheduled`
- `notes`: Optional, max 1000 characters

**Error Responses:**
- `400`: Invalid status
- `403`: Access denied (not your request)
- `404`: Request or expert not found

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": ["Additional details if applicable"]
}
```

Common HTTP status codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing/invalid API key)
- `403`: Forbidden (access denied)
- `404`: Not Found
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## Rate Limiting

Default rate limits:
- 100 requests per 15 minutes per IP address
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Total allowed requests
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Best Practices

1. **API Keys**: Store securely, never expose in client-side code
2. **Error Handling**: Always check response status and handle errors gracefully
3. **Pagination**: Use `limit` parameter for large result sets
4. **Caching**: Cache expert data when appropriate to reduce API calls
5. **Webhooks**: Consider implementing webhooks for async expert sourcing (future feature)

## Example Integration

```javascript
// Node.js example
import fetch from 'node-fetch';

const API_KEY = process.env.EXPERT_CONTACTS_API_KEY;
const BASE_URL = 'https://api.expertcontacts.com/v1';

async function sourceExperts(projectDescription) {
  const response = await fetch(`${BASE_URL}/experts/source`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({ projectDescription })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
}

// Usage
try {
  const result = await sourceExperts('AI healthcare platform for remote monitoring');
  console.log(`Found ${result.data.results.length} expert types`);
} catch (error) {
  console.error('Error:', error.message);
}
```