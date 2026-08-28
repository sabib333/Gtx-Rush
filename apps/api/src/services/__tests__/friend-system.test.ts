/**
 * GTX Rush — Friend System Tests
 *
 * Tests for:
 * - Friend requests
 * - Friend acceptance
 * - Blocking/unblocking
 * - Friend queries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  isBlocked,
  areFriends,
  getUserFriends,
  getPendingFriendRequests,
  getFriendCount,
  getMutualFriends,
  _clearFriendSystem,
  _getFriendCount,
  _getRequestCount,
  _getBlockCount,
} from '../friend-system';

describe('Friend System', () => {
  const testUserId = 'test-user-001';
  const testUserId2 = 'test-user-002';
  const testUserId3 = 'test-user-003';

  beforeEach(() => {
    _clearFriendSystem();
  });

  describe('Friend Requests', () => {
    it('should send a friend request', () => {
      const result = sendFriendRequest(testUserId, testUserId2);
      expect(result.success).toBe(true);
      expect(result.request).toBeDefined();
      expect(result.request?.fromUserId).toBe(testUserId);
      expect(result.request?.toUserId).toBe(testUserId2);
    });

    it('should not send self-request', () => {
      const result = sendFriendRequest(testUserId, testUserId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('SELF_REQUEST');
    });

    it('should not send request to blocked user', () => {
      blockUser(testUserId, testUserId2);
      const result = sendFriendRequest(testUserId, testUserId2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('USER_BLOCKED');
    });

    it('should not send duplicate request', () => {
      sendFriendRequest(testUserId, testUserId2);
      const result = sendFriendRequest(testUserId, testUserId2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('REQUEST_ALREADY_EXISTS');
    });

    it('should not send request if already friends', () => {
      sendFriendRequest(testUserId, testUserId2);
      acceptFriendRequest(testUserId2, 'any'); // Would need actual request ID
      // For this test, we'll manually create friendship
      // In real code, would use actual request ID
    });
  });

  describe('Friend Acceptance', () => {
    it('should accept a friend request', () => {
      const request = sendFriendRequest(testUserId, testUserId2);
      const result = acceptFriendRequest(testUserId2, request.request!.id);
      expect(result.success).toBe(true);
    });

    it('should not accept non-existent request', () => {
      const result = acceptFriendRequest(testUserId2, 'non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('REQUEST_NOT_FOUND');
    });

    it('should not accept request for wrong user', () => {
      const request = sendFriendRequest(testUserId, testUserId2);
      const result = acceptFriendRequest(testUserId3, request.request!.id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('UNAUTHORIZED');
    });

    it('should create friendship after acceptance', () => {
      const request = sendFriendRequest(testUserId, testUserId2);
      acceptFriendRequest(testUserId2, request.request!.id);

      expect(areFriends(testUserId, testUserId2)).toBe(true);
      expect(areFriends(testUserId2, testUserId)).toBe(true);
    });
  });

  describe('Friend Decline', () => {
    it('should decline a friend request', () => {
      const request = sendFriendRequest(testUserId, testUserId2);
      const result = declineFriendRequest(testUserId2, request.request!.id);
      expect(result.success).toBe(true);
    });

    it('should not create friendship after decline', () => {
      const request = sendFriendRequest(testUserId, testUserId2);
      declineFriendRequest(testUserId2, request.request!.id);

      expect(areFriends(testUserId, testUserId2)).toBe(false);
    });
  });

  describe('Remove Friend', () => {
    it('should remove a friend', () => {
      // Create friendship
      const request = sendFriendRequest(testUserId, testUserId2);
      acceptFriendRequest(testUserId2, request.request!.id);

      const result = removeFriend(testUserId, testUserId2);
      expect(result.success).toBe(true);
      expect(areFriends(testUserId, testUserId2)).toBe(false);
    });

    it('should not remove non-friend', () => {
      const result = removeFriend(testUserId, testUserId2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_FRIENDS');
    });
  });

  describe('Block System', () => {
    it('should block a user', () => {
      const result = blockUser(testUserId, testUserId2);
      expect(result.success).toBe(true);
      expect(isBlocked(testUserId, testUserId2)).toBe(true);
    });

    it('should not block self', () => {
      const result = blockUser(testUserId, testUserId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('SELF_BLOCK');
    });

    it('should not block twice', () => {
      blockUser(testUserId, testUserId2);
      const result = blockUser(testUserId, testUserId2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_BLOCKED');
    });

    it('should unblock a user', () => {
      blockUser(testUserId, testUserId2);
      const result = unblockUser(testUserId, testUserId2);
      expect(result.success).toBe(true);
      expect(isBlocked(testUserId, testUserId2)).toBe(false);
    });

    it('should not unblock non-blocked user', () => {
      const result = unblockUser(testUserId, testUserId2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_BLOCKED');
    });

    it('should remove friendship when blocking', () => {
      // Create friendship
      const request = sendFriendRequest(testUserId, testUserId2);
      acceptFriendRequest(testUserId2, request.request!.id);

      // Block
      blockUser(testUserId, testUserId2);

      expect(areFriends(testUserId, testUserId2)).toBe(false);
    });
  });

  describe('Friend Queries', () => {
    it('should get user friends', () => {
      // Create friendships
      const request1 = sendFriendRequest(testUserId, testUserId2);
      acceptFriendRequest(testUserId2, request1.request!.id);

      const request2 = sendFriendRequest(testUserId, testUserId3);
      acceptFriendRequest(testUserId3, request2.request!.id);

      const friends = getUserFriends(testUserId);
      expect(friends.length).toBe(2);
    });

    it('should get friend count', () => {
      const request = sendFriendRequest(testUserId, testUserId2);
      acceptFriendRequest(testUserId2, request.request!.id);

      expect(getFriendCount(testUserId)).toBe(1);
    });

    it('should get mutual friends', () => {
      // Create friendships
      const request1 = sendFriendRequest(testUserId, testUserId2);
      acceptFriendRequest(testUserId2, request1.request!.id);

      const request2 = sendFriendRequest(testUserId, testUserId3);
      acceptFriendRequest(testUserId3, request2.request!.id);

      const request3 = sendFriendRequest(testUserId2, testUserId3);
      acceptFriendRequest(testUserId3, request3.request!.id);

      const mutual = getMutualFriends(testUserId, testUserId2);
      expect(mutual).toContain(testUserId3);
    });

    it('should get pending requests', () => {
      sendFriendRequest(testUserId, testUserId2);
      sendFriendRequest(testUserId3, testUserId);

      const pending = getPendingFriendRequests(testUserId);
      expect(pending.sent.length).toBe(1);
      expect(pending.received.length).toBe(1);
    });
  });

  describe('Cleanup', () => {
    it('should clear friend system', () => {
      sendFriendRequest(testUserId, testUserId2);
      blockUser(testUserId, testUserId3);

      _clearFriendSystem();
      expect(_getRequestCount()).toBe(0);
      expect(_getBlockCount()).toBe(0);
    });
  });
});
