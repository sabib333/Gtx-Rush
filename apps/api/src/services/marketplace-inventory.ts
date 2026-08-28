/**
 * GTX Rush — Marketplace Inventory Service v1.0
 *
 * Server-authoritative ownership & equipment:
 * - Grant items (idempotent via reference key)
 * - Duplicate prevention for non-stackable items
 * - Equip / unequip with slot rules
 * - Ownership is NEVER client-authoritative
 *
 * SECURITY:
 * - Equipping requires server-side ownership validation
 * - Non-stackable items can only be owned once per user
 * - Every grant carries a traceable source + referenceId
 * - Refunds/revocations mark records — history is preserved
 *
 * Contract: Marketplace & Digital Items Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  MarketEquipmentSlot,
  MarketItem,
  MarketOwnershipSource,
  UserMarketItem,
  MarketInventoryResponse,
} from '@gtx-rush/types';
import {
  MARKETPLACE_LIMITS,
  MARKETPLACE_SLOT_RULES,
} from '@gtx-rush/config';
import { getMarketItem } from './marketplace-catalog';
import { recordItemEquipped } from './marketplace-engagement';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const ownership = new Map<string, UserMarketItem[]>(); // userId → items
const slotMap = new Map<string, Map<MarketEquipmentSlot, string | null>>(); // userId → slot → userItemId
const grantIndex = new Map<string, string>(); // idempotencyKey → userItemId

// ============================================================
// Grants
// ============================================================

export function grantMarketItem(
  userId: string,
  itemId: string,
  source: MarketOwnershipSource,
  options: {
    referenceId?: string;
    metadata?: Record<string, unknown>;
    /** Idempotency key — the same key never grants twice. */
    idempotencyKey?: string;
  } = {},
): { success: boolean; item?: UserMarketItem; error?: string } {
  const { referenceId = null, metadata = {}, idempotencyKey } = options;

  // Idempotency: same key → same single record (Contract rule #6)
  const key = idempotencyKey ?? `grant:${userId}:${itemId}:${source}:${referenceId ?? 'none'}`;
  const existingId = grantIndex.get(key);
  if (existingId) {
    for (const item of ownership.get(userId) ?? []) {
      if (item.userItemId === existingId) return { success: true, item };
    }
  }

  // Validate item exists in catalog (server-side only)
  const marketItem = getMarketItem(itemId);
  if (!marketItem) return { success: false, error: 'ITEM_NOT_FOUND' };

  const userItems = ownership.get(userId) ?? [];

  // Inventory cap
  if (userItems.length >= MARKETPLACE_LIMITS.maxInventorySize) {
    return { success: false, error: 'INVENTORY_FULL' };
  }

  // Duplicate prevention for non-stackable items (Contract rule #19)
  if (!marketItem.stackable && userItems.some((i) => i.itemId === itemId)) {
    const existing = userItems.find((i) => i.itemId === itemId)!;
    return { success: true, item: existing };
  }

  const record: UserMarketItem = {
    userItemId: nanoid(),
    userId,
    itemId,
    acquiredAt: new Date(),
    source,
    referenceId,
    status: 'owned',
    metadata,
  };

  userItems.push(record);
  ownership.set(userId, userItems);
  grantIndex.set(key, record.userItemId);

  return { success: true, item: record };
}

// ============================================================
// Queries
// ============================================================

function getOwnedRecords(userId: string): UserMarketItem[] {
  return (ownership.get(userId) ?? []).filter((i) => i.status === 'owned');
}

export function getOwnedItemIds(userId: string): Set<string> {
  return new Set(getOwnedRecords(userId).map((i) => i.itemId));
}

export function getOwnedRecord(
  userId: string,
  itemId: string,
): UserMarketItem | null {
  return getOwnedRecords(userId).find((i) => i.itemId === itemId) ?? null;
}

export function ownsMarketItem(userId: string, itemId: string): boolean {
  return getOwnedRecord(userId, itemId) !== null;
}

export function getInventory(userId: string): MarketInventoryResponse {
  const owned = [...getOwnedRecords(userId)].sort(
    (a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime(),
  );
  const slots = slotMap.get(userId);
  const equippedSlotMap: Record<string, string | undefined> = {};
  if (slots) {
    for (const [slot, userItemId] of slots.entries()) {
      if (userItemId) equippedSlotMap[slot] = userItemId;
    }
  }
  return { owned, equippedSlotMap, totalCount: owned.length };
}

// ============================================================
// Equipment Slots (one equipped item per slot, validated server-side)
// ============================================================

function slotForItemType(itemType: MarketItem['type']): MarketEquipmentSlot | null {
  for (const [slot, types] of Object.entries(MARKETPLACE_SLOT_RULES)) {
    if ((types as string[]).includes(itemType)) return slot as MarketEquipmentSlot;
  }
  return null;
}

export function equipMarketItem(
  userId: string,
  itemId: string,
): { success: boolean; error?: 'ITEM_NOT_FOUND' | 'NOT_OWNED' | 'NO_SLOT' } {
  // Server-side ownership validation — never trust client state.
  if (!ownsMarketItem(userId, itemId)) {
    const exists = getMarketItem(itemId);
    return { success: false, error: exists ? 'NOT_OWNED' : 'ITEM_NOT_FOUND' };
  }

  const item = getMarketItem(itemId)!;
  const slot = slotForItemType(item.type);
  if (!slot) return { success: false, error: 'NO_SLOT' };

  const record = getOwnedRecord(userId, itemId)!;

  let slots = slotMap.get(userId);
  if (!slots) {
    slots = new Map();
    slotMap.set(userId, slots);
  }
  slots.set(slot, record.userItemId);

  recordItemEquipped(itemId);
  return { success: true };
}

export function unequipMarketItem(
  userId: string,
  slot: MarketEquipmentSlot,
): { success: boolean; error?: 'NOT_EQUIPPED' } {
  const slots = slotMap.get(userId);
  if (!slots?.get(slot)) return { success: false, error: 'NOT_EQUIPPED' };
  slots.set(slot, null);
  return { success: true };
}

export function getEquippedLoadout(
  userId: string,
): Partial<Record<MarketEquipmentSlot, { itemId: string; name: string }>> {
  const loadout: Partial<Record<MarketEquipmentSlot, { itemId: string; name: string }>> = {};
  const slots = slotMap.get(userId);
  if (!slots) return loadout;

  for (const [slot, userItemId] of slots.entries()) {
    if (!userItemId) continue;
    const record = (ownership.get(userId) ?? []).find((i) => i.userItemId === userItemId);
    if (!record || record.status !== 'owned') continue;
    const item = getMarketItem(record.itemId);
    if (item) loadout[slot] = { itemId: item.itemId, name: item.name };
  }
  return loadout;
}

/** Called when an equipped item's ownership is refunded/revoked. */
function autoUnequip(userId: string, userItemId: string): void {
  const slots = slotMap.get(userId);
  if (!slots) return;
  for (const [slot, equippedId] of slots.entries()) {
    if (equippedId === userItemId) slots.set(slot, null);
  }
}

// ============================================================
// Refund / Revocation (history preserved — never deleted)
// ============================================================

export function revokeOwnership(
  userId: string,
  itemId: string,
  status: 'refunded' | 'revoked',
): { success: boolean; record?: UserMarketItem; error?: 'NOT_OWNED' } {
  const all = ownership.get(userId) ?? [];
  const record = [...all]
    .reverse()
    .find((i) => i.itemId === itemId && i.status === 'owned');
  if (!record) return { success: false, error: 'NOT_OWNED' };

  record.status = status;
  autoUnequip(userId, record.userItemId);
  return { success: true, record };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearMarketplaceInventory(): void {
  ownership.clear();
  slotMap.clear();
  grantIndex.clear();
}
