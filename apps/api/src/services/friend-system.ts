/**
 * GTX Rush — Friend System v1.0
 *
 * Server-authoritative friend system that handles:
 * - Friend relationships
 * - Friend requests
 * - Blocking/unblocking
 * - Friend profiles
 * - Friend leaderboards
 *
 * SECURITY:
 * - Friend relationships are server-authoritative
 * - Private information is never exposed
 * - Rate limiting prevents spam
 * - Block system prevents unwanted interactions
 *
 * Contract: Social Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  FriendRelationship,
  FriendRequest,
  FriendWithProfile,
  FriendProfile,
  FriendBadge,
  FriendStatus,
  Block,
  FriendsListResponse,
  FriendRequestsResponse,
} from '@gtx-rush/types';
import {
  FRIEND_CONFIG,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const friendRelationships = new Map<string, FriendRelationship>(); // userId:friendId → relationship
const userFriends = new Map<string, Set<string>>(); // userId → Set of friendIds
const friendRequests = new Map<string, FriendRequest>(); // requestId → request
const userSentRequests = new Map<string, Set<string>>(); // userId → Set of requestIds
const userReceivedRequests = new Map<string, Set<string>>(); // userId → Set of requestIds
const blocks = new Map<string, Block>(); // blockId → Block
const userBlocks = new Map<string, Set<string>>(); // userId → Set of blockedUserIds
const dailyRequestCounts = new Map<string, number>(); // userId:YYYY-MM-DD → count

// ============================================================
// Friend Request Management
// ============================================================

/**
 * Send a friend request.
 *
 * SECURITY:
 * - Validates request limits
 * - Prevents self-requests
 * - Checks block status
 * - Rate limiting
 */
export function sendFriendRequest(
  fromUserId: string,
  toUserId: string,
  message: string | null = null,
): {
  success: boolean;
  request?: FriendRequest;
  error?: string;
} {
  // Prevent self-request
  if (fromUserId === toUserId) {
    return { success: false, error: 'SELF_REQUEST' };
  }

  // Check if blocked
  if (isBlocked(fromUserId, toUserId)) {
    return { success: false, error: 'USER_BLOCKED' };
  }

  // Check if already friends
  if (areFriends(fromUserId, toUserId)) {
    return { success: false, error: 'ALREADY_FRIENDS' };
  }

  // Check pending request limit
  const sentRequests = userSentRequests.get(fromUserId) ?? new Set();
  if (sentRequests.size >= FRIEND_CONFIG.maxPendingRequests) {
    return { success: false, error: 'MAX_PENDING_REQUESTS' };
  }

  // Check daily limit
  const dailyCount = getDailyRequestCount(fromUserId);
  if (dailyCount >= FRIEND_CONFIG.maxRequestsPerDay) {
    return { success: false, error: 'DAILY_LIMIT_REACHED' };
  }

  // Check if request already exists (from either direction)
  const existingRequest = findExistingRequest(fromUserId, toUserId);
  if (existingRequest) {
    return { success: false, error: 'REQUEST_ALREADY_EXISTS' };
  }

  // Create request
  const request: FriendRequest = {
    id: nanoid(),
    fromUserId,
    toUserId,
    status: 'pending',
    message,
    createdAt: new Date(),
    respondedAt: null,
    expiresAt: new Date(Date.now() + FRIEND_CONFIG.requestExpirationDays * 24 * 60 * 60 * 1000),
  };

  friendRequests.set(request.id, request);

  // Update indices
  const fromSent = userSentRequests.get(fromUserId) ?? new Set();
  fromSent.add(request.id);
  userSentRequests.set(fromUserId, fromSent);

  const toReceived = userReceivedRequests.get(toUserId) ?? new Set();
  toReceived.add(request.id);
  userReceivedRequests.set(toUserId, toReceived);

  // Update daily count
  updateDailyRequestCount(fromUserId);

  return { success: true, request };
}

/**
 * Accept a friend request.
 */
export function acceptFriendRequest(
  userId: string,
  requestId: string,
): {
  success: boolean;
  error?: string;
} {
  const request = friendRequests.get(requestId);
  if (!request) {
    return { success: false, error: 'REQUEST_NOT_FOUND' };
  }

  if (request.toUserId !== userId) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  if (request.status !== 'pending') {
    return { success: false, error: 'REQUEST_NOT_PENDING' };
  }

  // Check if expired
  if (new Date() > request.expiresAt) {
    request.status = 'expired';
    return { success: false, error: 'REQUEST_EXPIRED' };
  }

  // Update request status
  request.status = 'accepted';
  request.respondedAt = new Date();

  // Create friend relationship
  createFriendRelationship(request.fromUserId, request.toUserId);

  // Clean up request indices
  cleanupRequestIndices(request);

  return { success: true };
}

/**
 * Decline a friend request.
 */
export function declineFriendRequest(
  userId: string,
  requestId: string,
): {
  success: boolean;
  error?: string;
} {
  const request = friendRequests.get(requestId);
  if (!request) {
    return { success: false, error: 'REQUEST_NOT_FOUND' };
  }

  if (request.toUserId !== userId) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  if (request.status !== 'pending') {
    return { success: false, error: 'REQUEST_NOT_PENDING' };
  }

  request.status = 'declined';
  request.respondedAt = new Date();

  cleanupRequestIndices(request);

  return { success: true };
}

/**
 * Cancel a sent friend request.
 */
export function cancelFriendRequest(
  userId: string,
  requestId: string,
): {
  success: boolean;
  error?: string;
} {
  const request = friendRequests.get(requestId);
  if (!request) {
    return { success: false, error: 'REQUEST_NOT_FOUND' };
  }

  if (request.fromUserId !== userId) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  if (request.status !== 'pending') {
    return { success: false, error: 'REQUEST_NOT_PENDING' };
  }

  request.status = 'declined';
  request.respondedAt = new Date();

  cleanupRequestIndices(request);

  return { success: true };
}

// ============================================================
// Friend Relationship Management
// ============================================================

/**
 * Create a friend relationship.
 */
function createFriendRelationship(userId1: string, userId2: string): void {
  const now = new Date();

  // Create relationship for user1 → user2
  const relationship1: FriendRelationship = {
    id: nanoid(),
    userId: userId1,
    friendId: userId2,
    status: 'connected',
    requestedBy: userId2,
    createdAt: now,
    acceptedAt: now,
    blockedAt: null,
    metadata: {},
  };
  friendRelationships.set(`${userId1}:${userId2}`, relationship1);

  // Create relationship for user2 → user1
  const relationship2: FriendRelationship = {
    id: nanoid(),
    userId: userId2,
    friendId: userId1,
    status: 'connected',
    requestedBy: userId2,
    createdAt: now,
    acceptedAt: now,
    blockedAt: null,
    metadata: {},
  };
  friendRelationships.set(`${userId2}:${userId1}`, relationship2);

  // Update friend indices
  const friends1 = userFriends.get(userId1) ?? new Set();
  friends1.add(userId2);
  userFriends.set(userId1, friends1);

  const friends2 = userFriends.get(userId2) ?? new Set();
  friends2.add(userId1);
  userFriends.set(userId2, friends2);
}

/**
 * Remove a friend.
 */
export function removeFriend(
  userId: string,
  friendId: string,
): {
  success: boolean;
  error?: string;
} {
  if (!areFriends(userId, friendId)) {
    return { success: false, error: 'NOT_FRIENDS' };
  }

  // Remove relationships
  friendRelationships.delete(`${userId}:${friendId}`);
  friendRelationships.delete(`${friendId}:${userId}`);

  // Update indices
  const friends1 = userFriends.get(userId);
  friends1?.delete(friendId);

  const friends2 = userFriends.get(friendId);
  friends2?.delete(userId);

  return { success: true };
}

// ============================================================
// Block System
// ============================================================

/**
 * Block a user.
 */
export function blockUser(
  userId: string,
  blockedUserId: string,
  reason: string | null = null,
): {
  success: boolean;
  error?: string;
} {
  if (userId === blockedUserId) {
    return { success: false, error: 'SELF_BLOCK' };
  }

  // Check if already blocked
  const userBlockList = userBlocks.get(userId) ?? new Set();
  if (userBlockList.has(blockedUserId)) {
    return { success: false, error: 'ALREADY_BLOCKED' };
  }

  // Create block
  const block: Block = {
    id: nanoid(),
    userId,
    blockedUserId,
    reason,
    createdAt: new Date(),
  };
  blocks.set(block.id, block);

  // Update index
  userBlockList.add(blockedUserId);
  userBlocks.set(userId, userBlockList);

  // Remove friend relationship if exists
  if (areFriends(userId, blockedUserId)) {
    removeFriend(userId, blockedUserId);
  }

  return { success: true };
}

/**
 * Unblock a user.
 */
export function unblockUser(
  userId: string,
  blockedUserId: string,
): {
  success: boolean;
  error?: string;
} {
  const userBlockList = userBlocks.get(userId);
  if (!userBlockList?.has(blockedUserId)) {
    return { success: false, error: 'NOT_BLOCKED' };
  }

  // Remove block
  userBlockList.delete(blockedUserId);

  // Remove block record
  for (const [id, block] of blocks.entries()) {
    if (block.userId === userId && block.blockedUserId === blockedUserId) {
      blocks.delete(id);
      break;
    }
  }

  return { success: true };
}

/**
 * Check if user is blocked.
 */
export function isBlocked(userId: string, blockedUserId: string): boolean {
  const userBlockList = userBlocks.get(userId);
  return userBlockList?.has(blockedUserId) ?? false;
}

/**
 * Get user's blocked users.
 */
export function getBlockedUsers(userId: string): string[] {
  return Array.from(userBlocks.get(userId) ?? []);
}

// ============================================================
// Friend Queries
// ============================================================

/**
 * Check if two users are friends.
 */
export function areFriends(userId1: string, userId2: string): boolean {
  const friends = userFriends.get(userId1);
  return friends?.has(userId2) ?? false;
}

/**
 * Get user's friends.
 */
export function getUserFriends(userId: string): FriendWithProfile[] {
  const friendIds = userFriends.get(userId) ?? new Set();
  return Array.from(friendIds)
    .map((friendId) => {
      const relationship = friendRelationships.get(`${userId}:${friendId}`);
      if (!relationship) return null;

      return {
        id: relationship.id,
        userId: relationship.userId,
        friendId: relationship.friendId,
        status: relationship.status,
        profile: getFriendProfile(friendId),
        connectedAt: relationship.acceptedAt,
      };
    })
    .filter((f): f is FriendWithProfile => f !== null);
}

/**
 * Get friend profile.
 */
function getFriendProfile(userId: string): FriendProfile {
  // In production, fetch from users table
  // For MVP, return mock profile
  return {
    id: userId,
    displayName: `Player ${userId.slice(0, 8)}`,
    username: `user_${userId.slice(0, 8)}`,
    avatarUrl: null,
    level: 1,
    globalRank: null,
    seasonRank: null,
    tier: null,
    title: null,
    badges: [],
    bestScore: 0,
    currentStreak: 0,
    teamId: null,
    teamName: null,
  };
}

/**
 * Get friend count.
 */
export function getFriendCount(userId: string): number {
  return userFriends.get(userId)?.size ?? 0;
}

/**
 * Get mutual friends.
 */
export function getMutualFriends(userId1: string, userId2: string): string[] {
  const friends1 = userFriends.get(userId1) ?? new Set();
  const friends2 = userFriends.get(userId2) ?? new Set();
  return Array.from(friends1).filter((f) => friends2.has(f));
}

// ============================================================
// Friend Request Queries
// ============================================================

/**
 * Get pending friend requests for a user.
 */
export function getPendingFriendRequests(userId: string): FriendRequestsResponse {
  const sentIds = userSentRequests.get(userId) ?? new Set();
  const receivedIds = userReceivedRequests.get(userId) ?? new Set();

  const sent = Array.from(sentIds)
    .map((id) => friendRequests.get(id))
    .filter((r): r is FriendRequest => r !== undefined && r.status === 'pending');

  const received = Array.from(receivedIds)
    .map((id) => friendRequests.get(id))
    .filter((r): r is FriendRequest => r !== undefined && r.status === 'pending');

  return { sent, received };
}

/**
 * Find existing request between two users.
 */
function findExistingRequest(userId1: string, userId2: string): FriendRequest | undefined {
  for (const request of friendRequests.values()) {
    if (
      (request.fromUserId === userId1 && request.toUserId === userId2) ||
      (request.fromUserId === userId2 && request.toUserId === userId1)
    ) {
      if (request.status === 'pending') {
        return request;
      }
    }
  }
  return undefined;
}

/**
 * Clean up request indices after response.
 */
function cleanupRequestIndices(request: FriendRequest): void {
  const fromSent = userSentRequests.get(request.fromUserId);
  fromSent?.delete(request.id);

  const toReceived = userReceivedRequests.get(request.toUserId);
  toReceived?.delete(request.id);
}

// ============================================================
// Daily Request Counting
// ============================================================

function getDailyRequestCount(userId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}:${today}`;
  return dailyRequestCounts.get(key) ?? 0;
}

function updateDailyRequestCount(userId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}:${today}`;
  dailyRequestCounts.set(key, (dailyRequestCounts.get(key) ?? 0) + 1);
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearFriendSystem(): void {
  friendRelationships.clear();
  userFriends.clear();
  friendRequests.clear();
  userSentRequests.clear();
  userReceivedRequests.clear();
  blocks.clear();
  userBlocks.clear();
  dailyRequestCounts.clear();
}

export function _getFriendCount(userId: string): number {
  return userFriends.get(userId)?.size ?? 0;
}

export function _getRequestCount(): number {
  return friendRequests.size;
}

export function _getBlockCount(): number {
  return blocks.size;
}
