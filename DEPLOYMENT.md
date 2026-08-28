# GTX Rush — Deployment Documentation

## Prerequisites

- Node.js 20+
- pnpm 9.15.0+
- Docker & Docker Compose (for production)
- PostgreSQL 16+ (or Docker)
- Redis 7+ (or Docker)

## Local Development Setup

### 1. Clone and Install
```bash
git clone <repo-url>
cd gtx-rush
pnpm install
```

### 2. Start Infrastructure
```bash
docker compose up -d
```

### 3. Configure Environment
```bash
cp .env.development .env
# Edit .env with your values
```

### 4. Run Database Migrations
```bash
pnpm db:generate
pnpm db:migrate
```

### 5. Seed Data
```bash
pnpm db:seed
```

### 6. Start Development
```bash
pnpm dev
```

## Production Deployment

### Docker Deployment
```bash
# Build image
docker build -t gtx-rush-api .

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

### Environment Variables
All production environment variables must be provided via:
- Secrets manager (recommended)
- Environment-specific .env file (acceptable for small deployments)
- Container orchestration environment variables

**Never hard-code secrets in source code or Docker images.**

### Database Migration (Production)
```bash
# Run migrations
docker compose -f docker-compose.prod.yml exec api pnpm db:migrate

# Or run directly against production database
DATABASE_URL=<prod-url> pnpm db:migrate
```

### Rollback Procedure
1. **Application Rollback**: Deploy previous version
   ```bash
   docker compose -f docker-compose.prod.yml up -d --force-recreate api
   ```

2. **Database Rollback**: Use migration rollback
   ```bash
   pnpm db:migrate:rollback
   ```

3. **Configuration Rollback**: Revert .env changes and restart

### Health Checks
```bash
# Liveness
curl http://localhost:3001/health

# Readiness
curl http://localhost:3001/ready
```

### Backup Strategy
- **Database**: Automated daily backups, 30-day retention
- **Redis**: AOF persistence enabled
- **Configuration**: Version-controlled in Git

### Monitoring
- Application logs: Structured JSON
- Metrics: API latency, error rate, database connections
- Alerts: Configured via monitoring system

## Deployment Checklist

### Pre-Deployment
- [ ] Tests pass locally
- [ ] Type check passes
- [ ] Build succeeds
- [ ] No critical security vulnerabilities
- [ ] Database migrations tested
- [ ] Rollback plan documented

### Deployment
- [ ] Backup database
- [ ] Deploy to staging
- [ ] Smoke test staging
- [ ] Deploy to production
- [ ] Verify health checks
- [ ] Monitor for errors

### Post-Deployment
- [ ] Verify all endpoints work
- [ ] Check error rates
- [ ] Monitor performance
- [ ] Update deployment log
