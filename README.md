# Notification Service

> **Version 2.0** - Multi-Channel Notification Gateway with Passive Bot Integration

A centralized, scalable notification service that acts as a passive gateway for sending notifications across multiple channels. Built with TypeScript, Express.js, PostgreSQL, Redis, and Bull queues.

## 🚨 v2.0 Breaking Changes

**Passive Gateway Architecture** - The service now requires clients to provide their own bot credentials via headers.

**What Changed:**
- Telegram bot tokens must be provided via `X-Telegram-Bot-Token` header with each request
- `TELEGRAM_BOT_TOKEN` environment variable is no longer used by the service
- Bot tokens are NOT stored in the database

**Migration Required:**
- All Telegram notification requests MUST include the `X-Telegram-Bot-Token` header
- See **[MIGRATION.md](./MIGRATION.md)** for detailed upgrade instructions

## ✨ Features

### Core Capabilities
- 🔌 **Multi-Channel Support**: Telegram (active), Slack, Discord, Email, SMS, Webhook (planned)
- 🔐 **Dual Authentication**: JWT tokens + API keys
- 🎯 **Passive Gateway**: Clients provide their own bot credentials
- 📬 **Queue System**: Bull-based job processing with Redis
- 🔄 **Retry Mechanism**: Exponential backoff for failed deliveries
- 📊 **Rate Limiting**: Per-client configurable limits
- 📝 **Template Engine**: Handlebars with custom helpers
- 🗄️ **Flexible Storage**: PostgreSQL with in-memory fallback
- 📈 **Monitoring**: Prometheus metrics + Winston logging
- 🐳 **Docker Ready**: Full Docker and Docker Compose support

### v2.0 Highlights
- **Multi-Tenant**: Different clients can use different bots
- **Stateless**: No bot configuration stored on server
- **Secure**: Bot tokens never persisted, only in memory during requests
- **Flexible**: Clients maintain full control over credentials

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (optional - has in-memory fallback)
- Redis 7+ (optional - has in-memory fallback)
- Telegram Bot Token (for your own bot)

### Installation

```bash
# Clone the repository
git clone https://github.com/amir-malek/telegram-notifier.git
cd telegram-notifier

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration (TELEGRAM_BOT_TOKEN is now optional)

# Run database migrations (if using PostgreSQL)
npm run migrate

# Build the project
npm run build

# Start the service
npm start
```

### Docker Deployment

```bash
# Development
npm run docker:dev:start

# Production
npm run docker:prod:start
```

See [README.docker.md](./README.docker.md) for detailed Docker instructions.

## 📖 Usage

### Send a Notification

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Authorization: ApiKey nf_your_api_key" \
  -H "X-Telegram-Bot-Token: 123456:ABC-DEF1234567890abcdefghijklmnop" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "telegram",
    "recipient": "@username",
    "message": "Hello from Notification Service!",
    "priority": "medium"
  }'
```

### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "channel": "telegram",
  "recipient": "@username",
  "priority": "medium",
  "createdAt": "2025-10-16T12:00:00Z",
  "message": "Notification queued successfully"
}
```

## 🔑 Authentication

The service requires **two layers** of authentication for Telegram notifications:

### 1. Service Authentication (Required)

**API Key:**
```bash
Authorization: ApiKey nf_xxxxxxxxxxxxxxxxxx
```

**JWT Token:**
```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Channel Credentials (Required for Telegram)

**Telegram Bot Token:**
```bash
X-Telegram-Bot-Token: 123456:ABC-DEF1234567890abcdefghijklmnop
```

**Important:**
- Bot tokens are never logged (only prefix for debugging)
- Tokens exist only in memory during request processing
- Not persisted to database or disk
- Each client uses their own bot

## 📚 Documentation

- **[API Documentation](./docs/README.md)** - Complete API reference with examples
- **[Migration Guide](./MIGRATION.md)** - Upgrade from v1.x to v2.0
- **[Changelog](./CHANGELOG.md)** - Version history and changes
- **[Docker Setup](./README.docker.md)** - Docker deployment guide

### Interactive Documentation

When running, access the Swagger UI at:
```
http://localhost:3000/api/docs/swagger
```

## 🛠️ API Endpoints

### Notifications
- `POST /api/notifications` - Send single notification
- `POST /api/notifications/batch` - Send batch notifications
- `POST /api/notifications/schedule` - Schedule notification
- `GET /api/notifications` - List notifications
- `GET /api/notifications/:id` - Get notification details
- `GET /api/notifications/stats` - Get statistics
- `DELETE /api/notifications/:id` - Cancel notification

### Authentication
- `POST /api/auth/login` - JWT authentication
- `POST /api/auth/clients` - Create API client
- `GET /api/auth/clients` - List clients

### Health & Monitoring
- `GET /api/health` - Health check
- `GET /api` - Service information

## 🔧 Configuration

### Required Headers for Telegram

```typescript
{
  'Authorization': 'ApiKey nf_xxxxx',           // Service auth
  'X-Telegram-Bot-Token': '123456:ABC-DEF...',  // Bot credentials
  'Content-Type': 'application/json'
}
```

### Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000

# Database (optional)
DATABASE_ENABLED=true
DATABASE_URL=postgresql://user:pass@localhost:5432/notifications

# Redis (optional)
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
API_KEY_SECRET=your-api-key-secret

# Telegram (no longer used by server in v2.0)
# Clients provide tokens via headers
TELEGRAM_BOT_TOKEN=

# Queue
QUEUE_CONCURRENCY=5
QUEUE_ATTEMPTS=3
```

## 📊 Supported Channels

| Channel  | Status | Authentication Method |
|----------|--------|----------------------|
| Telegram | ✅ Active | `X-Telegram-Bot-Token` header |
| Slack    | 🔄 Planned | Header-based |
| Discord  | 🔄 Planned | Header-based |
| Email    | 🔄 Planned | Header-based |
| SMS      | 🔄 Planned | Header-based |
| Webhook  | 🔄 Planned | Header-based |

## 🎯 Use Cases

- **Job Alert Systems**: Notify users about new job postings
- **Monitoring Alerts**: Send system alerts and notifications
- **Customer Notifications**: Order updates, shipping notifications
- **Team Communication**: Internal team notifications and updates
- **Marketing Campaigns**: Bulk notification campaigns
- **Event Reminders**: Scheduled event notifications

## 🔒 Security Features

- **No Token Storage**: Bot credentials never persisted
- **Request Scoping**: Tokens only in memory during request
- **Format Validation**: Token format validation before processing
- **Rate Limiting**: Per-client configurable limits
- **Input Validation**: Comprehensive request validation
- **Authentication**: Multi-layer auth (service + channel)
- **CORS Protection**: Configurable CORS policies

## 🚦 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build TypeScript
npm start            # Start production server
npm test             # Run tests
npm run lint         # Lint code
npm run migrate      # Run database migrations
```

### Project Structure

```
src/
├── api/              # Express routes and controllers
│   ├── middleware/   # Auth, validation, error handling
│   └── notifications/# Notification endpoints
├── auth/             # Authentication (JWT + API keys)
├── channels/         # Channel implementations
│   └── telegram.ts   # Telegram channel handler
├── database/         # Database and models
├── queue/            # Bull queue management
├── templates/        # Handlebars template engine
└── types/            # TypeScript type definitions
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Support

- 📖 [Documentation](./docs/README.md)
- 🐛 [Issue Tracker](https://github.com/amir-malek/telegram-notifier/issues)
- 💬 [Discussions](https://github.com/amir-malek/telegram-notifier/discussions)

## 🔗 Related Projects


## 📅 Roadmap

- [x] Telegram channel support
- [x] Template system with Handlebars
- [x] Batch notifications
- [x] Scheduled notifications
- [x] Passive gateway architecture (v2.0)
- [ ] Slack channel support
- [ ] Discord channel support
- [ ] Email channel support
- [ ] SMS channel support
- [ ] Webhook channel support
- [ ] GraphQL API
- [ ] WebSocket real-time updates
- [ ] Multi-language support

---

**Made with ❤️ for developers who need reliable notifications**
