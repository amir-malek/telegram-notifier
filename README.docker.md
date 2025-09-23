# Docker Setup for Notification Service

This document provides instructions for running the Notification Service using Docker.

## Quick Start

### Development Environment

1. **Start development services** (PostgreSQL + Redis):
   ```bash
   npm run docker:dev:start
   ```

2. **Start with admin tools** (includes pgAdmin and Redis Commander):
   ```bash
   npm run docker:dev:admin
   ```

3. **Run the application locally**:
   ```bash
   npm run dev
   ```

4. **Stop development services**:
   ```bash
   npm run docker:dev:stop
   ```

### Production Environment

1. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

2. **Build and start all services**:
   ```bash
   npm run docker:prod:up
   ```

3. **Stop all services**:
   ```bash
   npm run docker:prod:down
   ```

4. **View logs**:
   ```bash
   npm run docker:logs
   ```

## Service Overview

### Development Services (`docker-compose.dev.yml`)

- **PostgreSQL**: Database server on port 5432
- **Redis**: Cache and queue server on port 6379
- **pgAdmin** (optional): Database admin UI on port 8080
- **Redis Commander** (optional): Redis admin UI on port 8081

### Production Services (`docker-compose.yml`)

- **Notification Service**: Main API server on port 3000
- **PostgreSQL**: Database server on port 5432
- **Redis**: Cache and queue server on port 6379
- **Prometheus** (optional): Metrics collection on port 9090
- **Grafana** (optional): Dashboard UI on port 3001

## Environment Configuration

Copy `.env.example` to `.env` and configure the following:

### Required Settings
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `JWT_SECRET`: Secret for JWT token signing
- `API_KEY_SECRET`: Secret for API key generation

### Database Settings
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

### Redis Settings
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

## Admin Tools

When running with `--admin` flag, you can access:

- **pgAdmin**: http://localhost:8080
  - Email: `admin@notification.local`
  - Password: `admin123`

- **Redis Commander**: http://localhost:8081
  - Username: `admin`
  - Password: `admin123`

## Monitoring (Production)

Enable monitoring services with:

```bash
docker-compose --profile monitoring up -d
```

Access:
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin123)

## Building Custom Image

Build the notification service image:

```bash
npm run docker:build
```

Or manually:

```bash
docker build -t notification-service:latest .
```

## Health Checks

All services include health checks:

- **Notification Service**: `GET /api/health`
- **PostgreSQL**: `pg_isready` command
- **Redis**: `PING` command

## Volumes

Data is persisted in Docker volumes:

- `postgres_data`: PostgreSQL data
- `redis_data`: Redis data
- `prometheus_data`: Prometheus data
- `grafana_data`: Grafana data

## Networking

Services communicate on the `notification-network` bridge network:

- Development: `172.21.0.0/16`
- Production: `172.20.0.0/16`

## Troubleshooting

### Check service status
```bash
docker-compose ps
```

### View logs
```bash
docker-compose logs -f [service-name]
```

### Restart services
```bash
docker-compose restart [service-name]
```

### Reset everything
```bash
docker-compose down -v  # Removes volumes too
```

### Database connection issues
1. Ensure PostgreSQL is healthy: `docker-compose ps postgres`
2. Check database logs: `docker-compose logs postgres`
3. Verify connection settings in `.env`

### Redis connection issues
1. Ensure Redis is healthy: `docker-compose ps redis`
2. Check Redis logs: `docker-compose logs redis`
3. Test connection: `docker-compose exec redis redis-cli -a redis123 ping`