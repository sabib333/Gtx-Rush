/**
 * Security Audit Logger
 *
 * Records security-relevant events for monitoring and incident response.
 * Never logs: bot tokens, secrets, raw auth payloads.
 */

export type AuditEvent =
  | 'auth_success'
  | 'auth_failure'
  | 'auth_expired'
  | 'session_created'
  | 'session_refreshed'
  | 'deep_link_processed'
  | 'deep_link_invalid'
  | 'deep_link_abuse'
  | 'challenge_created'
  | 'challenge_accepted'
  | 'challenge_abuse'
  | 'referral_created'
  | 'referral_activated'
  | 'referral_abuse'
  | 'rate_limit_hit'
  | 'admin_action'
  | 'suspicious_activity';

interface AuditEntry {
  event: AuditEvent;
  timestamp: string;
  ip: string | null;
  userId: string | null;
  telegramId: number | null;
  details: Record<string, unknown>;
}

const auditLog: AuditEntry[] = [];
const MAX_LOG_SIZE = 10_000;

/**
 * Log a security-relevant event.
 */
export function auditLog_event(
  event: AuditEvent,
  context: {
    ip?: string | null;
    userId?: string | null;
    telegramId?: number | null;
    details?: Record<string, unknown>;
  } = {}
) {
  const entry: AuditEntry = {
    event,
    timestamp: new Date().toISOString(),
    ip: context.ip ?? null,
    userId: context.userId ?? null,
    telegramId: context.telegramId ?? null,
    details: context.details ?? {},
  };

  // Prevent log size bloat
  if (auditLog.length >= MAX_LOG_SIZE) {
    auditLog.shift();
  }
  auditLog.push(entry);

  // Console output for development
  const level = getLogLevel(event);
  const msg = `[AUDIT] ${event}`;
  const meta = {
    ip: entry.ip,
    userId: entry.userId,
    telegramId: entry.telegramId,
    ...entry.details,
  };

  switch (level) {
    case 'warn':
      console.warn(msg, meta);
      break;
    case 'error':
      console.error(msg, meta);
      break;
    default:
      console.log(msg, meta);
  }
}

function getLogLevel(event: AuditEvent): 'info' | 'warn' | 'error' {
  switch (event) {
    case 'auth_failure':
    case 'auth_expired':
    case 'deep_link_invalid':
    case 'deep_link_abuse':
    case 'challenge_abuse':
    case 'referral_abuse':
    case 'rate_limit_hit':
    case 'suspicious_activity':
      return 'warn';
    case 'admin_action':
      return 'error';
    default:
      return 'info';
  }
}

/**
 * Get recent audit entries (for admin review).
 */
export function getRecentAuditLogs(limit: number = 100): AuditEntry[] {
  return auditLog.slice(-limit);
}

/**
 * Get audit entries for a specific user.
 */
export function getUserAuditLogs(userId: string, limit: number = 50): AuditEntry[] {
  return auditLog
    .filter((e) => e.userId === userId)
    .slice(-limit);
}
