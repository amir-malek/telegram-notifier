import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';

const router = Router();

// Load OpenAPI specification
const openApiPath = join(__dirname, '../../../docs/openapi.yml');
let openApiSpec: any;

try {
  openApiSpec = YAML.load(openApiPath);
} catch (error) {
  console.error('Failed to load OpenAPI specification:', error);
  openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'Notification Service API',
      version: '1.0.0',
      description: 'API documentation could not be loaded'
    },
    paths: {}
  };
}

// Swagger UI options
const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'list',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
    requestInterceptor: (req: any) => {
      // Add request ID header
      req.headers['X-Request-ID'] = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return req;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .swagger-ui .info .title { color: #2563eb; }
    .swagger-ui .scheme-container { background: #f8fafc; border: 1px solid #e2e8f0; }
  `,
  customSiteTitle: 'Notification Service API Documentation'
};

// Serve Swagger UI
router.use('/swagger', swaggerUi.serve);
router.get('/swagger', swaggerUi.setup(openApiSpec, swaggerOptions));

// Raw OpenAPI specification endpoints
router.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

router.get('/openapi.yaml', (req, res) => {
  try {
    const yamlContent = readFileSync(openApiPath, 'utf8');
    res.type('application/x-yaml').send(yamlContent);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load OpenAPI specification',
      message: (error as Error).message
    });
  }
});

// Documentation home page
router.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notification Service API Documentation</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          line-height: 1.6;
          color: #374151;
        }
        .header {
          text-align: center;
          margin-bottom: 3rem;
          padding-bottom: 2rem;
          border-bottom: 2px solid #e5e7eb;
        }
        .header h1 {
          color: #2563eb;
          margin-bottom: 0.5rem;
        }
        .header p {
          color: #6b7280;
          font-size: 1.1rem;
        }
        .section {
          margin-bottom: 2rem;
        }
        .section h2 {
          color: #1f2937;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.5rem;
        }
        .links {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }
        .link-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
        }
        .link-card:hover {
          border-color: #2563eb;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
          transform: translateY(-2px);
        }
        .link-card h3 {
          margin: 0 0 0.5rem 0;
          color: #2563eb;
        }
        .link-card p {
          margin: 0;
          color: #6b7280;
          font-size: 0.9rem;
        }
        .code {
          background: #f3f4f6;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.9rem;
        }
        .auth-examples {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        }
        .auth-examples h4 {
          margin-top: 0;
          color: #1f2937;
        }
        .auth-examples pre {
          background: #374151;
          color: #f9fafb;
          padding: 0.75rem;
          border-radius: 4px;
          overflow-x: auto;
          margin: 0.5rem 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📡 Notification Service API</h1>
        <p>Multi-channel notification service with template support</p>
        <p><strong>Version:</strong> 1.0.0</p>
      </div>

      <div class="section">
        <h2>📚 Documentation</h2>
        <div class="links">
          <a href="${baseUrl}/api/docs/swagger" class="link-card">
            <h3>🔧 Interactive API Explorer</h3>
            <p>Try out API endpoints with Swagger UI</p>
          </a>
          <a href="${baseUrl}/api/docs/openapi.json" class="link-card">
            <h3>📄 OpenAPI Specification (JSON)</h3>
            <p>Machine-readable API specification</p>
          </a>
          <a href="${baseUrl}/api/docs/openapi.yaml" class="link-card">
            <h3>📝 OpenAPI Specification (YAML)</h3>
            <p>Human-readable API specification</p>
          </a>
        </div>
      </div>

      <div class="section">
        <h2>🔐 Authentication</h2>
        <p>This API supports two authentication methods:</p>

        <div class="auth-examples">
          <h4>JWT Bearer Token</h4>
          <pre>Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</pre>

          <h4>API Key</h4>
          <pre>Authorization: ApiKey nf_xxxxxxxxxxxxxxxx</pre>
        </div>
      </div>

      <div class="section">
        <h2>🚀 Quick Start</h2>
        <p>Send your first notification:</p>

        <div class="auth-examples">
          <h4>1. Send a simple message</h4>
          <pre>POST ${baseUrl}/api/notifications
Content-Type: application/json
Authorization: ApiKey nf_your_api_key

{
  "channel": "telegram",
  "recipient": "@username",
  "message": "Hello from Notification Service!",
  "priority": "medium"
}</pre>

          <h4>2. Send using a template</h4>
          <pre>POST ${baseUrl}/api/notifications
Content-Type: application/json
Authorization: ApiKey nf_your_api_key

{
  "channel": "telegram",
  "recipient": "@username",
  "template": "job-alert-template-id",
  "data": {
    "title": "Software Engineer",
    "company": "TechCorp",
    "location": "Remote"
  },
  "priority": "high"
}</pre>
        </div>
      </div>

      <div class="section">
        <h2>📊 Supported Channels</h2>
        <div class="links">
          <div class="link-card">
            <h3>📱 Telegram</h3>
            <p>Send messages via Telegram bot (Ready)</p>
          </div>
          <div class="link-card">
            <h3>💬 Slack</h3>
            <p>Send messages to Slack channels (Coming Soon)</p>
          </div>
          <div class="link-card">
            <h3>🎮 Discord</h3>
            <p>Send messages to Discord channels (Coming Soon)</p>
          </div>
          <div class="link-card">
            <h3>📧 Email</h3>
            <p>Send HTML/text emails (Coming Soon)</p>
          </div>
          <div class="link-card">
            <h3>📱 SMS</h3>
            <p>Send text messages (Coming Soon)</p>
          </div>
          <div class="link-card">
            <h3>🔗 Webhook</h3>
            <p>HTTP POST to custom endpoints (Coming Soon)</p>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>⚡ Rate Limits</h2>
        <ul>
          <li><strong>General API:</strong> 1000 requests per 15 minutes per IP</li>
          <li><strong>Notifications:</strong> 100 requests per minute per client</li>
          <li><strong>Batch notifications:</strong> 10 requests per minute per client</li>
        </ul>
      </div>

      <div class="section">
        <h2>🔗 Service Links</h2>
        <div class="links">
          <a href="${baseUrl}/api/health" class="link-card">
            <h3>💚 Health Check</h3>
            <p>Check service status</p>
          </a>
          <a href="${baseUrl}/api/notifications/stats" class="link-card">
            <h3>📈 Statistics</h3>
            <p>View notification statistics</p>
          </a>
        </div>
      </div>
    </body>
    </html>
  `);
});

export { router as docsRoutes };