# Notification Service API Documentation

This directory contains the complete API documentation for the Notification Service.

> **⚠️ v2.0 Breaking Change**: Telegram bot tokens must now be provided via `X-Telegram-Bot-Token` header.
> See [MIGRATION.md](../MIGRATION.md) for upgrade instructions.

## 📚 Documentation Files

- **`openapi.yml`** - Complete OpenAPI 3.0 specification
- **`README.md`** - This documentation overview
- **`../MIGRATION.md`** - Migration guide from v1.x to v2.0
- **`../CHANGELOG.md`** - Version history and changes

## 🌐 Online Documentation

When the service is running, you can access the documentation at:

- **Interactive API Explorer**: http://localhost:3000/api/docs/swagger
- **Documentation Home**: http://localhost:3000/api/docs
- **OpenAPI JSON**: http://localhost:3000/api/docs/openapi.json
- **OpenAPI YAML**: http://localhost:3000/api/docs/openapi.yaml

## 🔧 API Overview

### Authentication

The API supports two authentication methods:

1. **JWT Bearer Tokens** (for session-based auth):
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **API Keys** (for service-to-service communication):
   ```
   Authorization: ApiKey nf_xxxxxxxxxxxxxxxx
   ```

### Channel Credentials (Required for Telegram)

**🔑 Passive Gateway Architecture (v2.0+)**

The service operates as a passive gateway - clients provide their own bot credentials via headers:

- **Telegram Bot Token**: `X-Telegram-Bot-Token: <bot_id>:<token>`

**Example:**
```bash
X-Telegram-Bot-Token: 123456:ABC-DEF1234567890abcdefghijklmnop
```

**Important Notes:**
- Bot tokens are NOT stored on the server
- Tokens only exist in memory during request processing
- Each client can use their own Telegram bot
- Token format must be: `<numbers>:<alphanumeric_string>`

### Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

## 📡 Supported Channels

| Channel  | Status | Description |
|----------|--------|-------------|
| Telegram | ✅ Ready | Send messages via Telegram bot |
| Slack    | 🔄 Coming Soon | Send messages to Slack channels |
| Discord  | 🔄 Coming Soon | Send messages to Discord channels |
| Email    | 🔄 Coming Soon | Send HTML/text emails |
| SMS      | 🔄 Coming Soon | Send text messages |
| Webhook  | 🔄 Coming Soon | HTTP POST to custom endpoints |

## 🚀 Quick Start Examples

### 1. Send a Simple Message

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey nf_your_api_key" \
  -H "X-Telegram-Bot-Token: 123456:ABC-DEF1234567890abcdefghijklmnop" \
  -d '{
    "channel": "telegram",
    "recipient": "@username",
    "message": "Hello from Notification Service!",
    "priority": "medium"
  }'
```

### 2. Send Using a Template

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey nf_your_api_key" \
  -H "X-Telegram-Bot-Token: 123456:ABC-DEF1234567890abcdefghijklmnop" \
  -d '{
    "channel": "telegram",
    "recipient": "@username",
    "template": "550e8400-e29b-41d4-a716-446655440000",
    "data": {
      "title": "Software Engineer",
      "company": "TechCorp",
      "location": "Remote",
      "salary": "$80,000 - $120,000"
    },
    "priority": "high"
  }'
```

### 3. Schedule a Notification

```bash
curl -X POST http://localhost:3000/api/notifications/schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey nf_your_api_key" \
  -H "X-Telegram-Bot-Token: 123456:ABC-DEF1234567890abcdefghijklmnop" \
  -d '{
    "channel": "telegram",
    "recipient": "@username",
    "scheduledAt": "2024-12-25T10:00:00Z",
    "message": "Merry Christmas! 🎄",
    "priority": "medium"
  }'
```

### 4. Send Batch Notifications

```bash
curl -X POST http://localhost:3000/api/notifications/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey nf_your_api_key" \
  -H "X-Telegram-Bot-Token: 123456:ABC-DEF1234567890abcdefghijklmnop" \
  -d '{
    "channel": "telegram",
    "template": "550e8400-e29b-41d4-a716-446655440000",
    "notifications": [
      {
        "recipient": "@user1",
        "data": {
          "title": "Backend Developer",
          "company": "StartupXYZ"
        }
      },
      {
        "recipient": "@user2",
        "data": {
          "title": "Frontend Developer",
          "company": "BigTech"
        }
      }
    ],
    "options": {
      "batchSize": 5,
      "delayBetween": 2000
    }
  }'
```

### 5. Get Notification Statistics

```bash
curl -X GET http://localhost:3000/api/notifications/stats \
  -H "Authorization: ApiKey nf_your_api_key"
```

## ⚡ Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 1000 requests | 15 minutes per IP |
| Notifications | 100 requests | 1 minute per client |
| Batch Notifications | 10 requests | 1 minute per client |
| Authentication | 10 requests | 15 minutes per IP |

Rate limit headers are included in responses:
- `RateLimit-Limit`: Request limit per window
- `RateLimit-Remaining`: Remaining requests
- `RateLimit-Reset`: Window reset time

## 📊 Response Format

### Success Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "channel": "telegram",
  "recipient": "@username",
  "priority": "medium",
  "createdAt": "2024-01-01T12:00:00Z",
  "message": "Notification queued successfully"
}
```

### Error Response

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-01T12:00:00Z",
  "path": "/api/notifications",
  "method": "POST",
  "requestId": "req_1234567890",
  "validationErrors": [
    {
      "field": "channel",
      "message": "Channel must be one of: telegram, slack, discord, email, sms, webhook",
      "value": "invalid_channel"
    }
  ]
}
```

## 🔄 Notification Status Flow

```
pending → queued → processing → sent
                             ↘ failed
                             ↘ cancelled (if cancelled)
```

- **pending**: Just created, waiting to be queued
- **queued**: In the processing queue
- **processing**: Currently being sent
- **sent**: Successfully delivered
- **failed**: Delivery failed (after all retries)
- **cancelled**: Manually cancelled

## 📝 Template System

Templates use Handlebars syntax with built-in helpers:

```handlebars
🆕 *New Job Alert*

*{{title}}*
🏢 {{company}}
📍 {{location}}
{{#if salary}}💰 {{salary}}{{/if}}

{{#if description}}{{truncate description 200}}{{/if}}

🔗 [View Job]({{url}})
```

### Available Template Helpers

- `formatDate`: Format dates
- `formatCurrency`: Format currency amounts
- `truncate`: Truncate long text
- `uppercase/lowercase/capitalize`: Text case helpers
- `eq/ne/gt/lt`: Comparison helpers
- `join`: Join arrays
- `urlEncode`: URL encoding

## 🔍 Monitoring & Health

- **Health Check**: `GET /api/health`
- **Service Info**: `GET /api`
- **Notification Stats**: `GET /api/notifications/stats`

## 🛠️ Development Tools

### Generate API Client

Use the OpenAPI specification to generate clients:

```bash
# Download the spec
curl http://localhost:3000/api/docs/openapi.json > openapi.json

# Generate JavaScript client
npx @openapitools/openapi-generator-cli generate \
  -i openapi.json \
  -g javascript \
  -o ./notification-client
```

### Validate API Calls

Use tools like [Insomnia](https://insomnia.rest/) or [Postman](https://www.postman.com/) to import the OpenAPI specification and test API endpoints.

## 🤝 Support

For questions and support:
- Review the interactive documentation at `/api/docs/swagger`
- Check the health endpoint for service status
- Review notification delivery logs for debugging