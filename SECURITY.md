# GTX Rush — Security Documentation

## Security Principles

1. **Never trust the client**: All sensitive logic is server-side
2. **Least privilege**: Every component gets only what it needs
3. **Defense in depth**: Multiple layers of protection
4. **Fail securely**: Errors never expose sensitive data
5. **Audit everything**: All sensitive actions are logged

## Authentication

### Player Authentication
- Telegram Mini App init_data verification
- HMAC-SHA256 signature validation
- JWT tokens with 24-hour expiration
- Separate JWT secret from admin auth

### Admin Authentication
- Separate admin authentication system
- Strong password requirements
- Account lockout after 5 failed attempts
- 30-minute lockout duration
- 8-hour session duration
- RBAC with 8 distinct roles

## API Security

### Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth | 10 req/min | 60s |
| Game Play | 20 req/min | 60s |
| Score Submit | 20 req/min | 60s |
| Challenge | 10 req/min | 60s |
| Payment | 5 req/min | 60s |
| Admin | 200 req/min | 60s |
| General | 100 req/min | 60s |

### Security Headers
- `Strict-Transport-Security` (HSTS) — production only
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — restricts browser features

### CORS
- Only known application origins allowed
- Never `Access-Control-Allow-Origin: *` for authenticated APIs

## Payment Security

- Server-side Telegram Stars verification
- Idempotency keys prevent duplicate charges
- Transaction records for every payment
- Audit logs for all payment events
- Never trust client-provided price or product ID

## Economy Security

- All economy mutations pass through EconomyService
- Idempotent reward grants prevent duplication
- Daily limits on XP earning
- Anti-farm: minimum time between grants
- Every change creates auditable transaction

## Score Security

- Multi-layer validation:
  1. Input validation
  2. Session validation
  3. Timing validation
  4. Score plausibility
  5. Behavior anomaly detection
  6. Manual review for high-risk cases
- Client cannot write leaderboard position directly

## Data Security

### What We Never Log
- Passwords or password hashes
- Bot tokens
- JWT secrets
- Payment tokens
- Authentication tokens
- Session secrets

### What We Never Expose
- Database connection strings
- Internal service URLs
- Stack traces in production
- Internal error details to clients

### Data Retention
- Logs: 30 days
- Analytics events: 90 days (aggregated)
- Fraud records: 1 year
- Moderation records: 1 year
- Payment records: 7 years (legal requirement)

## Incident Response

### Severity Levels
| Level | Description | Response Time |
|-------|-------------|---------------|
| SEV-1 | Critical outage, security breach, payment failure | Immediate |
| SEV-2 | Major feature degradation | 1 hour |
| SEV-3 | Limited issue | 4 hours |
| SEV-4 | Minor issue | 24 hours |

### Response Procedure
1. DETECT — Monitoring alerts or user reports
2. ASSESS — Determine severity and impact
3. CONTAIN — Mitigate immediate damage
4. INVESTIGATE — Root cause analysis
5. FIX — Implement resolution
6. RECOVER — Restore normal operations
7. POSTMORTEM — Document and improve

### If Credentials Are Compromised
1. Revoke all affected credentials immediately
2. Rotate to new credentials
3. Investigate scope of compromise
4. Audit all actions with compromised credentials
5. Restore securely from clean state
