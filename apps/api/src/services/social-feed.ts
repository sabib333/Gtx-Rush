/**
 * GTX Rush — Social Feed v1.0
 *
 * Social feed system that handles:
 * - Activity feed events
 * - Reactions
 * - Feed queries
 *
 * SECURITY:
 * - Feed events are server-generated
 * - Reactions are rate-limited
 * - No unrestricted posting
 *
 * Contract: Social Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  FeedEvent,
  FeedEventWithUser,
  FeedReaction,
  FeedEventType,
  ReactionType,
  FeedResponse,
} from '@gtx-rush/types';
import {
  FEED_CONFIG,
  REACTION_CONFIG,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const feedEvents = new Map<string, FeedEvent>();
const userFeedEvents = new Map<string, Set<string>>(); // userId → Set of eventIds
const teamFeedEvents = new Map<string, Set<string>>(); // teamId → Set of eventIds
const feedReactions = new Map<string, FeedReaction[]>(); // eventId → reactions
const userReactions = new Map<string, Set<string>>(); // userId:eventId → Set of reactionTypes
const dailyReactionCounts = new Map<string, number>(); // userId:YYYY-MM-DD → count

// ============================================================
// Feed Event Creation
// ============================================================

/**
 * Create a feed event.
 *
 * SECURITY:
 * - Events are server-generated only
 * - No user-submitted content
 */
export function createFeedEvent(
  type: FeedEventType,
  userId: string,
  title: string,
  description: string,
  teamId: string | null = null,
  metadata: Record<string, unknown> = {},
): FeedEvent {
  const event: FeedEvent = {
    id: nanoid(),
    type,
    userId,
    teamId,
    title,
    description,
    metadata,
    reactions: [],
    reactionCount: 0,
    createdAt: new Date(),
  };

  feedEvents.set(event.id, event);

  // Update indices
  const userEvents = userFeedEvents.get(userId) ?? new Set();
  userEvents.add(event.id);
  userFeedEvents.set(userId, userEvents);

  if (teamId) {
    const teamEvents = teamFeedEvents.get(teamId) ?? new Set();
    teamEvents.add(event.id);
    teamFeedEvents.set(teamId, teamEvents);
  }

  return event;
}

/**
 * Create a level up event.
 */
export function createLevelUpEvent(
  userId: string,
  newLevel: number,
): FeedEvent {
  return createFeedEvent(
    'level_up',
    userId,
    'Level Up!',
    `Reached Level ${newLevel}`,
    null,
    { newLevel },
  );
}

/**
 * Create a rank change event.
 */
export function createRankChangeEvent(
  userId: string,
  previousRank: number,
  newRank: number,
  leaderboardType: string,
): FeedEvent {
  const improved = newRank < previousRank;
  return createFeedEvent(
    'rank_change',
    userId,
    improved ? 'Rank Improved!' : 'Rank Update',
    improved
      ? `Moved from #${previousRank} to #${newRank}`
      : `Currently ranked #${newRank}`,
    null,
    { previousRank, newRank, leaderboardType },
  );
}

/**
 * Create a challenge won event.
 */
export function createChallengeWonEvent(
  userId: string,
  gameId: string,
  score: number,
  opponentName: string,
): FeedEvent {
  const gameNames: Record<string, string> = {
    'reaction-rush': 'Reaction Rush',
    'tap-rush': 'Tap Rush',
    'quiz-rush': 'Quiz Rush',
  };
  const gameName = gameNames[gameId] ?? 'GTX Rush';

  return createFeedEvent(
    'challenge_won',
    userId,
    'Challenge Won!',
    `Defeated ${opponentName} in ${gameName}`,
    null,
    { gameId, score, opponentName },
  );
}

/**
 * Create a team achievement event.
 */
export function createTeamAchievementEvent(
  userId: string,
  teamId: string,
  achievementName: string,
): FeedEvent {
  return createFeedEvent(
    'team_achievement',
    userId,
    'Team Achievement!',
    `Team unlocked: ${achievementName}`,
    teamId,
    { achievementName },
  );
}

/**
 * Create a badge unlocked event.
 */
export function createBadgeUnlockedEvent(
  userId: string,
  badgeName: string,
  rarity: string,
): FeedEvent {
  return createFeedEvent(
    'badge_unlocked',
    userId,
    'Badge Unlocked!',
    `Earned: ${badgeName}`,
    null,
    { badgeName, rarity },
  );
}

/**
 * Create an event completed event.
 */
export function createEventCompletedEvent(
  userId: string,
  eventId: string,
  eventName: string,
  rank: number,
): FeedEvent {
  return createFeedEvent(
    'event_completed',
    userId,
    'Event Completed!',
    `Finished #${rank} in ${eventName}`,
    null,
    { eventId, eventName, rank },
  );
}

// ============================================================
// Reactions
// ============================================================

/**
 * Add a reaction to a feed event.
 *
 * SECURITY:
 * - Rate limited
 * - One reaction per type per user per event
 */
export function addReaction(
  feedEventId: string,
  userId: string,
  type: ReactionType,
): {
  success: boolean;
  reaction?: FeedReaction;
  error?: string;
} {
  const event = feedEvents.get(feedEventId);
  if (!event) {
    return { success: false, error: 'EVENT_NOT_FOUND' };
  }

  // Check rate limit
  const dailyCount = getDailyReactionCount(userId);
  if (dailyCount >= FEED_CONFIG.maxReactionsPerEvent) {
    return { success: false, error: 'DAILY_LIMIT_REACHED' };
  }

  // Check if user already reacted with this type
  const userEventReactions = getUserEventReactions(userId, feedEventId);
  if (userEventReactions.has(type)) {
    return { success: false, error: 'ALREADY_REACTED' };
  }

  // Check max reactions per event
  const eventReactions = feedReactions.get(feedEventId) ?? [];
  if (eventReactions.length >= FEED_CONFIG.maxReactionsPerEvent) {
    return { success: false, error: 'MAX_REACTIONS_REACHED' };
  }

  // Create reaction
  const reaction: FeedReaction = {
    id: nanoid(),
    feedEventId,
    userId,
    type,
    createdAt: new Date(),
  };

  eventReactions.push(reaction);
  feedReactions.set(feedEventId, eventReactions);

  // Update user reactions
  userEventReactions.add(type);
  const key = `${userId}:${feedEventId}`;
  userReactions.set(key, userEventReactions);

  // Update event reaction count
  event.reactionCount = eventReactions.length;

  // Update daily count
  updateDailyReactionCount(userId);

  return { success: true, reaction };
}

/**
 * Remove a reaction from a feed event.
 */
export function removeReaction(
  feedEventId: string,
  userId: string,
  type: ReactionType,
): {
  success: boolean;
  error?: string;
} {
  const event = feedEvents.get(feedEventId);
  if (!event) {
    return { success: false, error: 'EVENT_NOT_FOUND' };
  }

  const userEventReactions = getUserEventReactions(userId, feedEventId);
  if (!userEventReactions.has(type)) {
    return { success: false, error: 'NO_REACTION' };
  }

  // Remove reaction
  const eventReactions = feedReactions.get(feedEventId) ?? [];
  const index = eventReactions.findIndex((r) => r.userId === userId && r.type === type);
  if (index >= 0) {
    eventReactions.splice(index, 1);
  }

  // Update user reactions
  userEventReactions.delete(type);

  // Update event count
  event.reactionCount = eventReactions.length;

  return { success: true };
}

/**
 * Get user's reactions for an event.
 */
function getUserEventReactions(userId: string, feedEventId: string): Set<ReactionType> {
  const key = `${userId}:${feedEventId}`;
  return (userReactions.get(key) ?? new Set()) as Set<ReactionType>;
}

// ============================================================
// Feed Queries
// ============================================================

/**
 * Get user's feed.
 */
export function getUserFeed(
  userId: string,
  options: {
    cursor?: string;
    limit?: number;
  } = {},
): FeedResponse {
  const { cursor, limit = FEED_CONFIG.defaultPageSize } = options;

  // Get events from user and their friends/teams
  const eventIds = userFeedEvents.get(userId) ?? new Set();
  let events = Array.from(eventIds)
    .map((id) => feedEvents.get(id))
    .filter((e): e is FeedEvent => e !== undefined);

  // Sort by creation date (newest first)
  events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Cursor-based pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = events.findIndex((e) => e.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginated = events.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < events.length;
  const nextCursor = hasMore ? paginated[paginated.length - 1]?.id ?? null : null;

  // Convert to FeedEventWithUser
  const eventsWithUser: FeedEventWithUser[] = paginated.map((e) => ({
    ...e,
    user: {
      id: e.userId,
      displayName: `Player ${e.userId.slice(0, 8)}`,
      avatarUrl: null,
      level: 1,
    },
  }));

  return {
    events: eventsWithUser,
    pagination: { nextCursor, hasMore },
  };
}

/**
 * Get team feed.
 */
export function getTeamFeed(
  teamId: string,
  options: {
    cursor?: string;
    limit?: number;
  } = {},
): FeedResponse {
  const { cursor, limit = FEED_CONFIG.defaultPageSize } = options;

  const eventIds = teamFeedEvents.get(teamId) ?? new Set();
  let events = Array.from(eventIds)
    .map((id) => feedEvents.get(id))
    .filter((e): e is FeedEvent => e !== undefined);

  events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = events.findIndex((e) => e.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginated = events.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < events.length;
  const nextCursor = hasMore ? paginated[paginated.length - 1]?.id ?? null : null;

  const eventsWithUser: FeedEventWithUser[] = paginated.map((e) => ({
    ...e,
    user: {
      id: e.userId,
      displayName: `Player ${e.userId.slice(0, 8)}`,
      avatarUrl: null,
      level: 1,
    },
  }));

  return {
    events: eventsWithUser,
    pagination: { nextCursor, hasMore },
  };
}

/**
 * Get a feed event by ID.
 */
export function getFeedEvent(eventId: string): FeedEvent | null {
  return feedEvents.get(eventId) ?? null;
}

// ============================================================
// Daily Reaction Counting
// ============================================================

function getDailyReactionCount(userId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}:${today}`;
  return dailyReactionCounts.get(key) ?? 0;
}

function updateDailyReactionCount(userId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}:${today}`;
  dailyReactionCounts.set(key, (dailyReactionCounts.get(key) ?? 0) + 1);
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearSocialFeed(): void {
  feedEvents.clear();
  userFeedEvents.clear();
  teamFeedEvents.clear();
  feedReactions.clear();
  userReactions.clear();
  dailyReactionCounts.clear();
}

export function _getFeedEventCount(): number {
  return feedEvents.size;
}

export function _getReactionCount(eventId: string): number {
  return (feedReactions.get(eventId) ?? []).length;
}


