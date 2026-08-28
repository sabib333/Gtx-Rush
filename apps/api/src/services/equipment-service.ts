/**
 * GTX Rush — Equipment Service v1.0
 *
 * Server-authoritative equipment system that handles:
 * - Item equipping/unequipping
 * - Loadout management
 * - Slot validation
 *
 * SECURITY:
 * - All equipment changes are server-side
 * - Users can only equip items they own
 * - Slot limits are enforced
 *
 * Contract: Economy Engine Contract v1.0
 */

import type {
  EconomyEquipmentSlot,
  EconomyEquipmentLoadout,
  EconomyInventoryItemWithDetails,
} from '@gtx-rush/types';
import {
  EQUIPMENT_CONFIG,
  ECONOMY_FLAGS,
  getCatalogItem,
} from '@gtx-rush/config';
import {
  userOwnsItem,
  getInventoryItemWithDetails,
  getUserInventoryByType,
} from './inventory-service';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const userEquipment = new Map<string, EconomyEquipmentLoadout>();

// ============================================================
// Equipment Management
// ============================================================

/**
 * Equip an item
 *
 * SECURITY:
 * - Validates user owns the item
 * - Validates item type matches slot
 * - Enforces slot limits
 * - Server-authoritative
 */
export function equipItem(
  userId: string,
  slot: EconomyEquipmentSlot,
  itemId: string,
): { success: boolean; loadout?: EconomyEquipmentLoadout; error?: string } {
  if (!ECONOMY_FLAGS.equipment_enabled) {
    return { success: false, error: 'EQUIPMENT_DISABLED' };
  }

  // Validate user owns the item
  if (!userOwnsItem(userId, itemId)) {
    return { success: false, error: 'ITEM_NOT_OWNED' };
  }

  // Get item details
  const itemDetails = getInventoryItemWithDetails(userId, itemId);
  if (!itemDetails) {
    return { success: false, error: 'ITEM_NOT_FOUND' };
  }

  // Validate item type matches slot
  const slotTypeMap: Record<EconomyEquipmentSlot, string[]> = {
    profile_frame: ['profile_frame'],
    title: ['title'],
    avatar_effect: ['avatar_effect', 'cosmetic'],
    name_effect: ['name_effect', 'cosmetic'],
  };

  if (!slotTypeMap[slot]?.includes(itemDetails.itemType)) {
    return { success: false, error: 'INVALID_SLOT_FOR_ITEM' };
  }

  // Get current loadout
  const loadout = getLoadout(userId);

  // Equip item
  switch (slot) {
    case 'profile_frame':
      loadout.profileFrame = itemDetails;
      break;
    case 'title':
      loadout.title = itemDetails;
      break;
    case 'avatar_effect':
      loadout.avatarEffect = itemDetails;
      break;
    case 'name_effect':
      loadout.nameEffect = itemDetails;
      break;
  }

  // Save loadout
  userEquipment.set(userId, loadout);

  return { success: true, loadout };
}

/**
 * Unequip an item from a slot
 */
export function unequipItem(
  userId: string,
  slot: EconomyEquipmentSlot,
): { success: boolean; loadout?: EconomyEquipmentLoadout; error?: string } {
  if (!ECONOMY_FLAGS.equipment_enabled) {
    return { success: false, error: 'EQUIPMENT_DISABLED' };
  }

  const loadout = getLoadout(userId);

  switch (slot) {
    case 'profile_frame':
      loadout.profileFrame = null;
      break;
    case 'title':
      loadout.title = null;
      break;
    case 'avatar_effect':
      loadout.avatarEffect = null;
      break;
    case 'name_effect':
      loadout.nameEffect = null;
      break;
  }

  userEquipment.set(userId, loadout);

  return { success: true, loadout };
}

/**
 * Get user's equipment loadout
 */
export function getLoadout(userId: string): EconomyEquipmentLoadout {
  return userEquipment.get(userId) ?? {
    profileFrame: null,
    title: null,
    avatarEffect: null,
    nameEffect: null,
  };
}

/**
 * Check if user has an item equipped
 */
export function isItemEquipped(userId: string, itemId: string): boolean {
  const loadout = getLoadout(userId);
  return (
    loadout.profileFrame?.itemId === itemId ||
    loadout.title?.itemId === itemId ||
    loadout.avatarEffect?.itemId === itemId ||
    loadout.nameEffect?.itemId === itemId
  );
}

/**
 * Get all equipped item IDs
 */
export function getEquippedItemIds(userId: string): Set<string> {
  const loadout = getLoadout(userId);
  const ids = new Set<string>();

  if (loadout.profileFrame) ids.add(loadout.profileFrame.itemId);
  if (loadout.title) ids.add(loadout.title.itemId);
  if (loadout.avatarEffect) ids.add(loadout.avatarEffect.itemId);
  if (loadout.nameEffect) ids.add(loadout.nameEffect.itemId);

  return ids;
}

/**
 * Get equippable items for a slot
 */
export function getEquippableItems(
  userId: string,
  slot: EconomyEquipmentSlot,
): EconomyInventoryItemWithDetails[] {
  const slotTypeMap: Record<EconomyEquipmentSlot, string[]> = {
    profile_frame: ['profile_frame'],
    title: ['title'],
    avatar_effect: ['avatar_effect', 'cosmetic'],
    name_effect: ['name_effect', 'cosmetic'],
  };

  const validTypes = slotTypeMap[slot] ?? [];
  const inventory = getUserInventoryByType(userId, validTypes[0] as any);

  return inventory
    .map((item) => getInventoryItemWithDetails(userId, item.itemId))
    .filter((item): item is EconomyInventoryItemWithDetails => item !== null);
}

/**
 * Clear all equipment (for testing)
 */
export function _clearAllEquipment(): void {
  userEquipment.clear();
}
