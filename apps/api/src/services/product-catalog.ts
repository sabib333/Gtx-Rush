/**
 * GTX Rush — Product Catalog Service v1.0
 *
 * Server-authoritative product catalog that handles:
 * - Product management and queries
 * - Ownership tracking
 * - Availability checks
 * - Store data preparation
 *
 * SECURITY:
 * - All prices are server-authoritative
 * - Client cannot manipulate product data
 * - Availability is checked server-side
 * - Product catalog is immutable from client perspective
 *
 * Contract: Monetization Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  Product,
  ProductWithOwnership,
  CosmeticCategory,
  ProductType,
  StoreResponse,
  StoreCategory,
  StoreProductResponse,
} from '@gtx-rush/types';
import {
  PRODUCT_CATALOG,
  STORE_CONFIG,
  getProductById,
  getProductsByCategory,
  getFeaturedProducts,
  isProductAvailable,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const products = new Map<string, Product>();
const userOwnership = new Map<string, Set<string>>(); // userId → Set of productIds
const userEquipped = new Map<string, Map<string, string>>(); // userId → category → productId

// ============================================================
// Initialization
// ============================================================

/**
 * Initialize product catalog from configuration.
 * Called once at startup.
 */
export function initializeProductCatalog(): void {
  for (const product of PRODUCT_CATALOG) {
    products.set(product.id, product);
  }
}

// ============================================================
// Product Queries
// ============================================================

/**
 * Get a product by ID.
 * Returns null if not found.
 */
export function getProduct(productId: string): Product | null {
  return products.get(productId) ?? null;
}

/**
 * Get all active products.
 */
export function getAllProducts(): Product[] {
  return Array.from(products.values()).filter((p) => p.isActive);
}

/**
 * Get products by category.
 */
export function getProducts(category?: CosmeticCategory): Product[] {
  if (category) {
    return getProductsByCategory(category);
  }
  return getAllProducts();
}

/**
 * Get featured products for store homepage.
 */
export function getFeaturedProductList(): Product[] {
  return getFeaturedProducts();
}

/**
 * Get products available to a specific user.
 */
export function getAvailableProducts(
  userId: string,
  userLevel: number,
  userSegments: string[] = [],
): ProductWithOwnership[] {
  const owned = userOwnership.get(userId) ?? new Set();
  const equipped = userEquipped.get(userId) ?? new Map();

  return getAllProducts()
    .filter((product) => isProductAvailable(product, userLevel, userSegments))
    .map((product) => ({
      ...product,
      owned: owned.has(product.id),
      equipped: equipped.get(product.category ?? '') === product.id,
    }));
}

/**
 * Get store response with all sections.
 */
export function getStoreResponse(
  userId: string,
  userLevel: number,
  userSegments: string[] = [],
): StoreResponse {
  const allProducts = getAvailableProducts(userId, userLevel, userSegments);
  const featured = getFeaturedProductList().map((p) => ({
    ...p,
    owned: allProducts.find((ap) => ap.id === p.id)?.owned ?? false,
  }));

  // Group by category
  const categoryMap = new Map<string, ProductWithOwnership[]>();
  for (const product of allProducts) {
    const category = product.category ?? 'other';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(product);
  }

  const categories: StoreCategory[] = Array.from(categoryMap.entries()).map(
    ([name, products]) => ({
      name,
      displayName: formatCategoryName(name),
      products,
    }),
  );

  return {
    featured,
    categories,
    products: allProducts,
  };
}

/**
 * Get a single product with ownership info.
 */
export function getProductWithOwnership(
  productId: string,
  userId: string,
): StoreProductResponse | null {
  const product = getProduct(productId);
  if (!product) return null;

  const owned = userOwnership.get(userId) ?? new Set();
  const equipped = userEquipped.get(userId) ?? new Map();

  const productWithOwnership: ProductWithOwnership = {
    ...product,
    owned: owned.has(product.id),
    equipped: equipped.get(product.category ?? '') === product.id,
  };

  // Get related products (same category)
  const relatedProducts = getProducts(product.category ?? undefined)
    .filter((p) => p.id !== productId)
    .slice(0, 4)
    .map((p) => ({
      ...p,
      owned: owned.has(p.id),
      equipped: equipped.get(p.category ?? '') === p.id,
    }));

  return {
    product: productWithOwnership,
    relatedProducts,
  };
}

// ============================================================
// Ownership Management
// ============================================================

/**
 * Check if a user owns a product.
 */
export function userOwnsProduct(userId: string, productId: string): boolean {
  const owned = userOwnership.get(userId) ?? new Set();
  return owned.has(productId);
}

/**
 * Grant product ownership to a user.
 * Idempotent: if already owned, no-op.
 */
export function grantProductOwnership(
  userId: string,
  productId: string,
): boolean {
  if (!products.has(productId)) {
    return false;
  }

  if (!userOwnership.has(userId)) {
    userOwnership.set(userId, new Set());
  }

  const owned = userOwnership.get(userId)!;
  const wasNew = !owned.has(productId);
  owned.add(productId);

  return wasNew;
}

/**
 * Get all products owned by a user.
 */
export function getUserOwnedProducts(userId: string): Product[] {
  const owned = userOwnership.get(userId) ?? new Set();
  return Array.from(owned)
    .map((id) => products.get(id))
    .filter((p): p is Product => p !== undefined);
}

// ============================================================
// Equipment Management
// ============================================================

/**
 * Equip a product for a user.
 * Only one product can be equipped per category.
 */
export function equipProduct(
  userId: string,
  productId: string,
): boolean {
  const product = getProduct(productId);
  if (!product) return false;

  // Check ownership
  if (!userOwnsProduct(userId, productId)) {
    return false;
  }

  if (!userEquipped.has(userId)) {
    userEquipped.set(userId, new Map());
  }

  const equipped = userEquipped.get(userId)!;
  const category = product.category ?? 'other';

  // Already equipped
  if (equipped.get(category) === productId) {
    return true;
  }

  equipped.set(category, productId);
  return true;
}

/**
 * Unequip a product for a user.
 */
export function unequipProduct(
  userId: string,
  category: string,
): boolean {
  if (!userEquipped.has(userId)) {
    return false;
  }

  const equipped = userEquipped.get(userId)!;
  return equipped.delete(category);
}

/**
 * Get all equipped products for a user.
 */
export function getUserEquippedProducts(userId: string): Map<string, string> {
  return userEquipped.get(userId) ?? new Map();
}

// ============================================================
// Product Validation
// ============================================================

/**
 * Validate that a product exists and is available for purchase.
 */
export function validateProductForPurchase(
  productId: string,
  userId: string,
  userLevel: number,
): {
  valid: boolean;
  product?: Product;
  error?: string;
} {
  const product = getProduct(productId);

  if (!product) {
    return { valid: false, error: 'PRODUCT_NOT_FOUND' };
  }

  if (!product.isActive) {
    return { valid: false, error: 'PRODUCT_NOT_ACTIVE' };
  }

  if (userOwnsProduct(userId, productId)) {
    return { valid: false, error: 'ALREADY_OWNED' };
  }

  if (!isProductAvailable(product, userLevel)) {
    return { valid: false, error: 'NOT_AVAILABLE' };
  }

  return { valid: true, product };
}

// ============================================================
// Helpers
// ============================================================

function formatCategoryName(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearProductCatalog(): void {
  products.clear();
  userOwnership.clear();
  userEquipped.clear();
}

export function _getProductCount(): number {
  return products.size;
}

export function _getUserOwnershipCount(userId: string): number {
  return userOwnership.get(userId)?.size ?? 0;
}
