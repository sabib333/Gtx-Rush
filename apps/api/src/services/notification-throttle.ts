/**
 * GTX Rush — Growth Notification Throttle v1.0
 *
 * Growth notifications are a tool, not a spam channel.
 *
 * Enforces (Growth Engine Contract §27):
 * - Per-hour limit
 * - Per-day limit
 * - Per-category daily limit
 * - User preferences always win
 *
 * Only send when there is genuine relevance (§26, §28).
 */

// ============================================================
// Configuration
// ============================================================

export const NOTIFICATION_THROTTLE_CONFIG = {
  maxPerHour: 3,
  maxPerDay: 8,
  categoryDailyLimits: {
    challenge: 3,
    team: 2,
    event: 2,
    referral: 2,
    creator: 1,
    re_engagement: 1,
  } as Record<string, number>,
};

export type NotificationCategory =
  | 'challenge'
  | 'team'
  | 'event'
  | 'referral'
  | 'creator'
  | 're_engagement';

// ============================================================
// In-memory stores (production: Redis or PostgreSQL)
// ============================================================

interface SentRecord {
  timestamp: number;
  category: NotificationCategory;
}

const sentNotifications = new Map<string, SentRecord[]>(); // userId → records
const userPreferences = new Map<
  string,
  { enabled: boolean; mutedCategories: NotificationCategory[] }
>();

// ============================================================
// Preferences
// ============================================================

/**
 * Set user notification preferences. Preferences ALWAYS override
 * any growth trigger.
 */
export function setUserNotificationPreferences(
  userId: string,
  preferences: { enabled: boolean; mutedCategories?: NotificationCategory[] },
): void {
  userPreferences.set(userId, {
    enabled: preferences.enabled,
    mutedCategories: preferences.mutedCategories ?? [],
  });
}

function getPreferences(userId: string) {
  return (
    userPreferences.get(userId) ?? { enabled: true, mutedCategories: [] }
  );
}

// ============================================================
// Throttle Check
// ============================================================

export interface ThrottleDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Check whether a notification may be sent right now.
 * Call BEFORE sending; recordNotification after actually sending.
 */
export function canSendNotification(
  userId: string,
  category: NotificationCategory,
  now: number = Date.now(),
): ThrottleDecision {
  const prefs = getPreferences(userId);
  if (!prefs.enabled) {
    return { allowed: false, reason: 'USER_OPTED_OUT' };
  }
  if (prefs.mutedCategories.includes(category)) {
    return { allowed: false, reason: 'CATEGORY_MUTED' };
  }

  const records = sentNotifications.get(userId) ?? [];
  const oneHourAgo = now - 60 * 60 * 1000;
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  const lastHour = records.filter((r) => r.timestamp > oneHourAgo);
  if (lastHour.length >= NOTIFICATION_THROTTLE_CONFIG.maxPerHour) {
    return { allowed: false, reason: 'HOURLY_LIMIT_REACHED' };
  }

  const today = records.filter((r) => r.timestamp >= dayStart.getTime());
  if (today.length >= NOTIFICATION_THROTTLE_CONFIG.maxPerDay) {
    return { allowed: false, reason: 'DAILY_LIMIT_REACHED' };
  }

  const categoryLimit =
    NOTIFICATION_THROTTLE_CONFIG.categoryDailyLimits[category] ?? 1;
  const categoryToday = today.filter((r) => r.category === category);
  if (categoryToday.length >= categoryLimit) {
    return { allowed: false, reason: 'CATEGORY_DAILY_LIMIT_REACHED' };
  }

  return { allowed: true };
}

/**
 * Record that a notification was actually sent.
 */
export function recordNotification(
  userId: string,
  category: NotificationCategory,
  now: number = Date.now(),
): void {
  const records = sentNotifications.get(userId) ?? [];
  records.push({ timestamp: now, category });
  sentNotifications.set(userId, records);

  // Prune records older than 48h to keep memory bounded
  const cutoff = now - 48 * 60 * 60 * 1000;
  sentNotifications.set(
    userId,
    records.filter((r) => r.timestamp > cutoff),
  );
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearNotificationThrottle(): void {
  sentNotifications.clear();
  userPreferences.clear();
}
