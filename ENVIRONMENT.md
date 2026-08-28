# GTX Rush — Environment Configuration Documentation

## Environments

| Environment | Purpose | NODE_ENV | Auth Mode |
|------------|---------|----------|-----------|
| Development | Local development | `development` | Mock allowed |
| Staging | Pre-production testing | `staging` | Real Telegram |
| Production | Live traffic | `production` | Real Telegram |

## Environment Files

| File | Purpose | Committed |
|------|---------|-----------|
| `.env.development` | Development defaults | Yes |
| `.env.staging` | Staging template | Yes |
| `.env.production` | Production template | Yes |
| `.env` | Active configuration | **Never** |

## Required Variables

### All Environments
```bash
DATABASE_URL=postgresql://...     # Database connection
REDIS_URL=redis://...             # Redis connection
TELEGRAM_BOT_TOKEN=...            # Telegram bot token
JWT_SECRET=...                    # JWT signing secret
```

### Staging/Production Only
```bash
ADMIN_JWT_SECRET=...              # Admin JWT secret
SESSION_SECRET=...                # Session secret
TELEGRAM_WEBHOOK_SECRET=...       # Webhook verification
MINI_APP_URL=...                  # Mini App URL
```

### Optional
```bash
STARS_PAYMENT_TOKEN=...           # Telegram Stars token
WEBHOOK_SECRET=...                # General webhook secret
API_PORT=3001                     # Server port
CORS_ORIGIN=...                   # Allowed origins
LOG_LEVEL=info                    # Logging level
```

## Secret Management Rules

### Never Commit
- `.env` files
- Bot tokens
- Database passwords
- JWT secrets
- Payment tokens

### Always Rotate
- Quarterly for non-critical secrets
- Immediately if compromised
- After team member departure

### Storage
- **Development**: `.env` file (local only)
- **Staging**: Platform secrets manager
- **Production**: Secrets manager (AWS SSM, Vault, etc.)

## Environment-Specific Behavior

### Development
- Mock Telegram authentication allowed
- Debug logging enabled
- In-memory rate limiting
- CORS allows localhost

### Staging
- Real Telegram authentication
- Info logging
- Redis-backed rate limiting
- CORS allows staging domain

### Production
- Real Telegram authentication
- Info logging only
- Redis-backed rate limiting
- CORS restricted to production domain
- HSTS headers enabled
- Security headers enforced

## Validation

The `packages/config/src/env.ts` module validates all required environment variables at startup. Missing variables will cause the application to fail fast with a clear error message.
