/**
 * GTX Rush — AI Feature Store v1.0
 *
 * Aggregated, NON-SENSITIVE behavioral features only (§2, §36, §37).
 * Separates: raw events → aggregated features → model outputs.
 *
 * PROHIBITED: religion, political beliefs, sexual orientation, health,
 * or any sensitive trait inference. This store contains gameplay
 * behavior only.
 *
 * Contract: AI Intelligence Contract v1.0
 */

import type { ContentFeatures, PlayerFeatures } from '@gtx-rush/types';

// ============================================================
// In-memory stores (production: PostgreSQL feature tables)
// ============================================================

interface RawGameplayEvent {
  userId: string;
  gameId: string;
  eventType: 'game_completed' | 'challenge_sent' | 'challenge_received' | 'event_joined'
    | 'creator_content_played' | 'social_action';
  score?: number;
  sessionMinutes?: number;
  timestamp: number;
}

const rawEvents = new Map<string, RawGameplayEvent[]>(); // userId → events
const contentFeatures = new Map<string, ContentFeatures>(); // contentId → features

// ============================================================
// Event Ingestion
// ============================================================

/**
 * Record a gameplay event. Server-side only — client-reported features
 * are never trusted.
 */
export function recordGameplayEvent(event: Omit<RawGameplayEvent, 'timestamp'> & { timestamp?: number }): void {
  const record: RawGameplayEvent = {
    ...event,
    timestamp: event.timestamp ?? Date.now(),
  };
  const list = rawEvents.get(record.userId) ?? [];
  list.push(record);

  // Retention policy (§37): prune raw events beyond window
  const cutoff =
    Date.now() - 90 * 24 * 60 * 60 * 1000;
  const pruned = list.filter((e) => e.timestamp >= cutoff);
  rawEvents.set(record.userId, pruned);
}

// ============================================================
// Player Features (§2)
// ============================================================

/**
 * Compute aggregated player features from raw events.
 */
export function computePlayerFeatures(userId: string): PlayerFeatures {
  const events = rawEvents.get(userId) ?? [];
  const now = Date.now();

  const gameCounts = new Map<string, number>();
  let totalSessionMinutes = 0;
  let sessionsWithMinutes = 0;
  let challengeActivity = 0;
  let eventParticipation = 0;
  let creatorActivity = 0;
  let socialActivity = 0;

  for (const event of events) {
    gameCounts.set(event.gameId, (gameCounts.get(event.gameId) ?? 0) + 1);
    if (event.sessionMinutes !== undefined && event.sessionMinutes > 0) {
      totalSessionMinutes += event.sessionMinutes;
      sessionsWithMinutes++;
    }
    if (
      event.eventType === 'challenge_sent' ||
      event.eventType === 'challenge_received'
    ) {
      challengeActivity++;
    }
    if (event.eventType === 'event_joined') eventParticipation++;
    if (event.eventType === 'creator_content_played') creatorActivity++;
    if (event.eventType === 'social_action') socialActivity++;
  }

  // Active days in last 7 days (UTC day buckets)
  const activeDaysLast7 = new Set<string>();
  for (const event of events) {
    if (now - event.timestamp <= 7 * 24 * 60 * 60 * 1000) {
      activeDaysLast7.add(new Date(event.timestamp).toISOString().slice(0, 10));
    }
  }

  const lastEvent = events.reduce<number>(
    (max, e) => Math.max(max, e.timestamp),
    0,
  );

  const preferredGames = Array.from(gameCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([game]) => game);

  return {
    userId,
    gamesPlayed: events.filter((e) => e.eventType === 'game_completed').length,
    preferredGames,
    averageSessionMinutes:
      sessionsWithMinutes > 0 ? totalSessionMinutes / sessionsWithMinutes : 0,
    challengeActivity,
    difficultyPreference: difficultyFromPerformance(events),
    eventParticipation,
    creatorActivity,
    socialActivity,
    daysSinceLastActive:
      lastEvent > 0 ? Math.floor((now - lastEvent) / (24 * 60 * 60 * 1000)) : -1,
    activeDaysLast7: activeDaysLast7.size,
    computedAt: new Date(),
  };
}

function difficultyFromPerformance(events: RawGameplayEvent[]): string {
  const scores = events
    .filter((e) => e.score !== undefined)
    .map((e) => e.score as number);
  if (scores.length < 5) return 'unknown';

  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  if (avg > 8000) return 'expert';
  if (avg > 5000) return 'hard';
  if (avg > 2000) return 'normal';
  return 'easy';
}

// ============================================================
// Content Features (§16)
// ============================================================

interface ContentObservation {
  plays: number;
  completions: number;
  repeatPlayers: Set<string>;
  abandonments: number;
  reports: number;
  positiveReactions: number;
}

const contentObservations = new Map<string, ContentObservation>();
const contentCreatedAt = new Map<string, number>();

export function recordContentPlay(
  contentId: string,
  playerId: string,
  outcome: 'completed' | 'abandoned',
): void {
  let obs = contentObservations.get(contentId);
  if (!obs) {
    obs = {
      plays: 0,
      completions: 0,
      repeatPlayers: new Set(),
      abandonments: 0,
      reports: 0,
      positiveReactions: 0,
    };
    contentObservations.set(contentId, obs);
    if (!contentCreatedAt.has(contentId)) contentCreatedAt.set(contentId, Date.now());
  }

  obs.plays++;
  if (outcome === 'completed') obs.completions++;
  else obs.abandonments++;
  obs.repeatPlayers.add(playerId);
}

export function recordContentReport(contentId: string): void {
  const obs = ensureContentObs(contentId);
  obs.reports++;
}

export function recordContentReaction(contentId: string, positive: boolean): void {
  const obs = ensureContentObs(contentId);
  if (positive) obs.positiveReactions++;
}

function ensureContentObs(contentId: string): ContentObservation {
  let obs = contentObservations.get(contentId);
  if (!obs) {
    obs = {
      plays: 0,
      completions: 0,
      repeatPlayers: new Set(),
      abandonments: 0,
      reports: 0,
      positiveReactions: 0,
    };
    contentObservations.set(contentId, obs);
    if (!contentCreatedAt.has(contentId)) contentCreatedAt.set(contentId, Date.now());
  }
  return obs;
}

export function computeContentFeatures(contentId: string, creatorId: string, textFingerprint: string): ContentFeatures {
  const obs = contentObservations.get(contentId);
  const createdAt = contentCreatedAt.get(contentId) ?? Date.now();

  return {
    contentId,
    creatorId,
    completionRate: obs && obs.plays > 0 ? obs.completions / obs.plays : 0,
    repeatPlayRate: obs ? obs.repeatPlayers.size / Math.max(1, obs.plays) : 0,
    abandonmentRate: obs && obs.plays > 0 ? obs.abandonments / obs.plays : 0,
    reportCount: obs?.reports ?? 0,
    positiveReactions: obs?.positiveReactions ?? 0,
    playCount: obs?.plays ?? 0,
    ageDays: Math.floor((Date.now() - createdAt) / (24 * 60 * 60 * 1000)),
    textFingerprint,
    computedAt: new Date(),
  };
}

// ============================================================
// Text Fingerprinting (for duplicate detection §20)
// ============================================================

/**
 * Normalize text into a comparable fingerprint token set.
 * Deliberately simple and cheap (MVP cost controls §41).
 */
export function computeTextFingerprint(text: string): string {
  return normalizeForComparison(text).join(' ');
}

export function normalizeForComparison(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Jaccard similarity between two texts (0-1).
 */
export function textSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeForComparison(a));
  const tokensB = new Set(normalizeForComparison(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  return intersection / (tokensA.size + tokensB.size - intersection);
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearFeatureStore(): void {
  rawEvents.clear();
  contentFeatures.clear();
  contentObservations.clear();
  contentCreatedAt.clear();
}
