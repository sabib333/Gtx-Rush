/**
 * GTX Rush — Monetization Analytics v1.0
 *
 * Tracks monetization-specific analytics events per the Monetization Contract.
 *
 * Events:
 * - store_opened
 * - product_viewed
 * - purchase_started
 * - purchase_completed
 * - purchase_failed
 * - purchase_refunded
 * - ad_requested
 * - ad_started
 * - ad_completed
 * - ad_reward_granted
 * - ad_failed
 * - premium_viewed
 * - premium_started
 * - inventory_viewed
 * - cosmetic_equipped
 *
 * SECURITY: Analytics events must not contain sensitive data.
 * User IDs are stored separately from event properties.
 */

import { nanoid } from 'nanoid';
import type { MonetizationAnalyticsEvent, MonetizationAnalyticsData } from '@gtx-rush/types';

// ============================================================
// In-memory store (production: PostgreSQL analytics_events table)
// ============================================================

interface AnalyticsRecord {
  id: string;
  eventName: MonetizationAnalyticsEvent;
  userId: string;
  properties: Record<string, unknown>;
  createdAt: Date;
}

const analyticsStore = new Map<string, AnalyticsRecord>();

// ============================================================
// Event Tracking
// ============================================================

/**
 * Track a monetization analytics event.
 */
export function trackMonetizationEvent(
  eventName: MonetizationAnalyticsEvent,
  userId: string,
  properties: Record<string, unknown>,
): void {
  const record: AnalyticsRecord = {
    id: nanoid(),
    eventName,
    userId,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
    },
    createdAt: new Date(),
  };

  analyticsStore.set(record.id, record);

  // In production, also insert into PostgreSQL analytics_events table
  // await db.insert(analyticsEvents).values({ ... });
}

// ============================================================
// Store Events
// ============================================================

export function trackStoreOpened(
  userId: string,
  section: string,
): void {
  trackMonetizationEvent('store_opened', userId, {
    section,
  });
}

export function trackProductViewed(
  userId: string,
  productId: string,
  productName: string,
  productType: string,
  priceStars: number,
): void {
  trackMonetizationEvent('product_viewed', userId, {
    productId,
    productName,
    productType,
    priceStars,
  });
}

// ============================================================
// Purchase Events
// ============================================================

export function trackPurchaseStarted(
  userId: string,
  productId: string,
  productName: string,
  priceStars: number,
): void {
  trackMonetizationEvent('purchase_started', userId, {
    productId,
    productName,
    priceStars,
  });
}

export function trackPurchaseCompleted(
  userId: string,
  productId: string,
  productName: string,
  priceStars: number,
  purchaseId: string,
): void {
  trackMonetizationEvent('purchase_completed', userId, {
    productId,
    productName,
    priceStars,
    purchaseId,
  });
}

export function trackPurchaseFailed(
  userId: string,
  productId: string,
  reason: string,
): void {
  trackMonetizationEvent('purchase_failed', userId, {
    productId,
    reason,
  });
}

export function trackPurchaseRefunded(
  userId: string,
  productId: string,
  purchaseId: string,
  reason: string,
): void {
  trackMonetizationEvent('purchase_refunded', userId, {
    productId,
    purchaseId,
    reason,
  });
}

// ============================================================
// Ad Events
// ============================================================

export function trackAdRequested(
  userId: string,
  adType: string,
  placement: string,
): void {
  trackMonetizationEvent('ad_requested', userId, {
    adType,
    placement,
  });
}

export function trackAdStarted(
  userId: string,
  adId: string,
  adType: string,
  placement: string,
): void {
  trackMonetizationEvent('ad_started', userId, {
    adId,
    adType,
    placement,
  });
}

export function trackAdCompleted(
  userId: string,
  adId: string,
  adType: string,
  placement: string,
  duration: number,
): void {
  trackMonetizationEvent('ad_completed', userId, {
    adId,
    adType,
    placement,
    duration,
  });
}

export function trackAdRewardGranted(
  userId: string,
  adId: string,
  rewardType: string,
  rewardAmount: number,
): void {
  trackMonetizationEvent('ad_reward_granted', userId, {
    adId,
    rewardType,
    rewardAmount,
  });
}

export function trackAdFailed(
  userId: string,
  adId: string,
  reason: string,
): void {
  trackMonetizationEvent('ad_failed', userId, {
    adId,
    reason,
  });
}

// ============================================================
// Premium Events
// ============================================================

export function trackPremiumViewed(
  userId: string,
  section: string,
): void {
  trackMonetizationEvent('premium_viewed', userId, {
    section,
  });
}

export function trackPremiumStarted(
  userId: string,
  planId: string,
  planName: string,
  priceStars: number,
): void {
  trackMonetizationEvent('premium_started', userId, {
    planId,
    planName,
    priceStars,
  });
}

// ============================================================
// Inventory Events
// ============================================================

export function trackInventoryViewed(
  userId: string,
  itemCount: number,
): void {
  trackMonetizationEvent('inventory_viewed', userId, {
    itemCount,
  });
}

export function trackCosmeticEquipped(
  userId: string,
  productId: string,
  productName: string,
  category: string,
): void {
  trackMonetizationEvent('cosmetic_equipped', userId, {
    productId,
    productName,
    category,
  });
}

// ============================================================
// Analytics Queries (for admin/future use)
// ============================================================

/**
 * Get analytics records by event name.
 */
export function getMonetizationAnalyticsByEvent(
  eventName: MonetizationAnalyticsEvent,
  options: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    limit?: number;
  } = {},
): AnalyticsRecord[] {
  const { startDate, endDate, userId, limit = 100 } = options;

  const records: AnalyticsRecord[] = [];
  for (const record of analyticsStore.values()) {
    if (record.eventName !== eventName) continue;
    if (startDate && record.createdAt < startDate) continue;
    if (endDate && record.createdAt > endDate) continue;
    if (userId && record.userId !== userId) continue;
    records.push(record);
  }

  records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return records.slice(0, limit);
}

/**
 * Get aggregate counts for a monetization event.
 */
export function getMonetizationEventAggregate(
  eventName: MonetizationAnalyticsEvent,
  startDate: Date,
  endDate: Date,
): {
  count: number;
  uniqueUsers: number;
} {
  const records = getMonetizationAnalyticsByEvent(eventName, {
    startDate,
    endDate,
    limit: 10000,
  });

  const uniqueUsers = new Set(records.map((r) => r.userId));

  return {
    count: records.length,
    uniqueUsers: uniqueUsers.size,
  };
}

/**
 * Get user monetization metrics.
 */
export function getUserMonetizationMetrics(
  userId: string,
  days: number = 30,
): {
  totalStoreViews: number;
  totalProductsViewed: number;
  totalPurchasesStarted: number;
  totalPurchasesCompleted: number;
  totalAdsWatched: number;
  totalAdRewards: number;
} {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days);

  return {
    totalStoreViews: getMonetizationAnalyticsByEvent('store_opened', { userId, startDate, limit: 10000 }).length,
    totalProductsViewed: getMonetizationAnalyticsByEvent('product_viewed', { userId, startDate, limit: 10000 }).length,
    totalPurchasesStarted: getMonetizationAnalyticsByEvent('purchase_started', { userId, startDate, limit: 10000 }).length,
    totalPurchasesCompleted: getMonetizationAnalyticsByEvent('purchase_completed', { userId, startDate, limit: 10000 }).length,
    totalAdsWatched: getMonetizationAnalyticsByEvent('ad_completed', { userId, startDate, limit: 10000 }).length,
    totalAdRewards: getMonetizationAnalyticsByEvent('ad_reward_granted', { userId, startDate, limit: 10000 }).length,
  };
}

/**
 * Get conversion funnel metrics.
 */
export function getConversionFunnelMetrics(
  startDate: Date,
  endDate: Date,
): {
  storeViews: number;
  productViews: number;
  purchaseStarts: number;
  purchaseCompletions: number;
  conversionRate: number;
} {
  const storeViews = getMonetizationEventAggregate('store_opened', startDate, endDate).count;
  const productViews = getMonetizationEventAggregate('product_viewed', startDate, endDate).count;
  const purchaseStarts = getMonetizationEventAggregate('purchase_started', startDate, endDate).count;
  const purchaseCompletions = getMonetizationEventAggregate('purchase_completed', startDate, endDate).count;

  const conversionRate = purchaseStarts > 0 ? purchaseCompletions / purchaseStarts : 0;

  return {
    storeViews,
    productViews,
    purchaseStarts,
    purchaseCompletions,
    conversionRate,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearMonetizationAnalytics(): void {
  analyticsStore.clear();
}

export function _getMonetizationAnalyticsCount(): number {
  return analyticsStore.size;
}
