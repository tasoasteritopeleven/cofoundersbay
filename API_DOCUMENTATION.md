# 📚 CoFounderBay API Documentation

## 🚀 Overview

The CoFounderBay API is a RESTful API built with NestJS that provides endpoints for managing users, profiles, connections, messaging, events, and more. This documentation covers all available endpoints, authentication, error handling, and best practices.

## 🔗 Base URL

```
Production: https://api.cofounderbay.com/api/v1
Development: http://localhost:3001/api/v1
```

## 🧪 Environment

- **Production**: `https://api.cofounderbay.com`
- **Staging**: `https://staging-api.cofounderbay.com`
- **Development**: `http://localhost:3001`

## 🔐 Authentication

### JWT Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the access token in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

### Token Types

- **Access Token**: Short-lived (15 minutes) token for API requests
- **Refresh Token**: Long-lived (7 days) token for obtaining new access tokens

### Authentication Flow

1. **Login**: Obtain access and refresh tokens
2. **API Requests**: Use access token in Authorization header
3. **Token Refresh**: Use refresh token to get new access token
4. **Logout**: Invalidate refresh token

## 📊 API Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful",
  "timestamp": "2024-03-17T10:30:00.000Z",
  "requestId": "req_1234567890"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found",
    "details": {
      "userId": "user_123"
    }
  },
  "timestamp": "2024-03-17T10:30:00.000Z",
  "requestId": "req_1234567890"
}
```

## 🚨 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `USER_NOT_FOUND` | 404 | User does not exist |
| `INVALID_CREDENTIALS` | 401 | Invalid login credentials |
| `TOKEN_EXPIRED` | 401 | Access token expired |
| `EMAIL_ALREADY_EXISTS` | 409 | Email already registered |

## 📝 Rate Limiting

The API implements rate limiting to prevent abuse:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| General API | 100 requests | 15 minutes |
| Upload | 10 requests | 1 hour |
| Password Reset | 3 requests | 1 hour |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (ISO 8601)

## 🔍 Pagination

List endpoints support pagination using query parameters:

```http
GET /api/v1/users?page=1&limit=20&sort=createdAt&order=desc
```

### Parameters

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Field to sort by
- `order`: Sort order (`asc` or `desc`)

### Response

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## 👥 Authentication Endpoints

### Register User

```http
POST /api/v1/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "role": "founder",
  "displayName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "role": "founder",
      "moderationStatus": "active"
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 900
    }
  }
}
```

### Login

```http
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### Refresh Token

```http
POST /api/v1/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

### Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

### Change Password

```http
POST /api/v1/auth/change-password
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

## 👤 User Endpoints

### Get Current User

```http
GET /api/v1/users/me
Authorization: Bearer <access_token>
```

### Get User by ID

```http
GET /api/v1/users/:userId
Authorization: Bearer <access_token>
```

### Update User

```http
PATCH /api/v1/users/:userId
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "displayName": "John Smith",
  "role": "mentor"
}
```

### Search Users

```http
GET /api/v1/users/search?q=john&role=founder&page=1&limit=20
Authorization: Bearer <access_token>
```

### Get Users by Role

```http
GET /api/v1/users/role/:role?page=1&limit=20
Authorization: Bearer <access_token>
```

## 📋 Profile Endpoints

### Get Profile

```http
GET /api/v1/profiles/:profileId
Authorization: Bearer <access_token>
```

### Create Profile

```http
POST /api/v1/profiles
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "displayName": "John Doe",
  "headline": "Founder at Tech Startup",
  "bio": "Passionate about building innovative solutions...",
  "location": "San Francisco, CA",
  "timezone": "America/Los_Angeles",
  "languages": ["English", "Spanish"],
  "skillIds": ["skill_1", "skill_2"],
  "rolePayload": {
    "industry": "SaaS",
    "stage": "traction",
    "teamSize": 5
  }
}
```

### Update Profile

```http
PATCH /api/v1/profiles/:profileId
Authorization: Bearer <access_token>
```

### Upload Avatar

```http
POST /api/v1/profiles/:profileId/avatar
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

## 🔗 Connections Endpoints

### Send Connection Request

```http
POST /api/v1/connections
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "receiverId": "user_456",
  "message": "Hi! I'd love to connect and discuss potential collaboration."
}
```

### List Connections

```http
GET /api/v1/connections?type=sent&page=1&limit=20
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `type`: `sent`, `received`, or `accepted`

### Respond to Connection Request

```http
PATCH /api/v1/connections/:connectionId
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "status": "accepted"
}
```

### Get Connection Status

```http
GET /api/v1/connections/status/:userId
Authorization: Bearer <access_token>
```

## 💬 Messaging Endpoints

### Get Conversations

```http
GET /api/v1/messages/conversations?page=1&limit=20
Authorization: Bearer <access_token>
```

### Get Messages

```http
GET /api/v1/messages/conversations/:conversationId?page=1&limit=50
Authorization: Bearer <access_token>
```

### Send Message

```http
POST /api/v1/messages
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "conversationId": "conv_123",
  "content": "Hello! How are you?",
  "type": "text"
}
```

### Create Conversation

```http
POST /api/v1/messages/conversations
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "participantIds": ["user_456"],
  "initialMessage": "Hi! I'd like to connect with you."
}
```

## 📅 Events Endpoints

### List Events

```http
GET /api/v1/events?page=1&limit=20&mode=public&type=online
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `mode`: `public`, `private`, `all`
- `type`: `online`, `offline`, `hybrid`
- `startDate`: Filter by start date
- `endDate`: Filter by end date

### Create Event

```http
POST /api/v1/events
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Startup Networking Event",
  "description": "Join us for an evening of networking...",
  "type": "online",
  "mode": "public",
  "startAt": "2024-04-15T18:00:00.000Z",
  "endAt": "2024-04-15T20:00:00.000Z",
  "location": "Virtual",
  "timezone": "America/New_York",
  "maxAttendees": 100,
  "coverImageUrl": "https://example.com/image.jpg"
}
```

### RSVP to Event

```http
POST /api/v1/events/:eventId/rsvp
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "status": "attending"
}
```

## 👥 Groups Endpoints

### List Groups

```http
GET /api/v1/groups?page=1&limit=20&privacy=public
Authorization: Bearer <access_token>
```

### Create Group

```http
POST /api/v1/groups
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Startup Founders Community",
  "description": "A community for startup founders...",
  "privacy": "public",
  "rules": ["Be respectful", "No spam"]
}
```

### Join Group

```http
POST /api/v1/groups/:groupId/join
Authorization: Bearer <access_token>
```

### Create Group Post

```http
POST /api/v1/groups/:groupId/posts
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "content": "Looking for a technical co-founder for my SaaS startup...",
  "type": "text"
}
```

## 🎓 Mentoring Endpoints

### Get Mentor Availability

```http
GET /api/v1/mentor/availability?mentorId=user_123
Authorization: Bearer <access_token>
```

### Create Mentor Availability

```http
POST /api/v1/mentor/availability
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "startTime": "2024-04-15T14:00:00.000Z",
  "endTime": "2024-04-15T15:00:00.000Z",
  "meetingType": "video",
  "maxBookings": 1
}
```

### Book Mentor Session

```http
POST /api/v1/mentor/bookings
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "mentorId": "user_123",
  "slotId": "slot_456",
  "meetingType": "video",
  "notes": "Looking for advice on product strategy"
}
```

### Get Mentor Bookings

```http
GET /api/v1/mentor/bookings?scope=all&page=1&limit=20
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `scope`: `all`, `mentor`, `mentee`

## 💼 Jobs Endpoints

### List Jobs

```http
GET /api/v1/jobs?page=1&limit=10&remote=true
Authorization: Bearer <access_token>
```

### Create Job Posting

```http
POST /api/v1/jobs
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Senior Full-Stack Developer",
  "description": "We're looking for an experienced developer...",
  "company": "Tech Startup Inc.",
  "location": "San Francisco, CA",
  "remote": true,
  "type": "full-time",
  "experienceLevel": "senior",
  "salaryRange": "$120k-$180k",
  "howToApply": "Send resume to jobs@example.com"
}
```

## 🔍 Search Endpoints

### Global Search

```http
GET /api/v1/search?q=founder&type=users&page=1&limit=20
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `q`: Search query
- `type`: `users`, `events`, `groups`, `jobs`, `all`
- `filters`: Additional filters (JSON string)

### Skills Search

```http
GET /api/v1/search/skills?q=react&page=1&limit=20
Authorization: Bearer <access_token>
```

## 📊 Analytics Endpoints

### Get User Analytics

```http
GET /api/v1/analytics/users?timeRange=7d
Authorization: Bearer <access_token>
```

### Get Engagement Analytics

```http
GET /api/v1/analytics/engagement?timeRange=7d
Authorization: Bearer <access_token>
```

### Get Performance Analytics

```http
GET /api/v1/analytics/performance?timeRange=7d
Authorization: Bearer <access_token>
```

## 🏥 Health Endpoints

### Health Check

```http
GET /api/v1/health
```

### Readiness Check

```http
GET /api/v1/health/readiness
```

### Liveness Check

```http
GET /api/v1/health/liveness
```

## 📁 File Upload Endpoints

### Upload File

```http
POST /api/v1/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body:**
```
file: <binary_data>
kind: "avatar" | "cover" | "document"
```

### Get Upload URL

```http
GET /api/v1/upload/url/:uploadId
Authorization: Bearer <access_token>
```

## 🔧 Admin Endpoints

### Get Admin Dashboard

```http
GET /api/v1/admin/dashboard
Authorization: Bearer <admin_access_token>
```

### Get User Management

```http
GET /api/v1/admin/users?page=1&limit=50&status=active
Authorization: Bearer <admin_access_token>
```

### Update User Status

```http
PATCH /api/v1/admin/users/:userId/status
Authorization: Bearer <admin_access_token>
```

**Request Body:**
```json
{
  "moderationStatus": "suspended",
  "reason": "Violation of community guidelines"
}
```

### Get Security Events

```http
GET /api/v1/admin/security/events?page=1&limit=50&severity=high
Authorization: Bearer <admin_access_token>
```

## 🌐 WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3001/socket.io');
```

### Events

- `connect`: Connection established
- `message:new`: New message received
- `message:typing`: User is typing
- `connection:new`: New connection request
- `notification:new`: New notification

### Authentication

```javascript
ws.emit('authenticate', { token: 'access_token' });
```

## 📝 SDK Examples

### JavaScript/TypeScript

```typescript
import { CoFounderBayAPI } from '@cofounderbay/api-client';

const api = new CoFounderBayAPI({
  baseURL: 'https://api.cofounderbay.com/api/v1',
  accessToken: 'your_access_token'
});

// Get current user
const user = await api.users.getMe();

// Send connection request
const connection = await api.connections.send({
  receiverId: 'user_456',
  message: 'Hi! I\'d love to connect.'
});
```

### Python

```python
from cofounderbay_api import CoFounderBayAPI

api = CoFounderBayAPI(
    base_url='https://api.cofounderbay.com/api/v1',
    access_token='your_access_token'
)

# Get current user
user = api.users.get_me()

# Send connection request
connection = api.connections.send({
    'receiver_id': 'user_456',
    'message': 'Hi! I\'d love to connect.'
})
```

## 🚨 Best Practices

### 1. Error Handling

Always handle API errors gracefully:

```typescript
try {
  const user = await api.users.getMe();
} catch (error) {
  if (error.code === 'TOKEN_EXPIRED') {
    // Refresh token and retry
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Wait and retry
  } else {
    // Handle other errors
  }
}
```

### 2. Token Management

Implement automatic token refresh:

```typescript
const api = new CoFounderBayAPI({
  baseURL: 'https://api.cofounderbay.com/api/v1',
  onTokenExpired: async () => {
    const tokens = await api.auth.refresh(refreshToken);
    return tokens.accessToken;
  }
});
```

### 3. Rate Limiting

Respect rate limits and implement exponential backoff:

```typescript
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED' && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};
```

### 4. Caching

Implement client-side caching for frequently accessed data:

```typescript
const cache = new Map();

const getCachedUser = async (userId: string) => {
  if (cache.has(userId)) {
    return cache.get(userId);
  }
  
  const user = await api.users.getById(userId);
  cache.set(userId, user);
  
  // Invalidate cache after 5 minutes
  setTimeout(() => cache.delete(userId), 5 * 60 * 1000);
  
  return user;
};
```

### 5. Pagination

Handle large result sets efficiently:

```typescript
const getAllUsers = async () => {
  let allUsers = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await api.users.list({ page, limit: 100 });
    allUsers = [...allUsers, ...response.items];
    hasMore = response.pagination.hasNext;
    page++;
  }
  
  return allUsers;
};
```

## 🔧 Development Tools

### Postman Collection

Import the provided Postman collection for easy API testing:

1. Download `cofounderbay-api.postman_collection.json`
2. Import into Postman
3. Set environment variables for `base_url` and `access_token`

### OpenAPI Specification

The API is documented with OpenAPI 3.0:

- **Swagger UI**: `https://api.cofounderbay.com/docs`
- **OpenAPI JSON**: `https://api.cofounderbay.com/docs/json`

### API Testing

Run automated tests:

```bash
# Run API tests
npm run test:e2e:api

# Run load tests
npm run test:load
```

## 📞 Support

For API support:

- **Documentation**: https://docs.cofounderbay.com
- **Status Page**: https://status.cofounderbay.com
- **Support Email**: api-support@cofounderbay.com
- **GitHub Issues**: https://github.com/cofounderbay/api/issues

## 🔄 Changelog

### v1.0.0 (2024-03-17)
- Initial API release
- Authentication endpoints
- User and profile management
- Connections and messaging
- Events and groups
- Mentoring and jobs
- Analytics and monitoring

### v1.1.0 (Upcoming)
- Enhanced search capabilities
- Real-time notifications
- Advanced analytics
- Improved rate limiting
- Enhanced security features

---

## 📄 License

This API is licensed under the MIT License. See [LICENSE](https://github.com/cofounderbay/api/blob/main/LICENSE) for details.

---

**Last Updated**: March 17, 2024
**API Version**: v1.0.0
