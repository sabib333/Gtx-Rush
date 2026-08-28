/**
 * GTX Rush — Economy Analytics Service v1.0
 *
 * Analytics tracking for:
 * - XP grants
 * - Level ups
 * - Item acquisitions
 * - Equipment changes
 * - Purchases
 * - Reward claims
 *
 * Contract: Economy Engine Contract v1.0
 */

import type {
  ItemType,
  RewardSource,
  EconomyAnalytics,
} from '@gtx-rush/types';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const economyEvents = new Map<string, EconomyEvent[]>();
const dailyMetrics = new Map<string, DailyMetrics>();

// ============================================================
// Types
// ============================================================

interface EconomyEvent {
  type: 'xp_granted' | 'level_up' | 'item_granted' | 'item_equipped' | 'item_unequipped' | 'reward_claimed' | 'purchase_created' | 'purchase_confirmed' | 'purchase_rejected' | 'reward_reversed';
  userId: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

interface DailyMetrics {
  date: string;
  xpIssued: number;
  rewardsIssued: number;
  itemsAcquired: number;
  purchases: number;
  anomalies: number;
}

// ============================================================
// Event Tracking
// ============================================================

/**
 * Track an economy event
 */
export function trackEconomyEvent(
  userId: string,
  eventType: EconomyEvent['type'],
  metadata: Record<string, unknown> = {},
): void {
  const events = economyEvents.get(userId) ?? [];
  events.push({
    type: eventType,
    userId,
    metadata,
    timestamp: new Date(),
  });
  economyEvents.set(userId, events);

  // Update daily metrics
  const today = new Date().toISOString().slice(0, 10);
  const metrics = dailyMetrics.get(today) ?? {
    date: today,
    xpIssued: 0,
    rewardsIssued: 0,
    itemsAcquired: 0,
    purchases: 0,
    anomalies: 0,
  };

  switch (eventType) {
    case 'xp_granted':
      metrics.xpIssued += (metadata.amount as number) ?? 0;
      break;
    case 'level_up':
      metrics.rewardsIssued += 1;
      break;
    case 'item_granted':
      metrics.itemsAcquired += 1;
      break;
    case 'purchase_confirmed':
      metrics.purchases += 1;
      break;
  }

  dailyMetrics.set(today, metrics);
}

// ============================================================
// Analytics Queries
// ============================================================

/**
 * Get user economy stats
 */
export function getUserEconomyStats(userId: string): {
  totalEvents: number;
  xpGranted: number;
  itemsAcquired: number;
  levelUps: number;
  purchases: number;
  lastActivity: Date | null;
} {
  const events = economyEvents.get(userId) ?? [];

  const xpGranted = events
    .filter((e) => e.type === 'xp_granted')
    .reduce((sum, e) => sum + ((e.metadata.amount as number) ?? 0), 0);

  const itemsAcquired = events.filter((e) => e.type === 'item_granted').length;
  const levelUps = events.filter((e) => e.type === 'level_up').length;
  const purchases = events.filter((e) => e.type === 'purchase_confirmed').length;
  const lastEvent = events[events.length - 1];
  const lastActivity = lastEvent?.timestamp ?? null;

  return {
    totalEvents: events.length,
    xpGranted,
    itemsAcquired,
    levelUps,
    purchases,
    lastActivity,
  };
}

/**
 * Get daily metrics
 */
export function getDailyMetrics(date?: string): DailyMetrics {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  return dailyMetrics.get(targetDate) ?? {
    date: targetDate,
    xpIssued: 0,
    rewardsIssued: 0,
    itemsAcquired: 0,
    purchases: 0,
    anomalies: 0,
  };
}

/**
 * Get economy analytics
 */
export function getEconomyAnalytics(): EconomyAnalytics {
  const today = new Date().toISOString().slice(0, 10);
  const metrics = getDailyMetrics(today);

  // Get top items
  const allEvents = Array.from(economyEvents.values()).flat();
  const itemCounts = new Map<string, number>();
  for (const event of allEvents) {
    if (event.type === 'item_granted') {
      const itemId = event.metadata.itemId as string;
      itemCounts.set(itemId, (itemCounts.get(itemId) ?? 0) + 1);
    }
  }

  const topItems = Array.from(itemCounts.entries())
    .map(([itemId, acquisitions]) => ({
      itemId,
      name: itemId, // Would lookup from catalog in production
      acquisitions,
    }))
    .sort((a, b) => b.acquisitions - a.acquisitions)
    .slice(0, 10);

  return {
    dailyXpIssued: metrics.xpIssued,
    dailyRewardsIssued: metrics.rewardsIssued,
    dailyItemsAcquired: metrics.itemsAcquired,
    topItems,
    purchaseVolume: metrics.purchases,
    anomalyCount: metrics.anomalies,
  };
}

/**
 * Get economy trends
 */
export function getEconomyTrends(days: number = 7): {
  date: string;
  xpIssued: number;
  itemsAcquired: number;
  purchases: number;
}[] {
  const trends: { date: string; xpIssued: number; itemsAcquired: number; purchases: number }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const metrics = getDailyMetrics(dateStr);

    trends.push({
      date: dateStr,
      xpIssued: metrics.xpIssued,
      itemsAcquired: metrics.itemsAcquired,
      purchases: metrics.purchases,
    });
  }

  return trends;
}

/**
 * Get top earners
 */
export function getTopEarners(limit: number = 10): { userId: string; xp: number }[] {
  const userXp = new Map<string, number>();

  for (const [userId, events] of economyEvents.entries()) {
    const xp = events
      .filter((e) => e.type === 'xp_granted')
      .reduce((sum, e) => sum + ((e.metadata.amount as number) ?? 0), 0);

    if (xp > 0) {
      userXp.set(userId, xp);
    }
  }

  return Array.from(userXp.entries())
    .map(([userId, xp]) => ({ userId, xp }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

/**
 * Get top collectors
 */
export function getTopCollectors(limit: number = 10): { userId: string; items: number }[] {
  const userItems = new Map<string, number>();

  for (const [userId, events] of economyEvents.entries()) {
    const items = events.filter((e) => e.type === 'item_granted').length;
    if (items > 0) {
      userItems.set(userId, items);
    }
  }

  return Array.from(userItems.entries())
    .map(([userId, items]) => ({ userId, items }))
    .sort((a, b) => b.items - a.items)
    .slice(0, limit);
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllAnalytics(): void {
  economyEvents.clear();
  dailyMetrics.clear();
}
