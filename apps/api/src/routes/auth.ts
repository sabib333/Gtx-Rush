/**
 * Auth Routes
 *
 * Handles Telegram init data verification and JWT session creation.
 *
 * Flow:
 * 1. Frontend sends Telegram init_data
 * 2. Backend verifies HMAC-SHA256 signature
 * 3. Backend creates/updates GTX Rush user
 * 4. Backend generates JWT session token
 * 5. Frontend stores JWT and uses for all subsequent requests
 */

import type { FastifyInstance } from 'fastify';
import { createHmac, randomBytes } from 'node:crypto';
import { verifyTelegramInitData } from '@gtx-rush/telegram';
import { getEnv, isMockAuthEnabled } from '@gtx-rush/config';

// ============================================================
// In-memory user store (development)
// In production: PostgreSQL via Drizzle ORM
// ============================================================

interface StoredUser {
  id: string;
  telegramId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  xpTotal: number;
  currentStreak: number;
  longestStreak: number;
  totalGamesPlayed: number;
  totalScore: number;
  language: string | null;
  country: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

const users = new Map<number, StoredUser>();
const sessions = new Map<string, { userId: string; telegramId: number; expiresAt: Date }>();

// ============================================================
// Helpers
// ============================================================

function generateId(): string {
  return randomBytes(16).toString('hex');
}

function generateJWT(userId: string, telegramId: number): string {
  const env = getEnv();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    telegramId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
  })).toString('base64url');
  const signature = createHmac('sha256', env.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyJWT(token: string): { userId: string; telegramId: number } | null {
  try {
    const env = getEnv();
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const expectedSig = createHmac('sha256', env.JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    // Constant-time comparison
    if (signature.length !== expectedSig.length) return null;
    let mismatch = 0;
    for (let i = 0; i < signature.length; i++) {
      mismatch |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    if (mismatch !== 0) return null;

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());

    // Check expiration
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { userId: data.sub, telegramId: data.telegramId };
  } catch {
    return null;
  }
}

function upsertUser(telegramData: {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  language_code?: string;
  photo_url?: string;
}): StoredUser {
  const existing = users.get(telegramData.id);

  const displayName = telegramData.last_name
    ? `${telegramData.first_name} ${telegramData.last_name}`
    : telegramData.first_name;

  if (existing) {
    // Update mutable fields only if changed
    let updated = false;
    if (existing.username !== (telegramData.username ?? existing.username)) {
      existing.username = telegramData.username ?? existing.username;
      updated = true;
    }
    if (existing.displayName !== displayName) {
      existing.displayName = displayName;
      updated = true;
    }
    if (telegramData.photo_url && existing.avatarUrl !== telegramData.photo_url) {
      existing.avatarUrl = telegramData.photo_url;
      updated = true;
    }
    existing.lastActiveAt = new Date();
    if (updated) existing.updatedAt = new Date();

    return existing;
  }

  // Create new user
  const user: StoredUser = {
    id: generateId(),
    telegramId: telegramData.id,
    username: telegramData.username ?? `user_${telegramData.id}`,
    displayName,
    avatarUrl: telegramData.photo_url ?? null,
    level: 1,
    xpTotal: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalGamesPlayed: 0,
    totalScore: 0,
    language: telegramData.language_code ?? null,
    country: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: new Date(),
  };

  users.set(telegramData.id, user);
  return user;
}

// ============================================================
// Routes
// ============================================================

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /api/auth/verify
   * Verify Telegram init data and return JWT + user
   */
  app.post('/verify', async (request, reply) => {
    const { initData } = request.body as { initData: string };

    if (!initData) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_INIT_DATA', message: 'initData is required' },
      });
    }

    // === Mock mode for development ===
    if (isMockAuthEnabled()) {
      const mockUser = upsertUser({
        id: 999999999,
        username: 'dev_player',
        first_name: 'Dev Player',
        language_code: 'en',
      });

      const token = generateJWT(mockUser.id, mockUser.telegramId);

      return {
        success: true,
        data: {
          token,
          user: {
            id: mockUser.id,
            telegramId: mockUser.telegramId,
            username: mockUser.username,
            displayName: mockUser.displayName,
            avatarUrl: mockUser.avatarUrl,
            level: mockUser.level,
            xpTotal: mockUser.xpTotal,
          },
        },
      };
    }

    // === Real Telegram verification ===
    const verified = verifyTelegramInitData(initData);

    if (!verified) {
      // Log security event
      console.warn('[AUTH] Invalid init data attempt', {
        ip: request.ip,
        timestamp: new Date().toISOString(),
      });

      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_INIT_DATA', message: 'Invalid Telegram init data' },
      });
    }

    // Check auth_date is recent (within 10 minutes for stricter security)
    const authAge = Date.now() - verified.authDate.getTime();
    if (authAge > 10 * 60 * 1000) {
      return reply.status(401).send({
        success: false,
        error: { code: 'AUTH_EXPIRED', message: 'Init data has expired' },
      });
    }

    // Upsert user
    const user = upsertUser(verified.user);

    // Generate JWT
    const token = generateJWT(user.id, user.telegramId);

    // Create session record
    const sessionToken = generateId();
    sessions.set(sessionToken, {
      userId: user.id,
      telegramId: user.telegramId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          level: user.level,
          xpTotal: user.xpTotal,
        },
      },
    };
  });

  /**
   * POST /api/auth/refresh
   * Refresh an existing JWT
   */
  app.post('/refresh', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: { code: 'NO_TOKEN', message: 'Authorization token required' },
      });
    }

    const token = authHeader.slice(7);
    const payload = verifyJWT(token);

    if (!payload) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
    }

    const user = users.get(payload.telegramId);
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    // Generate new JWT
    const newToken = generateJWT(user.id, user.telegramId);

    return {
      success: true,
      data: {
        token: newToken,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          level: user.level,
          xpTotal: user.xpTotal,
        },
      },
    };
  });

  /**
   * GET /api/auth/me
   * Get current user from JWT
   */
  app.get('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: { code: 'NO_TOKEN', message: 'Authorization token required' },
      });
    }

    const token = authHeader.slice(7);
    const payload = verifyJWT(token);

    if (!payload) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
    }

    const user = users.get(payload.telegramId);
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return {
      success: true,
      data: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        level: user.level,
        xpTotal: user.xpTotal,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalGamesPlayed: user.totalGamesPlayed,
        totalScore: user.totalScore,
        language: user.language,
        country: user.country,
        createdAt: user.createdAt.toISOString(),
        lastActiveAt: user.lastActiveAt.toISOString(),
      },
    };
  });
}
