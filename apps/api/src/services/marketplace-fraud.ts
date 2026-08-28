/**
 * GTX Rush — Marketplace Fraud Prevention & Audit Service v1.0
 *
 * Handles:
 * - Rate limiting (purchases, gifts, wishlist actions, search)
 * - Fraud case detection & tracking
 * - Immutable audit logs for sensitive marketplace actions
 *
 * SECURITY:
 * - Never trusts frontend inventory or payment state
 * - Every sensitive action is auditable
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import { nanoid } from 'nanoid';
import type { MarketFraudCase, MarketAuditLog } from '@gtx-rush/types';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM + Redis)
// ============================================================

const rateLimitWindows = new Map<string, number[]>(); // key → event timestamps
const fraudCases = new Map<string, MarketFraudCase>();
const auditLogs = new Map<string, MarketAuditLog>();

// ============================================================
// Rate Limiting (sliding window)
// ============================================================

/**
 * Check and record a rate-limited action.
 *
 * Used for: purchase creation, gift requests, wishlist actions,
 * favorite actions, and marketplace search.
 */
export function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const key = `${action}:${userId}`;
  const now = Date.now();
  const window = (rateLimitWindows.get(key) ?? []).filter((t) => now - t < windowMs);

  if (window.length >= limit) {
    const oldest = Math.min(...window);
    rateLimitWindows.set(key, window);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: windowMs - (now - oldest),
    };
  }

  window.push(now);
  rateLimitWindows.set(key, window);
  return { allowed: true, remaining: limit - window.length, retryAfterMs: 0 };
}

/** Read-only check without consuming quota. */
export function peekRateLimit(userId: string, action: string): number {
  const key = `${action}:${userId}`;
  return (rateLimitWindows.get(key) ?? []).length;
}

// ============================================================
// Fraud Cases
// ============================================================

export function flagFraudCase(
  userId: string,
  flagType: MarketFraudCase['flagType'],
  severity: MarketFraudCase['severity'],
  evidence: Record<string, unknown> = {},
): MarketFraudCase {
  const fraudCase: MarketFraudCase = {
    caseId: nanoid(),
    userId,
    flagType,
    severity,
    evidence,
    status: 'detected',
    createdAt: new Date(),
  };
  fraudCases.set(fraudCase.caseId, fraudCase);
  return fraudCase;
}

export function updateFraudCaseStatus(
  caseId: string,
  status: MarketFraudCase['status'],
): MarketFraudCase | null {
  const fraudCase = fraudCases.get(caseId);
  if (!fraudCase) return null;
  fraudCase.status = status;
  return fraudCase;
}

export function getUserFraudCases(userId: string): MarketFraudCase[] {
  return Array.from(fraudCases.values())
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Aggregate severity score used by purchase/gift flows to decide
 * whether to block an operation.
 */
export function getFraudRiskScore(userId: string): number {
  const cases = getUserFraudCases(userId).filter((c) => c.status !== 'dismissed');
  const weights = { low: 1, medium: 3, high: 6, critical: 10 } as const;
  let score = 0;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const fraudCase of cases) {
    if (fraudCase.createdAt.getTime() >= cutoff) {
      score += weights[fraudCase.severity];
    }
  }
  return score;
}

/** Risk above this blocks purchases/gifts pending review. */
export const FRAUD_BLOCK_THRESHOLD = 15;

export function isUserBlockedByFraud(userId: string): boolean {
  return getFraudRiskScore(userId) >= FRAUD_BLOCK_THRESHOLD;
}

// ============================================================
// Audit Logs
// ============================================================

/**
 * Record an immutable audit log entry for a sensitive action
 * (item create/edit/disable, price change, grants, moderation,
 * refunds, admin actions).
 */
export function recordAuditLog(
  actorId: string,
  action: string,
  targetType: 'item' | 'collection' | 'purchase' | 'transaction' | 'user_item' | 'creator_submission' | 'gift' | 'listing' | 'price',
  targetId: string,
  details: Record<string, unknown> = {},
): MarketAuditLog {
  const entry: MarketAuditLog = {
    auditId: nanoid(),
    actorId,
    action,
    targetType,
    targetId,
    details,
    createdAt: new Date(),
  };
  auditLogs.set(entry.auditId, entry);
  return entry;
}

export function getAuditLogs(options: {
  targetType?: string;
  targetId?: string;
  actorId?: string;
  limit?: number;
} = {}): MarketAuditLog[] {
  const { targetType, targetId, actorId, limit = 50 } = options;
  let logs = Array.from(auditLogs.values());

  if (targetType) logs = logs.filter((l) => l.targetType === targetType);
  if (targetId) logs = logs.filter((l) => l.targetId === targetId);
  if (actorId) logs = logs.filter((l) => l.actorId === actorId);

  return logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearMarketplaceFraud(): void {
  rateLimitWindows.clear();
  fraudCases.clear();
  auditLogs.clear();
}
