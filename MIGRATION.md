# Migration Guide: v1.x to v2.0

## Overview

Version 2.0 introduces a **breaking change** to how the notification service handles Telegram bot credentials. The service now operates as a **passive gateway**, requiring clients to provide their bot tokens with each request via headers instead of relying on a server-side environment variable.

## Breaking Changes

### ❌ What Changed

**v1.x (Old Behavior):**
- Single bot token configured via `TELEGRAM_BOT_TOKEN` environment variable
- All notifications sent using the same bot
- Bot token stored on the server

**v2.0 (New Behavior):**
- Bot tokens provided by clients via `X-Telegram-Bot-Token` header
- Each client can use their own bot
- Bot tokens NOT stored on the server (stateless operation)
- Tokens only held in memory during request processing

### 🔧 Required Changes

#### 1. **Update Your API Calls**

Add the `X-Telegram-Bot-Token` header to all Telegram notification requests:

**Before (v1.x):**
```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Authorization: ApiKey nf_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "telegram",
    "recipient": "@username",
    "message": "Hello World!"
  }'
```

**After (v2.0):**
```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Authorization: ApiKey nf_xxxxx" \
  -H "X-Telegram-Bot-Token: 123456:ABC-DEF1234567890abcdefghijklmnop" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "telegram",
    "recipient": "@username",
    "message": "Hello World!"
  }'
```

#### 2. **Update Client Libraries**

If you're using a custom client library, update it to include the bot token header:

**JavaScript/TypeScript:**
```javascript
// Before (v1.x)
async function sendNotification(message) {
  const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${NOTIFICATION_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: 'telegram',
      recipient: '@username',
      message
    })
  });
  return response.json();
}

// After (v2.0)
async function sendNotification(message, botToken) {
  const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${NOTIFICATION_API_KEY}`,
      'X-Telegram-Bot-Token': botToken,  // ✅ Added
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: 'telegram',
      recipient: '@username',
      message
    })
  });
  return response.json();
}
```

**Python:**
```python
# Before (v1.x)
import requests

def send_notification(message):
    response = requests.post(
        f"{NOTIFICATION_SERVICE_URL}/api/notifications",
        headers={
            "Authorization": f"ApiKey {NOTIFICATION_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "channel": "telegram",
            "recipient": "@username",
            "message": message
        }
    )
    return response.json()

# After (v2.0)
import requests

def send_notification(message, bot_token):
    response = requests.post(
        f"{NOTIFICATION_SERVICE_URL}/api/notifications",
        headers={
            "Authorization": f"ApiKey {NOTIFICATION_API_KEY}",
            "X-Telegram-Bot-Token": bot_token,  # ✅ Added
            "Content-Type": "application/json"
        },
        json={
            "channel": "telegram",
            "recipient": "@username",
            "message": message
        }
    )
    return response.json()
```

#### 3. **Update Environment Variables**

Remove or empty the `TELEGRAM_BOT_TOKEN` from your server environment:

**Before (.env):**
```bash
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234567890abcdefghijklmnop
```

**After (.env):**
```bash
# TELEGRAM_BOT_TOKEN is no longer used by the server
# Clients provide their own tokens via headers
TELEGRAM_BOT_TOKEN=
```

#### 4. **Store Bot Token on Client Side**

Each client application must now store and manage its own Telegram bot token:

```bash
# Client environment variables
NOTIFICATION_SERVICE_URL=http://localhost:3000
NOTIFICATION_API_KEY=nf_xxxxx
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234567890abcdefghijklmnop  # Your bot token
```

## Migration Steps

### Step 1: Update the Notification Service

```bash
# Pull latest version
git pull origin main

# Install dependencies (if any changes)
npm install

# Update environment variables
# Remove or comment out TELEGRAM_BOT_TOKEN in .env

# Restart the service
npm run build
npm start
```

### Step 2: Update Client Applications

For each application using the notification service:

1. **Add bot token to environment variables**
   ```bash
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```

2. **Update API calls to include header**
   - Add `X-Telegram-Bot-Token` header to all requests
   - Pass the bot token from environment variables

3. **Test the integration**
   ```bash
   # Test single notification
   curl -X POST http://localhost:3000/api/notifications \
     -H "Authorization: ApiKey ${NOTIFICATION_API_KEY}" \
     -H "X-Telegram-Bot-Token: ${TELEGRAM_BOT_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{
       "channel": "telegram",
       "recipient": "@testuser",
       "message": "Migration test"
     }'
   ```

### Step 3: Verify Migration

1. **Check that notifications are sent successfully**
2. **Monitor error logs** for missing header errors
3. **Verify no bot token in server logs**

## Error Handling

### Common Errors After Migration

#### 1. Missing Bot Token Header

**Error:**
```json
{
  "error": "Telegram bot token is required. Provide X-Telegram-Bot-Token header.",
  "code": "VALIDATION_ERROR"
}
```

**Solution:**
Add the `X-Telegram-Bot-Token` header to your request.

#### 2. Invalid Token Format

**Error:**
```json
{
  "error": "Invalid Telegram bot token format",
  "message": "Telegram bot token must be in format: <bot_id>:<token>"
}
```

**Solution:**
Verify your token follows the format: `<numbers>:<alphanumeric>` (e.g., `123456:ABC-DEF...`)

#### 3. Bot Token Not Provided in Queue Job

**Error in logs:**
```
Telegram bot token not provided in channel credentials
```

**Solution:**
This indicates the bot token wasn't properly passed through the request pipeline. Ensure the header is present and correctly named.

## Benefits of v2.0

### ✅ Advantages

1. **Multi-tenant Support**: Different clients can use different bots
2. **Security**: Bot tokens not stored on the server
3. **Flexibility**: Clients control their own credentials
4. **Stateless**: Service doesn't maintain bot configuration
5. **Scalability**: No shared bot token limits

### 📊 Performance Impact

- **No performance degradation**: Token validation adds negligible overhead
- **Same queue processing**: No changes to queue performance
- **Memory efficient**: Tokens only in memory during request lifecycle

## Rollback Plan

If you need to rollback to v1.x behavior:

```bash
# Checkout previous version
git checkout v1.0.0

# Install dependencies
npm install

# Restore TELEGRAM_BOT_TOKEN in .env
echo "TELEGRAM_BOT_TOKEN=your_token" >> .env

# Rebuild and restart
npm run build
npm start
```

## Support

If you encounter issues during migration:

1. **Check the error message** - Most errors clearly indicate the missing header
2. **Verify token format** - Ensure it matches `<bot_id>:<token>`
3. **Test with curl** - Use the examples above to verify service is working
4. **Review logs** - Check server logs for detailed error information

## Timeline

- **v2.0.0 Release**: October 16, 2025
- **v1.x Support**: No longer maintained after release
- **Migration Window**: Immediate (breaking change)

## Questions?

For migration assistance or questions, please open an issue on the GitHub repository.
