# GTX Rush — Architecture Documentation

## Overview

GTX Rush is a Telegram Mini App gaming platform that supports:
- Multiple game modes (Reaction Rush, Tap Rush, Quiz Rush)
- Global leaderboards and competitive seasons
- Social features (friends, teams, challenges)
- Live events and tournaments
- Creator-generated content
- Virtual economy with Telegram Stars
- AI-powered personalization

## Architecture Style

**Modular Monolith** with clear module boundaries designed for future service extraction.

### Module Boundaries

```
┌─────────────────────────────────────────────┐
│                  API Server                  │
│              (Fastify + TypeScript)          │
├─────────────────────────────────────────────┤
│  Auth  │ Games │ Scores │ Challenges │ Events │
├─────────────────────────────────────────────┤
│  Social │ Teams │ Creators │ Economy │ Admin  │
├─────────────────────────────────────────────┤
│  Retention │ Growth │ Personalization │ Store │
└─────────────────────────────────────────────┘
         │              │              │
    ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐
    │PostgreSQL│   │   Redis   │  │  Queue  │
    │  (Data)  │   │  (Cache)  │  │ (Jobs)  │
    └─────────┘   └───────────┘  └─────────┘
```

## Environments

| Environment | Purpose | Database | Cache |
|------------|---------|----------|-------|
| Development | Local development | Local PostgreSQL (Docker) | Local Redis (Docker) |
| Staging | Pre-production testing | Staging PostgreSQL | Staging Redis |
| Production | Live traffic | Production PostgreSQL | Production Redis |

## Data Flow

### Game Play Flow
```
Client → API → Validate Session → Game Logic → Score Validation → Anti-Cheat → Persist → Leaderboard → Rewards → Analytics
```

### Payment Flow
```
Client → Telegram Stars → Server Verification → Idempotency Check → Grant Items → Audit Log
```

### Admin Flow
```
Admin Panel → Auth → RBAC Check → Action → Audit Log → Notification
```

## Key Design Decisions

1. **Server-Authoritative**: All economy, score, and payment state is controlled server-side
2. **Idempotent Operations**: Critical operations use idempotency keys to prevent duplicates
3. **Progressive Scaling**: Architecture supports MVP → 10M+ users without rewrite
4. **Cache-Aside Pattern**: Redis is used for caching, never as source of truth for critical data
5. **Background Jobs**: Non-critical work (notifications, analytics) is queued for async processing

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 20 | Server runtime |
| Framework | Fastify 5 | HTTP framework |
| Language | TypeScript 5.7 | Type safety |
| Database | PostgreSQL 16 | Primary data store |
| Cache | Redis 7 | Caching, rate limiting, sessions |
| ORM | Drizzle ORM | Database access |
| Build | pnpm + Turborepo | Monorepo management |
| Container | Docker + Docker Compose | Deployment |
| CI/CD | GitHub Actions | Automated pipeline |

## Scaling Strategy

### Stage 1: MVP (0-10K users)
- Single API server
- Managed PostgreSQL
- Redis for caching
- CDN for static assets

### Stage 2: Growth (10K-100K users)
- Horizontal API scaling (2-4 instances)
- Queue system for background jobs
- Read optimization
- Cache layer tuning

### Stage 3: Scale (100K-1M users)
- Dedicated services extraction
- Database read replicas
- Advanced observability
- Multi-region consideration

### Stage 4: Enterprise (1M+ users)
- Multi-region architecture
- Dedicated service teams
- Advanced fraud detection
- Real-time analytics pipeline
