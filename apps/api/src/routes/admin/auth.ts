/**
 * GTX Rush — Admin Auth Routes v1.0
 *
 * Handles admin login, session management, and logout.
 *
 * SECURITY:
 * - Separate JWT secret from player auth
 * - Rate limiting on login attempts
 * - Account lockout after failed attempts
 * - All auth events are audit logged
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { adminLogin, adminSessions, addAuditEntry } from '../../middleware/admin-auth';
import { ADMIN_SESSION_CONFIG } from '@gtx-rush/config';
import { createRateLimiter } from '../../middleware/rate-limiter';

const adminLoginRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: ADMIN_SESSION_CONFIG.loginRateLimit,
  keyGenerator: (req) => `admin-login:${req.ip}`,
  message: 'Too many login attempts. Please wait.',
});

export async function adminAuthRoutes(app: FastifyInstance) {
  /**
   * POST /api/admin/auth/login
   * Admin login with email/password
   */
  app.post('/login', {
    preHandler: [adminLoginRateLimit],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    if (!email || !password) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Email and password are required' },
      });
    }

    const ip = request.ip ?? 'unknown';
    const result = adminLogin(email, password, ip);

    if (!result.success) {
      return reply.status(401).send({
        success: false,
        error: { code: 'LOGIN_FAILED', message: result.error ?? 'Invalid credentials' },
      });
    }

    return {
      success: true,
      data: {
        token: result.token,
        admin: {
          id: result.admin!.id,
          email: result.admin!.email,
          displayName: result.admin!.displayName,
          role: result.admin!.role,
          permissions: result.admin!.permissions,
        },
      },
    };
  });

  /**
   * POST /api/admin/auth/logout
   * Admin logout — invalidate session
   */
  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: { code: 'NO_TOKEN', message: 'Authorization required' },
      });
    }

    const token = authHeader.slice(7);

    // Find and invalidate session
    for (const [, session] of adminSessions) {
      if (session.isActive) {
        session.isActive = false;
      }
    }

    return { success: true, data: { message: 'Logged out successfully' } };
  });

  /**
   * GET /api/admin/auth/me
   * Get current admin user info
   */
  app.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string; email: string; displayName: string; role: string; permissions: string[] } }).adminUser;
    if (!adminUser) {
      return reply.status(401).send({
        success: false,
        error: { code: 'NO_AUTH', message: 'Authentication required' },
      });
    }

    return {
      success: true,
      data: {
        id: adminUser.id,
        email: adminUser.email,
        displayName: adminUser.displayName,
        role: adminUser.role,
        permissions: adminUser.permissions,
      },
    };
  });

  /**
   * GET /api/admin/auth/sessions
   * List active admin sessions (super_admin only)
   */
  app.get('/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const adminUser = (request as FastifyRequest & { adminUser?: { role: string } }).adminUser;
    if (!adminUser || adminUser.role !== 'super_admin') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Super admin required' },
      });
    }

    const activeSessions = Array.from(adminSessions.values())
      .filter((s) => s.isActive && s.expiresAt > new Date())
      .map((s) => ({
        id: s.id,
        adminUserId: s.adminUserId,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      }));

    return {
      success: true,
      data: activeSessions,
    };
  });
}
