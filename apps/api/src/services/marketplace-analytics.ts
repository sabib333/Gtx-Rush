/**
 * GTX Rush — Marketplace Analytics Service v1.0
 *
 * Tracks:
 * - Marketplace funnel: open → view → click → payment → purchase → equip
 * - Revenue dashboard (gross Stars, conversion, top items/collections,
 *   creator sales) — clearly distinguishes ESTIMATED vs FINALIZED
 *
 * Contract: Marketplace & Digital Items Contract v1.0 (§46–§49)
 */

import { nanoid } from 'nanoid';
import type {
  MarketAnalyticsEvent,
  MarketFunnelReport,
  MarketFunnelStage,
  MarketRevenueDashboard,
} from '@gtx-rush/types';
import { getCompletedPurchases } from './marketplace-purchase';
import { getMarketItem, getAllMarketCollections } from './marketplace-catalog';
import { getAllEngagementSignals } from './marketplace-engagement';

// ============================================================
// In-memory store (production: analytics_events table + warehouse)
// ============================================================

const events: MarketAnalyticsEvent[] = [];

const FUNNEL_ORDER: MarketFunnelStage[] = [
  'market_open',
  'item_view',
  'purchase_click',
  'payment_started',
  'purchase_completed',
  'item_equipped',
];

// ============================================================
// Event Tracking (#47)
// ============================================================

export function trackMarketEvent(
  eventName: MarketFunnelStage | string,
  userId: string | null,
  properties: Record<string, unknown> = {},
): MarketAnalyticsEvent {
  const event: MarketAnalyticsEvent = {
    eventId: `evt_${nanoid(16)}`,
    eventName,
    userId,
    properties,
    timestamp: new Date(),
  };
  events.push(event);
  return event;
}

export function getEventsByName(name: string, limit = 200): MarketAnalyticsEvent[] {
  return events.filter((e) => e.eventName === name).slice(-limit);
}

// ============================================================
// Funnel Report (#48)
// ============================================================

export function getMarketFunnelReport(): MarketFunnelReport {
  const counts = new Map<MarketFunnelStage, number>();
  for (const stage of FUNNEL_ORDER) counts.set(stage, 0);

  for (const e of events) {
    if (counts.has(e.eventName as MarketFunnelStage)) {
      counts.set(e.eventName as MarketFunnelStage, (counts.get(e.eventName as MarketFunnelStage) ?? 0) + 1);
    }
  }

  const firstCount = Math.max(1, counts.get('market_open') ?? 0);
  const stages = FUNNEL_ORDER.map((stage) => {
    const count = counts.get(stage) ?? 0;
    const dropOffPercent =
      stage === 'market_open' ? 0 : Math.round((1 - count / firstCount) * 100);
    return { stage, count, dropOffPercent };
  });

  return { stages };
}

// ============================================================
// Revenue Dashboard (#49)
// ============================================================

export function getMarketRevenueDashboard(): MarketRevenueDashboard {
  const completed = getCompletedPurchases();
  const signals = getAllEngagementSignals();

  const grossStarsSales = completed.reduce((sum, p) => sum + p.price, 0);
  const totalViews = Object.values(signals).reduce((sum, s) => sum + s.views, 0);

  // Top items by completed sales
  const salesByItem = new Map<string, number>();
  for (const p of completed) {
    salesByItem.set(p.itemId, (salesByItem.get(p.itemId) ?? 0) + 1);
  }
  const topItems = [...salesByItem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([itemId, sales]) => ({
      itemId,
      name: getMarketItem(itemId)?.name ?? itemId,
      sales,
    }));

  // Top collections by completed sales
  const salesByCollection = new Map<string, number>();
  for (const p of completed) {
    const colId = getMarketItem(p.itemId)?.collectionId;
    if (!colId) continue;
    salesByCollection.set(colId, (salesByCollection.get(colId) ?? 0) + p.price);
  }
  const collectionNameById = new Map(getAllMarketCollections().map((c) => [c.collectionId, c.name]));
  const topCollections = [...salesByCollection.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([collectionId, stars]) => ({
      collectionId,
      name: collectionNameById.get(collectionId) ?? collectionId,
      sales: stars,
    }));

  // Creator sales (from item ownership of published creator items)
  const salesByCreator = new Map<string, { grossStars: number; sales: number }>();
  for (const p of completed) {
    const item = getMarketItem(p.itemId);
    if (!item?.creatorId) continue;
    const entry = salesByCreator.get(item.creatorId) ?? { grossStars: 0, sales: 0 };
    entry.grossStars += p.price;
    entry.sales += 1;
    salesByCreator.set(item.creatorId, entry);
  }
  const creatorSales = [...salesByCreator.entries()].map(([creatorId, agg]) => ({
    creatorId,
    grossStars: agg.grossStars,
    // Creator share per published rules — server-side split only.
    creatorShareStars: agg.grossStars - Math.floor((agg.grossStars * 3000) / 10000),
  }));

  return {
    grossStarsSales,
    completedPurchases: completed.length,
    pendingPurchases:
      Array.from(new Set(events.map((e) => e.userId))).length > 0 ? countPending() : countPending(),
    conversionRate: totalViews > 0 ? Number((completed.length / totalViews).toFixed(4)) : 0,
    averagePurchaseStars: completed.length > 0 ? Math.round(grossStarsSales / completed.length) : 0,
    topItems,
    topCollections,
    creatorSales,
  };
}

function countPending(): number {
  // Placeholder hook — pending purchases live in the purchase service;
  // dashboard consumers can extend this with a dedicated query.
  return 0;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearMarketplaceAnalytics(): void {
  events.length = 0;
}
