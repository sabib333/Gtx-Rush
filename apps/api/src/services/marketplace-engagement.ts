/**
 * GTX Rush — Marketplace Engagement Service v1.0
 *
 * Tracks per-item engagement signals:
 * - views, purchaseClicks, purchases, equips, favorites
 *
 * Used by:
 * - Trending (multi-signal — NEVER purchases alone)
 * - Marketplace analytics funnel
 * - Wishlist availability notifications
 *
 * SECURITY:
 * - Signals are recorded server-side only
 * - Rate-limited at the route layer (see marketplace-fraud)
 * - Fake favorites/farming is mitigated by rate limits + fraud engine
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import type { MarketEngagementSignals } from '@gtx-rush/types';

// ============================================================
// In-memory store (production: PostgreSQL via Drizzle ORM + Redis)
// ============================================================

const signals = new Map<string, MarketEngagementSignals & { lastEventAt: Date | null }>();

function getOrCreate(itemId: string): MarketEngagementSignals & { lastEventAt: Date | null } {
  let s = signals.get(itemId);
  if (!s) {
    s = {
      views: 0,
      purchaseClicks: 0,
      purchases: 0,
      equips: 0,
      favorites: 0,
      lastEventAt: null,
    };
    signals.set(itemId, s);
  }
  return s;
}

function touch(itemId: string): void {
  const s = getOrCreate(itemId);
  s.lastEventAt = new Date();
}

// ============================================================
// Signal Recording
// ============================================================

export function recordItemView(itemId: string): void {
  getOrCreate(itemId).views += 1;
  touch(itemId);
}

export function recordPurchaseClick(itemId: string): void {
  getOrCreate(itemId).purchaseClicks += 1;
  touch(itemId);
}

export function recordPurchaseCompleted(itemId: string): void {
  getOrCreate(itemId).purchases += 1;
  touch(itemId);
}

export function recordItemEquipped(itemId: string): void {
  getOrCreate(itemId).equips += 1;
  touch(itemId);
}

export function recordFavoriteAdded(itemId: string): void {
  getOrCreate(itemId).favorites += 1;
  touch(itemId);
}

export function recordFavoriteRemoved(itemId: string): void {
  const s = getOrCreate(itemId);
  s.favorites = Math.max(0, s.favorites - 1);
  touch(itemId);
}

// ============================================================
// Queries
// ============================================================

export function getItemEngagementSignals(
  itemId: string,
): MarketEngagementSignals & { lastEventAt: Date | null } {
  const s = signals.get(itemId);
  return {
    views: s?.views ?? 0,
    purchaseClicks: s?.purchaseClicks ?? 0,
    purchases: s?.purchases ?? 0,
    equips: s?.equips ?? 0,
    favorites: s?.favorites ?? 0,
    lastEventAt: s?.lastEventAt ?? null,
  };
}

export function getAllEngagementSignals(): Record<
  string,
  MarketEngagementSignals & { lastEventAt: Date | null }
> {
  const out: Record<string, MarketEngagementSignals & { lastEventAt: Date | null }> = {};
  for (const [itemId, s] of signals.entries()) {
    out[itemId] = { ...s };
  }
  return out;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearMarketplaceEngagement(): void {
  signals.clear();
}
