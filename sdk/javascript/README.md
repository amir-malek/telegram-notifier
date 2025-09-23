# Notification Service JavaScript SDK

A comprehensive TypeScript/JavaScript client library for the Notification Service API.

## 🚀 Features

- **Full TypeScript Support** - Complete type definitions for all API operations
- **Multiple Authentication Methods** - Support for API keys and JWT tokens
- **Automatic Retries** - Configurable retry logic with exponential backoff
- **Rate Limit Handling** - Automatic retry on rate limit errors
- **Error Handling** - Detailed error types with helpful error messages
- **Request/Response Interceptors** - Built-in logging and debugging support
- **Zero Dependencies** - Only depends on axios for HTTP requests

## 📦 Installation

```bash
npm install @notification-service/client
```

```bash
yarn add @notification-service/client
```

```bash
pnpm add @notification-service/client
```

## 🏁 Quick Start

### Basic Setup

```typescript
import { NotificationClient } from '@notification-service/client';

// Using API Key (recommended for server-side)
const client = new NotificationClient({
  baseURL: 'https://api.notification.example.com/api',
  apiKey: 'nf_your_api_key_here'
});

// Using JWT Token (for user sessions)
const client = new NotificationClient({
  baseURL: 'https://api.notification.example.com/api',
  jwt: 'your_jwt_token_here'
});
```

### Send a Simple Notification

```typescript
try {
  const response = await client.sendNotification({
    channel: 'telegram',
    recipient: '@username',
    message: 'Hello from the SDK!',
    priority: 'high'
  });

  console.log('Notification sent:', response.data.id);
} catch (error) {
  console.error('Failed to send notification:', error.message);
}
```

## 📖 Documentation

### Configuration Options

```typescript
interface NotificationClientConfig {
  baseURL: string;              // API base URL
  apiKey?: string;              // API key for authentication
  jwt?: string;                 // JWT token for authentication
  timeout?: number;             // Request timeout (default: 30000ms)
  retry?: {
    attempts?: number;          // Retry attempts (default: 3)
    delay?: number;             // Delay between retries (default: 1000ms)
    retryOnRateLimit?: boolean; // Retry on rate limit (default: true)
  };
  headers?: Record<string, string>; // Custom headers
}
```

### Supported Channels

| Channel   | Status | Description |
|-----------|--------|-------------|
| `telegram` | ✅ Available | Send messages via Telegram bot |
| `slack`    | 🔄 Coming Soon | Send messages to Slack channels |
| `discord`  | 🔄 Coming Soon | Send messages to Discord channels |
| `email`    | 🔄 Coming Soon | Send HTML/text emails |
| `sms`      | 🔄 Coming Soon | Send text messages |
| `webhook`  | 🔄 Coming Soon | HTTP POST to custom endpoints |

## 🔍 Examples

### 1. Send with Template

```typescript
await client.sendNotification({
  channel: 'telegram',
  recipient: '@username',
  template: '550e8400-e29b-41d4-a716-446655440000',
  data: {
    title: 'Software Engineer',
    company: 'TechCorp',
    location: 'Remote',
    salary: '$80,000 - $120,000',
    url: 'https://jobs.techcorp.com/senior-backend'
  },
  priority: 'medium'
});
```

### 2. Schedule Future Notification

```typescript
await client.scheduleNotification({
  channel: 'telegram',
  recipient: '@username',
  message: 'Scheduled reminder message',
  scheduledAt: new Date('2024-12-25T10:00:00Z'),
  priority: 'low'
});
```

### 3. Batch Notifications

```typescript
await client.sendBatchNotifications({
  channel: 'telegram',
  template: 'job-alert-template-id',
  notifications: [
    {
      recipient: '@user1',
      data: {
        title: 'Backend Developer',
        company: 'StartupXYZ',
        location: 'Remote'
      }
    },
    {
      recipient: '@user2',
      data: {
        title: 'Frontend Developer',
        company: 'BigTech',
        location: 'San Francisco'
      }
    }
  ],
  options: {
    batchSize: 10,
    delayBetween: 2000,
    deduplicate: true
  }
});
```

### 4. Query Notifications

```typescript
// Get recent notifications
const response = await client.getNotifications({
  status: 'sent',
  channel: 'telegram',
  limit: 50,
  from: new Date('2024-01-01'),
  to: new Date()
});

console.log(`Found ${response.data.notifications.length} notifications`);
```

### 5. Get Notification Details

```typescript
const notification = await client.getNotification('notification-id');
console.log('Notification status:', notification.data.status);

// Get delivery history
const history = await client.getNotificationHistory('notification-id');
console.log('Delivery attempts:', history.data.attempts);
```

### 6. Get Statistics

```typescript
const stats = await client.getStats({
  from: new Date('2024-01-01'),
  to: new Date()
});

console.log('Success rate:', stats.data.summary.successRate + '%');
console.log('Total sent:', stats.data.summary.sent);
```

### 7. Cancel Notification

```typescript
await client.cancelNotification('notification-id');
console.log('Notification cancelled');
```

## 🚨 Error Handling

The SDK provides detailed error types for better error handling:

```typescript
import {
  NotificationClient,
  isRateLimitError,
  isValidationError,
  isAuthenticationError,
  isNetworkError
} from '@notification-service/client';

try {
  await client.sendNotification({
    channel: 'telegram',
    recipient: '@username',
    message: 'Hello!'
  });
} catch (error) {
  if (isRateLimitError(error)) {
    console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
    console.log('Rate limit info:', error.rateLimit);
  } else if (isValidationError(error)) {
    console.log('Validation errors:');
    error.validationErrors.forEach(err => {
      console.log(`- ${err.field}: ${err.message}`);
    });
  } else if (isAuthenticationError(error)) {
    console.log('Authentication failed. Check your API key or JWT token.');
  } else if (isNetworkError(error)) {
    console.log('Network error. Check your internet connection.');
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

### Error Types

- `ValidationError` - Request validation failed
- `AuthenticationError` - Authentication failed
- `AuthorizationError` - Access forbidden
- `NotFoundError` - Resource not found
- `RateLimitError` - Rate limit exceeded
- `ServerError` - Server error (5xx)
- `NetworkError` - Network connection error
- `TimeoutError` - Request timeout
- `ConfigurationError` - Invalid client configuration

## ⚙️ Advanced Configuration

### Custom Retry Logic

```typescript
const client = new NotificationClient({
  baseURL: 'https://api.notification.example.com/api',
  apiKey: 'nf_your_api_key',
  timeout: 10000,
  retry: {
    attempts: 5,
    delay: 2000,
    retryOnRateLimit: true
  }
});
```

### Custom Headers

```typescript
const client = new NotificationClient({
  baseURL: 'https://api.notification.example.com/api',
  apiKey: 'nf_your_api_key',
  headers: {
    'X-Custom-Header': 'value',
    'X-Client-Version': '1.0.0'
  }
});
```

### Dynamic Authentication

```typescript
const client = new NotificationClient({
  baseURL: 'https://api.notification.example.com/api',
  apiKey: 'initial_key'
});

// Update authentication later
client.setAuthentication({ apiKey: 'new_api_key' });
// or
client.setAuthentication({ jwt: 'new_jwt_token' });
```

## 🔧 Development

### Building from Source

```bash
git clone https://github.com/yourorg/notification-service
cd notification-service/sdk/javascript
npm install
npm run build
```

### Running Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## 📊 Rate Limits

The client automatically handles rate limits and includes rate limit information in responses:

```typescript
const response = await client.sendNotification({
  channel: 'telegram',
  recipient: '@username',
  message: 'Hello!'
});

if (response.rateLimit) {
  console.log(`Rate limit: ${response.rateLimit.remaining}/${response.rateLimit.limit}`);
  console.log(`Resets at: ${response.rateLimit.resetTime}`);
}
```

## 🔐 Security

- **Never expose API keys** in client-side code
- **Use JWT tokens** for browser-based applications
- **Rotate API keys** regularly
- **Use HTTPS** for all requests (enforced by the client)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- 📖 [API Documentation](https://api.notification.example.com/api/docs)
- 🐛 [Report Issues](https://github.com/yourorg/notification-service/issues)
- 💬 [Discord Community](https://discord.gg/notification-service)

## 🗺️ Roadmap

- [ ] Webhook signature validation
- [ ] Built-in template validation
- [ ] Real-time notification status updates
- [ ] Bulk template operations
- [ ] Advanced retry strategies
- [ ] Metrics and analytics helpers