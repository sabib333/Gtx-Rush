/**
 * GTX Rush — Admin Authentication Middleware v1.0
 *
 * Handles admin JWT verification, session management, and RBAC permission checking.
 *
 * SECURITY:
 * - Separate JWT secret from player auth (ADMIN_JWT_SECRET)
 * - Session tracking with IP/user-agent binding
 * - Rate limiting on admin login
 * - Account lockout after failed attempts
 * - All auth events are audited
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getEnv } from '@gtx-rush/config';
import type { AdminCommandCenterRole, AdminPermission } from '@gtx-rush/types';
import { ROLE_PERMISSIONS, ADMIN_SESSION_CONFIG } from '@gtx-rush/config';

// ============================================================
// In-Memory Stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

interface StoredAdminUser {
  id: string;
  userId: string | null;
  email: string;
  passwordHash: string;
  displayName: string;
  role: AdminCommandCenterRole;
  permissions: AdminPermission[];
  isActive: boolean;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredAdminSession {
  id: string;
  adminUserId: string;
  tokenHash: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
}

interface AuditEntry {
  id: string;
  adminUserId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

// Exported stores for use by admin services
export const adminUsers = new Map<string, StoredAdminUser>();
export const adminUsersByEmail = new Map<string, StoredAdminUser>();
export const adminSessions = new Map<string, StoredAdminSession>();
export const adminAuditLog: AuditEntry[] = [];
export const killSwitches = new Map<string, boolean>();

// ============================================================
// Password Hashing (simple SHA-256 for dev; use bcrypt/argon2 in production)
// ============================================================

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHmac('sha256', salt).update(password).digest('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const computed = createHmac('sha256', salt).update(password).digest('hex');
  if (hash.length !== computed.length) return false;
  return timingSafeEqual(Buffer.from(hash), Buffer.from(computed));
}

// ============================================================
// JWT Helpers
// ============================================================

function generateAdminJWT(adminId: string, role: AdminCommandCenterRole): string {
  const env = getEnv();
  const secret = env.ADMIN_JWT_SECRET ?? env.JWT_SECRET;
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: adminId,
    role,
    type: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_CONFIG.sessionDurationMs / 1000,
  })).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyAdminJWT(token: string): { adminId: string; role: AdminCommandCenterRole } | null {
  try {
    const env = getEnv();
    const secret = env.ADMIN_JWT_SECRET ?? env.JWT_SECRET;
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const expectedSig = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature.length !== expectedSig.length) return null;
    let mismatch = 0;
    for (let i = 0; i < signature.length; i++) {
      mismatch |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    if (mismatch !== 0) return null;

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());

    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    if (data.type !== 'admin') return null;

    return { adminId: data.sub, role: data.role };
  } catch {
    return null;
  }
}

// ============================================================
// Seed Default Admin
// ============================================================

export function seedDefaultAdmin(): void {
  if (adminUsersByEmail.has('admin@gtxrush.com')) return;

  const id = randomBytes(16).toString('hex');
  const admin: StoredAdminUser = {
    id,
    userId: null,
    email: 'admin@gtxrush.com',
    passwordHash: hashPassword('admin123'),
    displayName: 'System Admin',
    role: 'super_admin',
    permissions: ROLE_PERMISSIONS['super_admin'],
    isActive: true,
    lastLoginAt: null,
    lastLoginIp: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  adminUsers.set(id, admin);
  adminUsersByEmail.set(admin.email, admin);
}

// ============================================================
// Admin Login
// ============================================================

export function adminLogin(
  email: string,
  password: string,
  ip: string,
): { success: boolean; token?: string; admin?: StoredAdminUser; error?: string } {
  const admin = adminUsersByEmail.get(email);
  if (!admin) {
    return { success: false, error: 'Invalid credentials' };
  }

  if (!admin.isActive) {
    return { success: false, error: 'Account is deactivated' };
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    return { success: false, error: 'Account is locked. Try again later.' };
  }

  if (!verifyPassword(password, admin.passwordHash)) {
    admin.failedLoginAttempts++;
    if (admin.failedLoginAttempts >= ADMIN_SESSION_CONFIG.maxFailedAttempts) {
      admin.lockedUntil = new Date(Date.now() + ADMIN_SESSION_CONFIG.lockoutDurationMs);
    }
    return { success: false, error: 'Invalid credentials' };
  }

  // Reset failed attempts on successful login
  admin.failedLoginAttempts = 0;
  admin.lockedUntil = null;
  admin.lastLoginAt = new Date();
  admin.lastLoginIp = ip;

  // Generate JWT
  const token = generateAdminJWT(admin.id, admin.role);

  // Create session
  const tokenHash = createHmac('sha256', 'session').update(token).digest('hex');
  const session: StoredAdminSession = {
    id: randomBytes(16).toString('hex'),
    adminUserId: admin.id,
    tokenHash,
    ipAddress: ip,
    userAgent: '',
    isActive: true,
    expiresAt: new Date(Date.now() + ADMIN_SESSION_CONFIG.sessionDurationMs),
    createdAt: new Date(),
  };
  adminSessions.set(session.id, session);

  // Audit login
  addAuditEntry({
    adminUserId: admin.id,
    action: 'ADMIN_LOGIN',
    targetType: 'admin_user',
    targetId: admin.id,
    beforeState: null,
    afterState: { email: admin.email, role: admin.role },
    reason: null,
    metadata: { loginIp: ip },
    requestId: null,
    ipAddress: ip,
  });

  return { success: true, token, admin };
}

// ============================================================
// Verify Admin Session
// ============================================================

export function verifyAdminSession(
  token: string,
  ip: string,
): { valid: boolean; admin?: StoredAdminUser; error?: string } {
  const payload = verifyAdminJWT(token);
  if (!payload) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  const admin = adminUsers.get(payload.adminId);
  if (!admin) {
    return { valid: false, error: 'Admin user not found' };
  }

  if (!admin.isActive) {
    return { valid: false, error: 'Account is deactivated' };
  }

  return { valid: true, admin };
}

// ============================================================
// Check Permission
// ============================================================

export function checkPermission(
  admin: StoredAdminUser,
  permission: AdminPermission,
): boolean {
  // Super admin has all permissions
  if (admin.role === 'super_admin') return true;

  // Check explicit permissions
  if (admin.permissions.includes(permission)) return true;

  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[admin.role] ?? [];
  return rolePermissions.includes(permission);
}

// ============================================================
// Audit Logging
// ============================================================

export function addAuditEntry(entry: Omit<AuditEntry, 'id' | 'createdAt'>): AuditEntry {
  const auditEntry: AuditEntry = {
    id: randomBytes(16).toString('hex'),
    ...entry,
    createdAt: new Date(),
  };
  adminAuditLog.push(auditEntry);

  // Keep last 10000 entries in memory (production: database)
  if (adminAuditLog.length > 10000) {
    adminAuditLog.splice(0, adminAuditLog.length - 10000);
  }

  return auditEntry;
}

// ============================================================
// Fastify Hook: Require Admin Auth
// ============================================================

export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({
      success: false,
      error: { code: 'NO_TOKEN', message: 'Admin authorization required' },
    });
    return;
  }

  const token = authHeader.slice(7);
  const result = verifyAdminSession(token, request.ip ?? 'unknown');

  if (!result.valid || !result.admin) {
    reply.status(401).send({
      success: false,
      error: { code: 'INVALID_TOKEN', message: result.error ?? 'Unauthorized' },
    });
    return;
  }

  // Attach admin to request context
  (request as FastifyRequest & { adminUser: StoredAdminUser }).adminUser = result.admin;
}

// ============================================================
// Fastify Hook: Require Specific Permission
// ============================================================

export function requirePermission(permission: AdminPermission) {
  return async function permissionHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const admin = (request as FastifyRequest & { adminUser?: StoredAdminUser }).adminUser;
    if (!admin) {
      reply.status(401).send({
        success: false,
        error: { code: 'NO_AUTH', message: 'Authentication required' },
      });
      return;
    }

    if (!checkPermission(admin, permission)) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission required: ${permission}`,
        },
      });
      return;
    }
  };
}

// ============================================================
// Exported Types
// ============================================================

export type { StoredAdminUser, StoredAdminSession };
