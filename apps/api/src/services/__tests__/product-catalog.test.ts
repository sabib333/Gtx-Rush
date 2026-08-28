/**
 * GTX Rush — Product Catalog Tests
 *
 * Tests for:
 * - Product initialization
 * - Product queries
 * - Ownership management
 * - Equipment management
 * - Store response
 * - Product validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeProductCatalog,
  getProduct,
  getAllProducts,
  getProducts,
  getFeaturedProductList,
  getAvailableProducts,
  getStoreResponse,
  getProductWithOwnership,
  userOwnsProduct,
  grantProductOwnership,
  getUserOwnedProducts,
  equipProduct,
  unequipProduct,
  validateProductForPurchase,
  _clearProductCatalog,
  _getProductCount,
  _getUserOwnershipCount,
} from '../product-catalog';

describe('Product Catalog', () => {
  const testUserId = 'test-user-001';

  beforeEach(() => {
    _clearProductCatalog();
    initializeProductCatalog();
  });

  describe('Initialization', () => {
    it('should initialize product catalog from config', () => {
      const count = _getProductCount();
      expect(count).toBeGreaterThan(0);
    });

    it('should have products in different categories', () => {
      const products = getAllProducts();
      const categories = new Set(products.map((p) => p.category));
      expect(categories.size).toBeGreaterThan(1);
    });
  });

  describe('Product Queries', () => {
    it('should get product by ID', () => {
      const product = getProduct('frame_neon_rush');
      expect(product).toBeDefined();
      expect(product?.name).toBe('Neon Rush Frame');
      expect(product?.priceStars).toBe(120);
    });

    it('should return null for non-existent product', () => {
      const product = getProduct('non-existent');
      expect(product).toBeNull();
    });

    it('should get all active products', () => {
      const products = getAllProducts();
      expect(products.length).toBeGreaterThan(0);
      expect(products.every((p) => p.isActive)).toBe(true);
    });

    it('should get products by category', () => {
      const frames = getProducts('avatar_frame');
      expect(frames.length).toBeGreaterThan(0);
      expect(frames.every((p) => p.category === 'avatar_frame')).toBe(true);
    });

    it('should get featured products', () => {
      const featured = getFeaturedProductList();
      expect(featured.length).toBeGreaterThan(0);
    });
  });

  describe('Ownership Management', () => {
    it('should grant product ownership', () => {
      const result = grantProductOwnership(testUserId, 'frame_neon_rush');
      expect(result).toBe(true);
      expect(userOwnsProduct(testUserId, 'frame_neon_rush')).toBe(true);
    });

    it('should not grant ownership for non-existent product', () => {
      const result = grantProductOwnership(testUserId, 'non-existent');
      expect(result).toBe(false);
    });

    it('should be idempotent for ownership grants', () => {
      grantProductOwnership(testUserId, 'frame_neon_rush');
      const result = grantProductOwnership(testUserId, 'frame_neon_rush');
      expect(result).toBe(false); // Was not new
      expect(userOwnsProduct(testUserId, 'frame_neon_rush')).toBe(true);
    });

    it('should get user owned products', () => {
      grantProductOwnership(testUserId, 'frame_neon_rush');
      grantProductOwnership(testUserId, 'effect_fire_name');

      const owned = getUserOwnedProducts(testUserId);
      expect(owned.length).toBe(2);
    });

    it('should track ownership count', () => {
      grantProductOwnership(testUserId, 'frame_neon_rush');
      grantProductOwnership(testUserId, 'effect_fire_name');

      expect(_getUserOwnershipCount(testUserId)).toBe(2);
    });
  });

  describe('Equipment Management', () => {
    it('should equip a product', () => {
      grantProductOwnership(testUserId, 'frame_neon_rush');
      const result = equipProduct(testUserId, 'frame_neon_rush');
      expect(result).toBe(true);
    });

    it('should not equip non-owned product', () => {
      const result = equipProduct(testUserId, 'frame_neon_rush');
      expect(result).toBe(false);
    });

    it('should not equip non-existent product', () => {
      const result = equipProduct(testUserId, 'non-existent');
      expect(result).toBe(false);
    });

    it('should be idempotent for equip', () => {
      grantProductOwnership(testUserId, 'frame_neon_rush');
      equipProduct(testUserId, 'frame_neon_rush');
      const result = equipProduct(testUserId, 'frame_neon_rush');
      expect(result).toBe(true);
    });

    it('should unequip a product', () => {
      grantProductOwnership(testUserId, 'frame_neon_rush');
      equipProduct(testUserId, 'frame_neon_rush');
      const result = unequipProduct(testUserId, 'avatar_frame');
      expect(result).toBe(true);
    });
  });

  describe('Store Response', () => {
    it('should get store response', () => {
      const storeData = getStoreResponse(testUserId, 1);
      expect(storeData).toBeDefined();
      expect(storeData.featured).toBeDefined();
      expect(storeData.categories).toBeDefined();
      expect(storeData.products).toBeDefined();
    });

    it('should include ownership info in store response', () => {
      grantProductOwnership(testUserId, 'frame_neon_rush');
      const storeData = getStoreResponse(testUserId, 1);

      const neonFrame = storeData.products.find((p) => p.id === 'frame_neon_rush');
      expect(neonFrame?.owned).toBe(true);
    });

    it('should filter products by user level', () => {
      const storeDataLevel1 = getStoreResponse(testUserId, 1);
      const storeDataLevel10 = getStoreResponse(testUserId, 10);

      // Level 10 user should see more products
      expect(storeDataLevel10.products.length).toBeGreaterThanOrEqual(
        storeDataLevel1.products.length,
      );
    });
  });

  describe('Product Validation', () => {
    it('should validate product for purchase', () => {
      const result = validateProductForPurchase('frame_neon_rush', testUserId, 1);
      expect(result.valid).toBe(true);
      expect(result.product).toBeDefined();
    });

    it('should reject non-existent product', () => {
      const result = validateProductForPurchase('non-existent', testUserId, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('PRODUCT_NOT_FOUND');
    });

    it('should reject already owned product', () => {
      grantProductOwnership(testUserId, 'frame_neon_rush');
      const result = validateProductForPurchase('frame_neon_rush', testUserId, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('ALREADY_OWNED');
    });

    it('should reject product for low level user', () => {
      // frame_diamond requires level 10
      const result = validateProductForPurchase('frame_diamond', testUserId, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NOT_AVAILABLE');
    });
  });

  describe('Cleanup', () => {
    it('should clear product catalog', () => {
      _clearProductCatalog();
      expect(_getProductCount()).toBe(0);
    });
  });
});
