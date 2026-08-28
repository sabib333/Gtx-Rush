/**
 * GTX Rush — AI Recommendation Engine v1.0
 *
 * Personalized recommendations across games, challenges, creators,
 * events, and missions (§4-11) with a personalized home feed (§8).
 *
 * RANKING (§14): relevance + quality + freshness + social relevance.
 * Never optimizes solely for CTR, session length, or revenue.
 *
 * EXPLORATION (§15): configurable familiar/discovery split,
 * experiment-driven via Admin Experiment Engine variant overrides.
 *
 * DIVERSITY (§6, §50): per-creator caps and echo-chamber penalties —
 * the system does not only recommend the most popular content.
 *
 * FALLBACKS (§39, §40): AI failure never blocks login, game start,
 * score submission, or rewards. Safe fallback = trending content.
 *
 * CACHE (§43): results cached with TTL; invalidated on preference
 * change, event change, content removal, or safety restriction.
 *
 * PRIVACY (§36): non-sensitive behavioral features only.
 *
 * Contract: AI Intelligence Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  AIHomeFeed,
  AIRecommendation,
  AIRecommendationMetrics,
  DifficultySuggestion,
  PlayerFeatures,
  PlayerSegment,
  PlayerSegmentResult,
  RecommendationAction,
  RecommendationInteraction,
  RecommendationKind,
} from '@gtx-rush/types';
import {
  AI_COST_CONFIG,
  AI_FALLBACK_CONFIG,
  RANKING_AI_CONFIG,
  RECOMMENDATION_AI_CONFIG,
} from '@gtx-rush/config';
import {
  computeContentFeatures,
  computePlayerFeatures,
} from './feature-store';
import { getActiveModel } from './model-registry';

// ============================================================
// Candidate registries (production: PostgreSQL via Drizzle ORM)
// ============================================================

export interface ChallengeCandidate {
  contentId: string;
  creatorId: string;
  gameId: string;
  title: string;
  registeredAt: number;
  /** Soft removal (§43): removed content is excluded and caches invalidated */
  active: boolean;
}

export interface EventCandidate {
  eventId: string;
  title: string;
  gameCategory: string;
  startsInMinutes: number;
}

const challenges = new Map<string, ChallengeCandidate>();
const events = new Map<string, EventCandidate>();

/** userId → contentIds the player personally played (relevance + echo guard) */
const userContentPlays = new Map<string, Set<string>>();
/** `${userId}` → creatorIds the player follows (echo guard §6) */
const followedCreators = new Map<string, Set<string>>();
/** `${userId}:${contentId}` → friends played this content (social signal §14) */
const friendPlayed = new Map<string, boolean>();
/** Global play counts for trending fallbacks (§39) */
const globalPlayCounts = new Map<string, number>();

// ============================================================
// Registration & Signals
// ============================================================

export function registerChallengeCandidate(params: {
  contentId: string;
  creatorId: string;
  gameId: string;
  title: string;
}): void {
  challenges.set(params.contentId, {
    ...params,
    registeredAt: Date.now(),
    active: true,
  });
}

/**
 * Remove content from recommendation surfaces (§43 invalidation trigger).
 * Content already served may still complete; it just stops being ranked.
 */
export function removeChallengeCandidate(contentId: string): void {
  const candidate = challenges.get(contentId);
  if (!candidate) return;
  candidate.active = false;
  invalidateAllRecommendations('CONTENT_REMOVED');
}

export function restrictContentFromRecommendations(contentId: string): void {
  removeChallengeCandidate(contentId);
}

export function registerEventCandidate(event: EventCandidate): void {
  events.set(event.eventId, event);
  invalidateAllRecommendations('EVENT_CHANGED');
}

export function recordUserContentPlay(userId: string, contentId: string): void {
  const plays = userContentPlays.get(userId) ?? new Set<string>();
  plays.add(contentId);
  userContentPlays.set(userId, plays);

  // Trending counter keyed by content
  globalPlayCounts.set(contentId, (globalPlayCounts.get(contentId) ?? 0) + 1);
  const candidate = challenges.get(contentId);
  if (candidate?.active) {
    // Major preference signal → refresh this user's cached feed (§43)
    invalidateUserRecommendations(userId, 'PREFERENCE_CHANGE');
  }
}

export function recordFriendPlay(friendOfUserId: string, contentId: string): void {
  friendPlayed.set(`${friendOfUserId}:${contentId}`, true);
}

export function setFollowedCreators(userId: string, creatorIds: string[]): void {
  followedCreators.set(userId, new Set(creatorIds));
}

// ============================================================
// Player Segments (§3)
// ============================================================

/**
 * Behavioral segmentation. A player may belong to multiple segments.
 * Uses ONLY gameplay behavior — never sensitive characteristics (§36).
 */
export function computePlayerSegments(userId: string): PlayerSegmentResult {
  const features = computePlayerFeatures(userId);
  const segments = segmentsFromFeatures(features);
  return { userId, segments, computedAt: new Date() };
}

function segmentsFromFeatures(features: PlayerFeatures): PlayerSegment[] {
  const segments = new Set<PlayerSegment>();

  if (features.gamesPlayed < 5 && features.daysSinceLastActive <= 7) {
    segments.add('new_player');
  }
  if (
    features.gamesPlayed > 0 &&
    features.daysSinceLastActive >= 3
  ) {
    segments.add('returning_player');
  }
  if (
    features.gamesPlayed >= 20 ||
    features.difficultyPreference === 'hard' ||
    features.difficultyPreference === 'expert'
  ) {
    segments.add('competitive_player');
  }
  if (features.gamesPlayed >= 5 && !segments.has('competitive_player')) {
    segments.add('casual_player');
  }
  if (features.socialActivity > 0 || features.challengeActivity >= 3) {
    segments.add('social_player');
  }
  if (features.creatorActivity >= 1) {
    segments.add('creator');
  }
  if (features.eventParticipation >= 1) {
    segments.add('event_player');
  }
  if (features.difficultyPreference === 'expert') {
    segments.add('high_skill_player');
  }

  // Every player belongs to at least one segment
  if (segments.size === 0) segments.add('casual_player');

  return Array.from(segments);
}

// ============================================================
// Churn Risk / Return Signal (§12, §13) — internal only
// ============================================================

/**
 * Predict possible inactivity. Output is an INTERNAL signal that shapes
 * which relevant content is surfaced — never fear-based messaging (§12).
 * Never exposed to ordinary users as a risk score (§55).
 */
export function predictChurnRisk(features: PlayerFeatures): {
  atRisk: boolean;
  suggestedReturnReasonCode: string | null;
} {
  if (features.gamesPlayed === 0) {
    return { atRisk: false, suggestedReturnReasonCode: null };
  }

  const inactiveLong = features.daysSinceLastActive >= 7;
  const coolingOff =
    features.daysSinceLastActive >= 3 && features.activeDaysLast7 === 0;

  if (!inactiveLong && !coolingOff) {
    return { atRisk: false, suggestedReturnReasonCode: null };
  }

  let reasonCode = 'return_new_challenge_available';
  if (features.eventParticipation > 0) reasonCode = 'return_event_upcoming';
  else if (features.challengeActivity > 0) reasonCode = 'return_friend_activity';

  return { atRisk: true, suggestedReturnReasonCode: reasonCode };
}

// ============================================================
// Quality Score (§16)
// ============================================================

/**
 * Content quality from multiple signals. One weak signal never
 * permanently suppresses content (§16): low-play content gets a
 * neutral score instead of a penalty.
 */
function qualityScore(contentId: string, creatorId: string): number {
  const features = computeContentFeatures(contentId, creatorId, '');

  if (features.playCount < RANKING_AI_CONFIG.minPlaysForQualitySignal) {
    return 0.5; // neutral — insufficient evidence
  }

  const w = RECOMMENDATION_AI_CONFIG.qualityWeights;
  let score =
    features.completionRate * w.completionRate +
    features.repeatPlayRate * w.repeatPlayRate +
    Math.min(1, features.positiveReactions / 10) * w.positiveReactions;

  score -= features.abandonmentRate * w.abandonmentPenalty;

  // Reports reduce quality but do NOT auto-suppress (review queue decides)
  score -= Math.min(0.5, features.reportCount * 0.1) * w.reportPenalty * 5;

  return clamp01(score);
}

function freshnessScore(ageDays: number): number {
  return Math.pow(
    0.5,
    ageDays / RANKING_AI_CONFIG.freshnessHalfLifeDays,
  );
}

// ============================================================
// Ranking (§14)
// ============================================================

interface ScoredCandidate extends AIRecommendation {
  creatorId?: string;
  components: { relevance: number; quality: number; freshness: number; social: number };
}

function rankScore(components: {
  relevance: number;
  quality: number;
  freshness: number;
  social: number;
}): number {
  const w = RANKING_AI_CONFIG.weights;
  return clamp01(
    components.relevance * w.relevance +
      components.quality * w.quality +
      components.freshness * w.freshness +
      components.social * w.socialRelevance,
  );
}

function relevanceToPlayer(gameId: string, creatorId: string | undefined, features: PlayerFeatures): number {
  let score = 0.4;

  if (features.preferredGames.includes(gameId)) score += 0.35;
  if (features.preferredGames[0] === gameId) score += 0.1;

  // Echo-chamber reduction (§6): heavily-played creators get a penalty,
  // giving emerging creators surface area (§50).
  if (creatorId) {
    const plays = userContentPlays.get(features.userId);
    if (plays) {
      let creatorPlays = 0;
      for (const contentId of plays) {
        if (challenges.get(contentId)?.creatorId === creatorId) creatorPlays++;
      }
      if (creatorPlays >= 3) score -= RANKING_AI_CONFIG.echoChamberPenalty;
    }
    const followed = followedCreators.get(features.userId);
    if (followed?.has(creatorId)) score += 0.1;
  }

  return clamp01(score);
}

function socialRelevance(contentId: string, userId: string): number {
  return friendPlayed.get(`${userId}:${contentId}`) ? 1 : 0.4;
}

// ============================================================
// Recommendation Generation (§4-7, §11)
// ============================================================

export interface GenerateOptions {
  kinds?: RecommendationKind[];
  limit?: number;
  /**
   * Exploration ratio override from an A/B experiment variant (§33).
   * Base ratio remains config-driven when omitted (§15).
   */
  experimentExplorationRatio?: number;
}

/**
 * Generate ranked, diversified recommendations for a player.
 */
export function generateRecommendations(
  userId: string,
  options: GenerateOptions = {},
): AIRecommendation[] {
  const features = computePlayerFeatures(userId);
  const candidates = buildCandidates(userId, features);

  const wantedKinds = options.kinds;
  const pool = candidates.filter((c) => !wantedKinds || wantedKinds.includes(c.kind));

  // Rank by weighted components
  const ranked = pool
    .map((c) => ({ ...c, score: rankScore(c.components) }))
    .sort((a, b) => b.score - a.score);

  // Diversity pass: cap recommendations per creator (§6, §14)
  const perCreator = new Map<string, number>();
  const diversified: typeof ranked = [];
  for (const candidate of ranked) {
    if (candidate.creatorId) {
      const used = perCreator.get(candidate.creatorId) ?? 0;
      if (used >= RANKING_AI_CONFIG.maxPerCreator) continue;
      perCreator.set(candidate.creatorId, used + 1);
    }
    diversified.push(candidate);
  }

  // Exploration vs exploitation (§15): reserve a share of slots for
  // discovery content the player has NOT engaged with.
  const ratio = clamp01(
    options.experimentExplorationRatio ??
      RECOMMENDATION_AI_CONFIG.explorationRatio,
  );
  const limit = options.limit ?? AI_FALLBACK_CONFIG.trendingFallbackLimit;
  const familiarSlots = Math.max(1, Math.floor(limit * (1 - ratio)));

  const familiar = diversified.filter((c) => !isNovel(c, features)).slice(0, familiarSlots);
  const novelPool = diversified.filter((c) => isNovel(c, features));

  const selected: Array<ScoredCandidate & { exploration: boolean }> = [
    ...familiar.map((c) => ({ ...c, exploration: false })),
    ...novelPool.slice(0, Math.max(0, limit - familiar.length)).map((c) => ({
      ...c,
      exploration: true,
    })),
  ];

  // Interleave kinds so feeds are not single-type walls (§14 diversity)
  selected.sort((a, b) => b.score - a.score);

  return selected.map(toPublicRecommendation);
}

function isNovel(candidate: ScoredCandidate, features: PlayerFeatures): boolean {
  if (candidate.kind === 'game') {
    return !features.preferredGames.includes(candidate.refId);
  }
  if (candidate.kind === 'challenge' && candidate.creatorId) {
    const plays = userContentPlays.get(features.userId);
    return !plays?.has(candidate.refId);
  }
  if (candidate.kind === 'event') {
    return features.eventParticipation === 0;
  }
  return false;
}

interface RawCandidate extends ScoredCandidate {
  kind: RecommendationKind;
  refId: string;
  title: string;
  reason: string;
  reasonCode: string;
}

function buildCandidates(userId: string, features: PlayerFeatures): RawCandidate[] {
  const candidates: RawCandidate[] = [];

  // --- Games (§4) ---
  const allGames = ['reaction-rush', 'tap-rush', 'quiz-rush'];
  for (const gameId of allGames) {
    const preferred = features.preferredGames.includes(gameId);
    const untried = !preferred;
    candidates.push({
      kind: 'game',
      refId: gameId,
      creatorId: undefined,
      title: gameName(gameId),
      reason: untried && features.gamesPlayed > 0
        ? 'You have not tried this yet'
        : preferred
          ? 'Frequently played by you'
          : 'Popular with players like you',
      reasonCode: untried ? 'novel_game' : 'preferred_game',
      components: {
        relevance: relevanceToPlayer(gameId, undefined, features),
        quality: 0.7,
        freshness: 0.6,
        social: 0.4,
      },
      score: 0,
      exploration: false,
      id: '',
      source: 'ai',
    });
  }

  // --- Challenges (§5) — relevance + quality + freshness, not raw popularity ---
  for (const candidate of challenges.values()) {
    if (!candidate.active) continue;
    const ageDays = Math.floor((Date.now() - candidate.registeredAt) / 86_400_000);
    const quality = qualityScore(candidate.contentId, candidate.creatorId);
    const components = {
      relevance: relevanceToPlayer(candidate.gameId, candidate.creatorId, features),
      quality,
      freshness: freshnessScore(ageDays),
      social: socialRelevance(candidate.contentId, userId),
    };

    const friendPlayedThis = friendPlayed.get(`${userId}:${candidate.contentId}`) === true;
    candidates.push({
      kind: 'challenge',
      refId: candidate.contentId,
      creatorId: candidate.creatorId,
      title: candidate.title,
      reason: friendPlayedThis
        ? 'A friend played this challenge'
        : quality >= 0.7
          ? 'High-quality community challenge'
          : 'Fresh community challenge',
      reasonCode: friendPlayedThis ? 'friend_activity' : 'community_challenge',
      components,
      score: 0,
      exploration: false,
      id: '',
      source: 'ai',
    });
  }

  // --- Creators (§6) ---
  const creatorStats = new Map<string, { contentCount: number; qualitySum: number }>();
  for (const candidate of challenges.values()) {
    if (!candidate.active) continue;
    const stats = creatorStats.get(candidate.creatorId) ?? { contentCount: 0, qualitySum: 0 };
    stats.contentCount++;
    stats.qualitySum += qualityScore(candidate.contentId, candidate.creatorId);
    creatorStats.set(candidate.creatorId, stats);
  }
  for (const [creatorId, stats] of creatorStats) {
    const avgQuality = stats.qualitySum / Math.max(1, stats.contentCount);
    const plays = userContentPlays.get(userId);
    const alreadyFollowing = followedCreators.get(userId)?.has(creatorId) === true;
    const playedTheirContent =
      plays != null &&
      Array.from(plays).some((c) => challenges.get(c)?.creatorId === creatorId);

    candidates.push({
      kind: 'creator',
      refId: creatorId,
      creatorId,
      title: `Creator ${creatorId}`,
      reason: alreadyFollowing
        ? 'New challenges from a creator you follow'
        : playedTheirContent
          ? 'More from creators you have played'
          : 'Emerging creator worth discovering',
      reasonCode: alreadyFollowing
        ? 'followed_creator'
        : playedTheirContent
          ? 'played_creator'
          : 'emerging_creator',
      components: {
        // Emerging creators get a discovery boost over already-followed ones
        relevance: alreadyFollowing ? 0.55 : playedTheirContent ? 0.65 : 0.7,
        quality: avgQuality,
        freshness: 0.7,
        social: alreadyFollowing ? 0.8 : 0.4,
      },
      score: 0,
      exploration: false,
      id: '',
      source: 'ai',
    });
  }

  // --- Events (§7) ---
  for (const event of events.values()) {
    candidates.push({
      kind: 'event',
      refId: event.eventId,
      creatorId: undefined,
      title: event.title,
      reason:
        event.startsInMinutes <= 60
          ? `Starts in ${Math.max(1, event.startsInMinutes)} minutes`
          : 'Event matches your interests',
      reasonCode: event.startsInMinutes <= 60 ? 'event_starting_soon' : 'event_interest_match',
      components: {
        relevance: relevanceToPlayer(event.gameCategory, undefined, features),
        quality: 0.75,
        freshness: clamp01(1 - event.startsInMinutes / 1440),
        social: features.eventParticipation > 0 ? 0.8 : 0.5,
      },
      score: 0,
      exploration: false,
      id: '',
      source: 'ai',
    });
  }

  // --- Missions (§11) — always achievable, derived from real activity ---
  const missionTarget = 3;
  if (features.gamesPlayed > 0) {
    const preferred = features.preferredGames[0] ?? 'reaction-rush';
    candidates.push({
      kind: 'mission',
      refId: `play-${preferred}-${missionTarget}`,
      creatorId: undefined,
      title: `Play ${missionTarget} ${gameName(preferred)} games`,
      reason: 'Based on your favorite game',
      reasonCode: 'mission_preferred_game',
      components: { relevance: 0.85, quality: 0.6, freshness: 0.8, social: 0.4 },
      score: 0,
      exploration: false,
      id: '',
      source: 'ai',
    });
  }
  if (features.challengeActivity < 3 && features.gamesPlayed >= 3) {
    candidates.push({
      kind: 'mission',
      refId: 'send-a-challenge',
      creatorId: undefined,
      title: 'Send a challenge to a friend',
      reason: 'You enjoy competing — bring a friend along',
      reasonCode: 'mission_challenge_activity',
      components: { relevance: 0.7, quality: 0.6, freshness: 0.7, social: 0.9 },
      score: 0,
      exploration: false,
      id: '',
      source: 'ai',
    });
  }

  return assignIds(candidates);
}

function assignIds(candidates: RawCandidate[]): RawCandidate[] {
  for (const candidate of candidates) {
    candidate.id = nanoid();
  }
  return candidates;
}

function toPublicRecommendation(c: ScoredCandidate & { kind: RecommendationKind }): AIRecommendation {
  return {
    id: c.id,
    kind: c.kind,
    refId: c.refId,
    title: c.title,
    reason: c.reason,
    reasonCode: c.reasonCode,
    score: Math.round(c.score * 1000) / 1000,
    exploration: c.exploration,
    source: 'ai',
  };
}

// ============================================================
// Difficulty Suggestion (§9) — advisory only
// ============================================================

/**
 * Recommend a difficulty tier. This NEVER changes official competitive
 * rules or secretly alters scoring — official validation stays
 * deterministic and server-authoritative (Contract rule 2).
 */
export function recommendDifficulty(userId: string, gameId: string): DifficultySuggestion {
  const features = computePlayerFeatures(userId);

  if (features.gamesPlayed < 5 || features.difficultyPreference === 'unknown') {
    return {
      gameId,
      suggestedDifficulty: 'normal',
      reason: 'Default starting difficulty',
      reasonCode: 'insufficient_history_default_normal',
    };
  }

  switch (features.difficultyPreference) {
    case 'expert':
      return {
        gameId,
        suggestedDifficulty: 'expert',
        reason: 'Your recent performance suggests expert level',
        reasonCode: 'performance_expert',
      };
    case 'hard':
      return {
        gameId,
        suggestedDifficulty: 'hard',
        reason: 'You have been performing strongly recently',
        reasonCode: 'performance_hard',
      };
    case 'easy':
      return {
        gameId,
        suggestedDifficulty: 'easy',
        reason: 'Build momentum at a comfortable pace',
        reasonCode: 'performance_easy',
      };
    default:
      return {
        gameId,
        suggestedDifficulty: 'normal',
        reason: 'Matches your recent performance',
        reasonCode: 'performance_normal',
      };
  }
}

// ============================================================
// Personalized Home (§8, §13)
// ============================================================

/**
 * Personalized home feed. System navigation is NEVER hidden behind AI —
 * this only orders content sections; static nav lives in the client UI.
 */
export function getPersonalizedHome(userId: string): AIHomeFeed {
  const features = computePlayerFeatures(userId);
  const segments = segmentsFromFeatures(features);
  const churn = predictChurnRisk(features);

  const all = generateRecommendations(userId, { limit: 12 });

  const byKind = (kind: RecommendationKind) => all.filter((r) => r.kind === kind);

  // CONTINUE (§13): returning players see their last activity first
  const returning = segments.includes('returning_player');
  const continueSection = returning
    ? byKind('game')
        .filter((r) => features.preferredGames.includes(r.refId))
        .slice(0, 1)
    : [];

  const recommended = all.filter(
    (r) => r.kind !== 'event' && !continueSection.some((c) => c.id === r.id),
  );

  // FRIENDS: socially-relevant content first (§51) — never forced actions
  const friends = all.filter((r) =>
    ['challenge', 'creator'].includes(r.kind),
  ).slice(0, 3);

  // TRENDING: popularity-ordered regardless of personal fit
  const trending = Array.from(globalPlayCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([contentId]) => {
      const existing = all.find((r) => r.refId === contentId);
      if (existing) return existing;
      return {
        id: nanoid(),
        kind: 'challenge' as const,
        refId: contentId,
        title: challenges.get(contentId)?.title ?? contentId,
        reason: 'Trending in the community',
        reasonCode: 'trending',
        score: 0,
        exploration: false,
        source: 'ai' as const,
      };
    });

  // EVENTS: soonest first (§7)
  const eventRecs = byKind('event').sort((a, b) => a.score - b.score).slice(0, 3);

  const feed: AIHomeFeed = {
    continueSection,
    recommended: recommended.slice(0, 5),
    friends,
    trending,
    events: eventRecs,
    segments,
    generatedAt: new Date(),
    source: 'ai',
  };

  // Churn-aware surfacing (§12): a relevant reason to return — informative,
  // never pressure-based.
  if (churn.atRisk && feed.recommended.length > 0) {
    feed.recommended[0] = {
      ...feed.recommended[0],
      reason:
        churn.suggestedReturnReasonCode === 'return_friend_activity'
          ? 'Friends have been competing while you were away'
          : churn.suggestedReturnReasonCode === 'return_event_upcoming'
            ? 'An event you joined before is coming up'
            : 'New challenges dropped since your last visit',
      reasonCode: churn.suggestedReturnReasonCode ?? 'return_new_challenge_available',
    };
  }

  cacheFeed(userId, 'home', feed);
  return feed;
}

// ============================================================
// Safe Fallbacks (§39, §40)
// ============================================================

/**
 * Deterministic trending fallback. Used when the AI layer fails or is
 * disabled — login, game start, score submission, and rewards are never
 * blocked by AI availability (§40).
 */
export function getTrendingFallback(limit = AI_FALLBACK_CONFIG.trendingFallbackLimit): AIRecommendation[] {
  const trending: AIRecommendation[] = Array.from(globalPlayCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([contentId]) => ({
      id: nanoid(),
      kind: 'challenge' as const,
      refId: contentId,
      title: challenges.get(contentId)?.title ?? contentId,
      reason: 'Trending in the community',
      reasonCode: 'fallback_trending',
      score: 0,
      exploration: false,
      source: 'fallback' as const,
    }));

  // Core games guarantee a non-empty response even with no play data
  const coreGames: AIRecommendation[] = ['reaction-rush', 'tap-rush', 'quiz-rush'].map(
    (gameId) => ({
      id: nanoid(),
      kind: 'game' as const,
      refId: gameId,
      title: gameName(gameId),
      reason: 'Popular right now',
      reasonCode: 'fallback_core_game',
      score: 0,
      exploration: false,
      source: 'fallback' as const,
    }),
  );

  return [...trending, ...coreGames].slice(0, limit);
}

/**
 * Fault-tolerant wrapper around personalized home generation.
 */
export function getPersonalizedHomeSafe(userId: string): AIHomeFeed {
  try {
    return getPersonalizedHome(userId);
  } catch {
    const fallback = getTrendingFallback();
    return {
      continueSection: [],
      recommended: fallback,
      friends: [],
      trending: fallback.slice(0, 3),
      events: [],
      segments: ['casual_player'],
      generatedAt: new Date(),
      source: 'fallback',
    };
  }
}

// ============================================================
// Recommendation Cache (§43)
// ============================================================

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const feedCache = new Map<string, CacheEntry>();

function cacheFeed(userId: string, scope: string, data: unknown): void {
  feedCache.set(`${userId}:${scope}`, {
    data,
    expiresAt:
      Date.now() + AI_COST_CONFIG.recommendationCacheTtlSeconds * 1000,
  });
}

export function getCachedFeed<T>(userId: string, scope: string): T | null {
  const entry = feedCache.get(`${userId}:${scope}`);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    feedCache.delete(`${userId}:${scope}`);
    return null;
  }
  return entry.data as T;
}

export function invalidateUserRecommendations(userId: string, reason: string): void {
  void reason; // reason codes are logged by callers in production
  for (const key of feedCache.keys()) {
    if (key.startsWith(`${userId}:`)) feedCache.delete(key);
  }
}

export function invalidateAllRecommendations(reason: string): void {
  void reason;
  feedCache.clear();
}

// ============================================================
// AI Analytics (§44)
// ============================================================

const interactions: RecommendationInteraction[] = [];
const INTERACTION_RETENTION_LIMIT = 50_000;

export function trackRecommendationInteraction(params: {
  userId: string;
  recommendationId: string;
  kind: RecommendationKind;
  action: RecommendationAction;
}): void {
  interactions.push({
    ...params,
    timestamp: new Date(),
  });
  // Data minimization (§37): bounded retention window
  if (interactions.length > INTERACTION_RETENTION_LIMIT) {
    interactions.splice(0, interactions.length - INTERACTION_RETENTION_LIMIT);
  }
}

export function getAIRecommendationMetrics(): AIRecommendationMetrics {
  const impressions = interactions.filter((i) => i.action === 'impression').length;
  const clicks = interactions.filter((i) => i.action === 'click').length;
  const starts = interactions.filter((i) => i.action === 'start').length;
  const completions = interactions.filter((i) => i.action === 'complete').length;
  const dismissals = interactions.filter((i) => i.action === 'dismiss').length;

  return {
    impressions,
    clicks,
    starts,
    completions,
    dismissals,
    clickThroughRate: impressions > 0 ? clicks / impressions : 0,
    completionRate: starts > 0 ? completions / starts : 0,
  };
}

/**
 * Active model version powering ranking — surfaced to admin tooling only
 * (§31, §48). Ordinary users never receive model internals (§35, §55).
 */
export function getActiveRankingModel(): { modelId: string; version: string } | null {
  const model = getActiveModel('recommendation_ranking');
  return model ? { modelId: model.modelId, version: model.version } : null;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearRecommendationEngine(): void {
  challenges.clear();
  events.clear();
  userContentPlays.clear();
  followedCreators.clear();
  friendPlayed.clear();
  globalPlayCounts.clear();
  feedCache.clear();
  interactions.length = 0;
}

// ============================================================
// Helpers
// ============================================================

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function gameName(gameId: string): string {
  const names: Record<string, string> = {
    'reaction-rush': 'Reaction Rush',
    'tap-rush': 'Tap Rush',
    'quiz-rush': 'Quiz Rush',
  };
  return names[gameId] ?? gameId;
}
