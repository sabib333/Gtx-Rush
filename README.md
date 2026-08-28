# GTX Rush ⚡

**Play. Compete. Rise.**

A Telegram-native competitive gaming platform. Challenge your reflexes, tap skills, and knowledge against players worldwide.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Phaser 3
- **Backend:** Node.js, Fastify, TypeScript
- **Database:** PostgreSQL (Drizzle ORM)
- **Cache/Leaderboards:** Redis
- **Bot:** Grammy (Telegram Bot API)
- **Monorepo:** Turborepo + pnpm

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL and Redis)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start database services
docker compose up -d

# 3. Copy environment file
cp .env.example .env
# Edit .env with your Telegram Bot Token

# 4. Run database migrations
pnpm db:migrate

# 5. Seed database
pnpm db:seed

# 6. Start development servers
pnpm dev
```

### Development URLs

- **Web App:** http://localhost:5173
- **API:** http://localhost:3001
- **Admin:** http://localhost:5174

## Project Structure

```
gtx-rush/
├── apps/
│   ├── web/          # Telegram Mini App frontend
│   ├── api/          # Fastify backend API
│   ├── bot/          # Telegram bot (grammy)
│   └── admin/        # Admin dashboard
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── config/       # Shared configuration
│   ├── validation/   # Zod validation schemas
│   ├── game-engine/  # Reusable game abstraction
│   ├── telegram/     # Telegram utilities
│   ├── analytics/    # Analytics abstraction
│   └── ui/           # Shared React UI components
├── games/
│   ├── reaction-rush/  # Reaction time game
│   ├── tap-rush/       # Tapping game
│   └── quiz-rush/      # Quiz game
└── docs/
    └── architecture.md  # Architecture document
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for the complete architecture document.

## License

Private — All rights reserved.
