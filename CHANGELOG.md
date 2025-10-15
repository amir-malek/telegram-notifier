# Changelog

All notable changes to the Notification Service will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-10-16

### 🚨 BREAKING CHANGES

#### Passive Gateway Architecture

The service now operates as a **passive gateway** - clients must provide their bot credentials via headers instead of relying on server-side environment variables.

**What Changed:**
- Telegram bot tokens must now be provided via `X-Telegram-Bot-Token` header
- `TELEGRAM_BOT_TOKEN` environment variable is no longer used
- Bot tokens are NOT stored in the database
- Tokens only held in memory during request processing

**Migration Required:**
- All API calls to send Telegram notifications MUST include `X-Telegram-Bot-Token` header
- See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions

### Added

- **New Middleware**: `extractChannelCredentials` - Extracts and validates bot tokens from request headers
- **Header Validation**: Automatic validation of Telegram bot token format (`<bot_id>:<token>`)
- **Type Safety**: New `ChannelCredentials` interface for type-safe credential handling
- **Security**: Bot tokens never logged (only prefix for debugging)
- **Documentation**:
  - Added `MIGRATION.md` with comprehensive v1 to v2 migration guide
  - Added `X-Telegram-Bot-Token` header documentation
  - Updated API examples with new header requirement

### Changed

- **API Routes**: All notification endpoints now use `extractChannelCredentials` middleware
- **Queue System**: Job data now includes `channelCredentials` for runtime bot selection
- **Controllers**: Validation added to ensure Telegram requests include bot token
- **Queue Processor**: Uses bot token from job credentials instead of environment variable
- **Documentation**: Updated all examples to include required header

### Removed

- **Server-side Bot Storage**: `TELEGRAM_BOT_TOKEN` environment variable no longer used by the service
- **Single Bot Limitation**: Removed restriction of using only one bot for all notifications

### Security

- **Enhanced Privacy**: Bot tokens no longer stored on server
- **Request Scoping**: Tokens only exist in memory during request lifecycle
- **Token Validation**: Format validation prevents malformed tokens
- **No Logging**: Bot tokens excluded from all logging (only prefix logged for debugging)

### Developer Experience

- **Multi-tenant**: Different clients can now use different Telegram bots
- **Flexibility**: Clients have full control over their bot credentials
- **Stateless**: Service doesn't maintain bot configuration state
- **Testability**: Easier to test with different bot configurations

### Performance

- **No Impact**: Token validation adds negligible overhead (<1ms)
- **Same Queue Performance**: No changes to queue processing speed
- **Memory Efficient**: Credentials garbage collected after request completion

### Technical Details

**Files Modified:**
- `src/types/index.ts` - Added `ChannelCredentials` interface
- `src/api/middleware/auth.ts` - Added `extractChannelCredentials` middleware
- `src/api/notifications/routes.ts` - Integrated new middleware
- `src/api/notifications/controller.ts` - Added credential validation
- `src/queue/manager.ts` - Updated to use credentials from job data
- `.env.example` - Marked `TELEGRAM_BOT_TOKEN` as optional

**API Changes:**

Before:
```bash
curl -X POST /api/notifications \
  -H "Authorization: ApiKey nf_xxxxx" \
  -d '{"channel": "telegram", "message": "Hello"}'
```

After:
```bash
curl -X POST /api/notifications \
  -H "Authorization: ApiKey nf_xxxxx" \
  -H "X-Telegram-Bot-Token: 123456:ABC-DEF..." \
  -d '{"channel": "telegram", "message": "Hello"}'
```

### Error Codes

**New Validation Errors:**

- `400 Bad Request` - Missing `X-Telegram-Bot-Token` header for Telegram channel
  ```json
  {
    "error": "Telegram bot token is required. Provide X-Telegram-Bot-Token header."
  }
  ```

- `400 Bad Request` - Invalid token format
  ```json
  {
    "error": "Invalid Telegram bot token format",
    "message": "Telegram bot token must be in format: <bot_id>:<token>"
  }
  ```

### Upgrade Path

1. Update notification service to v2.0.0
2. Update client applications to include `X-Telegram-Bot-Token` header
3. Remove `TELEGRAM_BOT_TOKEN` from server environment
4. Test integration with new header

See [MIGRATION.md](./MIGRATION.md) for detailed step-by-step instructions.

---

## [1.0.0] - 2025-09-23

### Added

- Initial release of Notification Service
- Multi-channel notification support (Telegram, with Slack, Discord, Email, SMS, Webhook planned)
- RESTful API with OpenAPI 3.0 documentation
- Queue-based notification processing using Bull
- Template system with Handlebars
- JWT and API Key authentication
- PostgreSQL database support with in-memory fallback
- Redis queue support with in-memory fallback
- Rate limiting per client
- Retry mechanism with exponential backoff
- Delivery logging and tracking
- Health check endpoints
- Prometheus metrics support
- Docker and Docker Compose support
- Comprehensive error handling
- Batch notification support
- Scheduled notifications
- Notification statistics and reporting

### Channels

- ✅ Telegram (via Bot API)
- 🔄 Slack (Coming soon)
- 🔄 Discord (Coming soon)
- 🔄 Email (Coming soon)
- 🔄 SMS (Coming soon)
- 🔄 Webhook (Coming soon)

### Security

- JWT-based authentication
- API Key authentication
- Rate limiting
- Input validation using Joi
- Password hashing with bcrypt
- CORS protection

### Monitoring

- Winston logging with multiple transports
- Prometheus metrics
- Health check endpoints
- Queue monitoring
- Delivery tracking

---

## Version Format

- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, backward compatible

## Links

- [Migration Guide](./MIGRATION.md)
- [Documentation](./docs/README.md)
- [Docker Setup](./README.docker.md)
