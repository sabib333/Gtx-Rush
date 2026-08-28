/**
 * GTX Rush — Purchase Service Tests
 *
 * Tests for:
 * - Purchase initiation
 * - Payment verification
 * - Idempotent processing
 * - Refund handling
 * - Purchase queries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initiatePurchase,
  verifyPurchase,
  getPurchase,
  getUserPurchases,
  handleRefund,
  _clearPurchaseService,
  _getPurchaseCount,
  _getUserPurchaseCount,
} from '../purchase-service';
import { initializeProductCatalog, grantProductOwnership, _clearProductCatalog } from '../product-catalog';

describe('Purchase Service', () => {
  const testUserId = 'test-user-001';

  beforeEach(() => {
    _clearPurchaseService();
    _clearProductCatalog();
    initializeProductCatalog();
  });

  describe('Purchase Initiation', () => {
    it('should initiate a purchase', () => {
      const result = initiatePurchase(
        testUserId,
        { productId: 'frame_neon_rush', idempotencyKey: 'key-001' },
        1,
      );

      expect(result.purchaseId).toBeDefined();
      expect(result.paymentParams).toBeDefined();
      expect(result.paymentParams.amount).toBe(120);
      expect(result.paymentParams.currency).toBe('XTR');
    });

    it('should reject purchase for non-existent product', () => {
      expect(() => {
        initiatePurchase(
          testUserId,
          { productId: 'non-existent', idempotencyKey: 'key-002' },
          1,
        );
      }).toThrow('PRODUCT_NOT_FOUND');
    });

    it('should reject purchase for already owned product', () => {
      grantProductOwnership(testUserId, 'frame_neon_rush');

      expect(() => {
        initiatePurchase(
          testUserId,
          { productId: 'frame_neon_rush', idempotencyKey: 'key-003' },
          1,
        );
      }).toThrow('ALREADY_OWNED');
    });

    it('should reject purchase for low level user', () => {
      expect(() => {
        initiatePurchase(
          testUserId,
          { productId: 'frame_diamond', idempotencyKey: 'key-004' },
          1,
        );
      }).toThrow('NOT_AVAILABLE');
    });

    it('should be idempotent for same idempotency key', () => {
      const first = initiatePurchase(
        testUserId,
        { productId: 'frame_neon_rush', idempotencyKey: 'key-005' },
        1,
      );

      const second = initiatePurchase(
        testUserId,
        { productId: 'frame_neon_rush', idempotencyKey: 'key-005' },
        1,
      );

      expect(first.purchaseId).toBe(second.purchaseId);
    });
  });

  describe('Payment Verification', () => {
    it('should verify a purchase', () => {
      const purchase = initiatePurchase(
        testUserId,
        { productId: 'frame_neon_rush', idempotencyKey: 'key-006' },
        1,
      );

      const result = verifyPurchase({
        telegramPaymentId: 'tg-payment-001',
        idempotencyKey: 'key-006',
      });

      expect(result.success).toBe(true);
      expect(result.purchase.status).toBe('completed');
      expect(result.itemGranted).toBe(true);
    });

    it('should be idempotent for duplicate verification', () => {
      initiatePurchase(
        testUserId,
        { productId: 'frame_neon_rush', idempotencyKey: 'key-007' },
        1,
      );

      const first = verifyPurchase({
        telegramPaymentId: 'tg-payment-002',
        idempotencyKey: 'key-007',
      });

      const second = verifyPurchase({
        telegramPaymentId: 'tg-payment-002',
        idempotencyKey: 'key-007',
      });

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(first.purchase.id).toBe(second.purchase.id);
    });

    it('should reject verification for non-existent purchase', () => {
      const result = verifyPurchase({
        telegramPaymentId: 'tg-payment-003',
        idempotencyKey: 'non-existent',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Refund Handling', () => {
    it('should handle refund for completed purchase', () => {
      const purchase = initiatePurchase(
        testUserId,
        { productId: 'frame_neon_rush', idempotencyKey: 'key-008' },
        1,
      );

      verifyPurchase({
        telegramPaymentId: 'tg-payment-004',
        idempotencyKey: 'key-008',
      });

      const result = handleRefund(purchase.purchaseId, 'user_request');
      expect(result.success).toBe(true);
      expect(result.purchase?.status).toBe('refunded');
    });

    it('should reject refund for non-existent purchase', () => {
      const result = handleRefund('non-existent', 'user_request');
      expect(result.success).toBe(false);
    });

    it('should reject refund for non-completed purchase', () => {
      const purchase = initiatePurchase(
        testUserId,
        { productId: 'frame_neon_rush', idempotencyKey: 'key-009' },
        1,
      );

      const result = handleRefund(purchase.purchaseId, 'user_request');
      expect(result.success).toBe(false);
    });
  });

  describe('Purchase Queries', () => {
    it('should get purchase by ID', () => {
      const initiated = initiatePurchase(
        testUserId,
        { productId: 'frame_neon_rush', idempotencyKey: 'key-010' },
        1,
      );

      const purchase = getPurchase(initiated.purchaseId);
      expect(purchase).toBeDefined();
      expect(purchase?.userId).toBe(testUserId);
    });

    it('should get user purchases', () => {
      initiatePurchase(
        testUserId,
        { productId: 'frame_neon_rush', idempotencyKey: 'key-011' },
        1,
      );
      initiatePurchase(
        testUserId,
        { productId: 'effect_fire_name', idempotencyKey: 'key-012' },
        1,
      );

      const purchases = getUserPurchases(testUserId);
      expect(purchases.purchases.length).toBe(2);
    });

    it('should filter purchases by status', () => {
      initiatePurchase(
        testUserId,
        { productId: 'frame_neon_rush', idempotencyKey: 'key-013' },
        1,
      );

      const pending = getUserPurchases(testUserId, { status: 'pending' });
      expect(pending.purchases.length).toBe(1);

      const completed = getUserPurchases(testUserId, { status: 'completed' });
      expect(completed.purchases.length).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should clear purchase service', () => {
      _clearPurchaseService();
      expect(_getPurchaseCount()).toBe(0);
    });
  });
});
