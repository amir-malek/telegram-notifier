import { NotificationClient } from '../src/client';
import { ConfigurationError, ValidationError, RateLimitError } from '../src/errors';
import { mockedAxios } from './setup';

describe('NotificationClient', () => {
  const mockConfig = {
    baseURL: 'https://api.test.com/api',
    apiKey: 'test_api_key'
  };

  describe('constructor', () => {
    it('should create client with valid config', () => {
      const client = new NotificationClient(mockConfig);
      expect(client).toBeInstanceOf(NotificationClient);
    });

    it('should throw ConfigurationError for missing baseURL', () => {
      expect(() => {
        new NotificationClient({ baseURL: '', apiKey: 'test' });
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for missing authentication', () => {
      expect(() => {
        new NotificationClient({ baseURL: 'https://api.test.com' });
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid baseURL', () => {
      expect(() => {
        new NotificationClient({ baseURL: 'invalid-url', apiKey: 'test' });
      }).toThrow(ConfigurationError);
    });
  });

  describe('sendNotification', () => {
    let client: NotificationClient;

    beforeEach(() => {
      client = new NotificationClient(mockConfig);
    });

    it('should send notification successfully', async () => {
      const mockResponse = {
        data: {
          id: 'notification-123',
          status: 'queued',
          channel: 'telegram',
          recipient: '@test',
          priority: 'medium',
          createdAt: '2024-01-01T00:00:00Z',
          message: 'Notification queued successfully'
        },
        status: 201,
        headers: {}
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await client.sendNotification({
        channel: 'telegram',
        recipient: '@test',
        message: 'Test message',
        priority: 'medium'
      });

      expect(result.data.id).toBe('notification-123');
      expect(result.status).toBe(201);
    });

    it('should handle rate limit response', async () => {
      const mockError = {
        response: {
          status: 429,
          data: {
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_ERROR',
            retryAfter: 60
          },
          headers: {
            'ratelimit-limit': '100',
            'ratelimit-remaining': '0',
            'ratelimit-reset': '2024-01-01T01:00:00Z'
          }
        }
      };

      mockedAxios.request.mockRejectedValueOnce(mockError);

      await expect(client.sendNotification({
        channel: 'telegram',
        recipient: '@test',
        message: 'Test message'
      })).rejects.toThrow(RateLimitError);
    });

    it('should handle validation errors', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            validationErrors: [
              {
                field: 'channel',
                message: 'Channel is required',
                value: ''
              }
            ]
          },
          headers: {}
        }
      };

      mockedAxios.request.mockRejectedValueOnce(mockError);

      await expect(client.sendNotification({
        channel: 'telegram',
        recipient: '@test',
        message: 'Test message'
      })).rejects.toThrow(ValidationError);
    });
  });

  describe('getNotifications', () => {
    let client: NotificationClient;

    beforeEach(() => {
      client = new NotificationClient(mockConfig);
    });

    it('should get notifications list', async () => {
      const mockResponse = {
        data: {
          notifications: [
            {
              id: 'notification-1',
              channel: 'telegram',
              recipient: '@test1',
              status: 'sent',
              priority: 'medium',
              createdAt: '2024-01-01T00:00:00Z'
            }
          ],
          pagination: {
            limit: 50,
            offset: 0,
            total: 1
          }
        },
        status: 200,
        headers: {}
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await client.getNotifications({
        status: 'sent',
        limit: 50
      });

      expect(result.data.notifications).toHaveLength(1);
      expect(result.data.notifications[0].id).toBe('notification-1');
    });
  });

  describe('health', () => {
    let client: NotificationClient;

    beforeEach(() => {
      client = new NotificationClient(mockConfig);
    });

    it('should check service health', async () => {
      const mockResponse = {
        data: {
          status: 'ok',
          timestamp: '2024-01-01T00:00:00Z',
          service: 'notification-service',
          version: '1.0.0'
        },
        status: 200,
        headers: {}
      };

      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await client.health();

      expect(result.data.status).toBe('ok');
      expect(result.data.service).toBe('notification-service');
    });
  });

  describe('setAuthentication', () => {
    let client: NotificationClient;

    beforeEach(() => {
      client = new NotificationClient(mockConfig);
    });

    it('should update API key', () => {
      client.setAuthentication({ apiKey: 'new_api_key' });
      // No direct way to test this without accessing private members
      // The test is mainly for ensuring no runtime errors
      expect(client).toBeInstanceOf(NotificationClient);
    });

    it('should update JWT token', () => {
      client.setAuthentication({ jwt: 'new_jwt_token' });
      expect(client).toBeInstanceOf(NotificationClient);
    });
  });

  describe('getConfig', () => {
    it('should return config without sensitive data', () => {
      const client = new NotificationClient({
        ...mockConfig,
        timeout: 15000
      });

      const config = client.getConfig();

      expect(config.baseURL).toBe(mockConfig.baseURL);
      expect(config.timeout).toBe(15000);
      expect('apiKey' in config).toBe(false);
      expect('jwt' in config).toBe(false);
    });
  });
});