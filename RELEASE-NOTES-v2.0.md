# 🚀 Release Notes - Version 2.0.0

**Release Date:** October 16, 2025

## 🎯 Overview

Version 2.0 introduces **Passive Gateway Architecture** - a fundamental shift in how the Notification Service handles bot credentials. The service no longer stores bot tokens; instead, clients provide their credentials with each request via headers.

## 🚨 BREAKING CHANGES

### ⚠️ Action Required

**All users MUST update their API integration to include bot credentials in request headers.**

#### What Changed

| Aspect | v1.x (Old) | v2.0 (New) |
|--------|------------|------------|
| **Bot Token Location** | Server environment variable | Client request header |
| **Configuration** | `TELEGRAM_BOT_TOKEN=...` | `X-Telegram-Bot-Token: ...` |
| **Storage** | Stored on server | Not stored (memory only) |
| **Multi-Bot Support** | ❌ Single bot only | ✅ Each client uses own bot |
| **Security** | Server holds credentials | Clients control credentials |

#### Before (v1.x)

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Authorization: ApiKey nf_xxxxx" \
  -d '{
    "channel": "telegram",
    "message": "Hello!"
  }'
```

#### After (v2.0)

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Authorization: ApiKey nf_xxxxx" \
  -H "X-Telegram-Bot-Token: 123456:ABC-DEF..." \
  -d '{
    "channel": "telegram",
    "message": "Hello!"
  }'
```

## ✨ New Features

### 1. Header-Based Bot Authentication

Clients now provide bot tokens via the `X-Telegram-Bot-Token` header:

```http
X-Telegram-Bot-Token: 123456:ABC-DEF1234567890abcdefghijklmnop
```

**Benefits:**
- Each client can use their own bot
- No shared bot token limits
- More secure (tokens not stored on server)
- Easier multi-tenant support

### 2. Token Format Validation

Automatic validation of Telegram bot token format:
- Pattern: `<bot_id>:<token>`
- Example: `123456:ABC-DEF1234567890abcdefghijklmnop`

Invalid formats are rejected with clear error messages:

```json
{
  "error": "Invalid Telegram bot token format",
  "message": "Telegram bot token must be in format: <bot_id>:<token>"
}
```

### 3. Enhanced Security

- **No Persistence**: Bot tokens never stored in database or logs
- **Request Scoping**: Tokens only in memory during request lifecycle
- **Safe Logging**: Only token prefix logged for debugging (e.g., `123456:A...`)
- **Stateless**: No server-side bot configuration

### 4. Improved Error Messages

Clear, actionable error messages when credentials are missing:

```json
{
  "error": "Telegram bot token is required. Provide X-Telegram-Bot-Token header."
}
```

## 📊 Impact Assessment

### Performance
- ✅ **No Performance Impact**: Token validation adds <1ms overhead
- ✅ **Same Queue Speed**: No changes to queue processing
- ✅ **Memory Efficient**: Credentials garbage collected after request

### Security
- ✅ **Improved**: Tokens not stored on server
- ✅ **Private**: Each client's bot is isolated
- ✅ **Auditable**: Clear separation of credentials

### Developer Experience
- ⚠️ **Breaking Change**: Requires code updates
- ✅ **More Flexible**: Use different bots per environment
- ✅ **Easier Testing**: No shared bot configuration
- ✅ **Multi-Tenant**: Different teams/projects use different bots

## 🔧 Migration Guide

### Step 1: Update Server

```bash
# Pull latest version
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Update .env (remove TELEGRAM_BOT_TOKEN)
vim .env

# Restart service
npm start
```

### Step 2: Update Client Code

**JavaScript/TypeScript:**

```javascript
// Add bot token to environment
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Update API calls
const response = await fetch(`${API_URL}/api/notifications`, {
  method: 'POST',
  headers: {
    'Authorization': `ApiKey ${API_KEY}`,
    'X-Telegram-Bot-Token': TELEGRAM_BOT_TOKEN,  // ✅ Add this
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    channel: 'telegram',
    recipient: '@username',
    message: 'Hello!'
  })
});
```

**Python:**

```python
import os
import requests

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')

response = requests.post(
    f"{API_URL}/api/notifications",
    headers={
        "Authorization": f"ApiKey {API_KEY}",
        "X-Telegram-Bot-Token": TELEGRAM_BOT_TOKEN,  # ✅ Add this
        "Content-Type": "application/json"
    },
    json={
        "channel": "telegram",
        "recipient": "@username",
        "message": "Hello!"
    }
)
```

### Step 3: Test Integration

```bash
# Test notification sending
curl -X POST http://localhost:3000/api/notifications \
  -H "Authorization: ApiKey ${API_KEY}" \
  -H "X-Telegram-Bot-Token: ${TELEGRAM_BOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "telegram",
    "recipient": "@testuser",
    "message": "v2.0 migration test"
  }'
```

Expected response:
```json
{
  "id": "...",
  "status": "queued",
  "message": "Notification queued successfully"
}
```

## 📚 Documentation

### Updated Documentation
- ✅ [README.md](./README.md) - Complete overview with v2.0 examples
- ✅ [MIGRATION.md](./MIGRATION.md) - Detailed migration instructions
- ✅ [CHANGELOG.md](./CHANGELOG.md) - Full version history
- ✅ [docs/README.md](./docs/README.md) - API documentation with new headers

### Quick Links
- [Migration Guide](./MIGRATION.md) - Step-by-step upgrade instructions
- [API Documentation](./docs/README.md) - Complete API reference
- [Interactive Swagger](http://localhost:3000/api/docs/swagger) - When service is running

## 🐛 Known Issues

None at this time.

## 🔮 Future Plans

### Upcoming Features (v2.1+)
- Additional channel support (Slack, Discord, Email, SMS)
- GraphQL API alongside REST
- WebSocket support for real-time updates
- Enhanced template system
- Advanced rate limiting options

### Long-term Roadmap
- Multi-language support
- Advanced analytics and reporting
- Custom channel plugins
- Notification scheduling improvements

## 🤝 Support

### Getting Help
- **Migration Issues**: See [MIGRATION.md](./MIGRATION.md)
- **API Questions**: Check [docs/README.md](./docs/README.md)
- **Bug Reports**: Open an issue on GitHub
- **General Support**: Check documentation or open a discussion

### Common Issues

**Q: I'm getting "Telegram bot token is required" error**
```
A: Add the X-Telegram-Bot-Token header to your request.
   Example: -H "X-Telegram-Bot-Token: 123456:ABC-DEF..."
```

**Q: My token format is invalid**
```
A: Verify format is: <numbers>:<alphanumeric>
   Example: 123456:ABC-DEF1234567890abcdefghijklmnop
```

**Q: Can I still use environment variables?**
```
A: No, v2.0 requires header-based authentication.
   This is a breaking change for better security and flexibility.
```

**Q: Do I need to update my bot?**
```
A: No, your existing Telegram bot works as-is.
   Only your API integration needs updating.
```

## 📈 Upgrade Statistics

### Migration Timeline
- **Recommended Timeframe**: Immediate
- **Estimated Migration Time**: 15-30 minutes per service
- **Complexity**: Low (header addition only)

### Testing Checklist
- [ ] Update client code to include `X-Telegram-Bot-Token` header
- [ ] Test single notification sending
- [ ] Test batch notifications
- [ ] Test scheduled notifications
- [ ] Verify error handling for missing/invalid tokens
- [ ] Update environment variables/secrets management
- [ ] Update deployment scripts if needed
- [ ] Review and update documentation

## 🎉 Thank You

Thank you for using the Notification Service! We believe v2.0's Passive Gateway Architecture provides better security, flexibility, and multi-tenant support for your notification needs.

If you have questions or feedback, please open an issue or discussion on GitHub.

---

**Version:** 2.0.0
**Release Date:** October 16, 2025
**Status:** Stable
**License:** MIT
