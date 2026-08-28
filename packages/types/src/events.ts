/**
 * GTX Rush — Live Events & Tournament Types v1.0
 *
 * Type definitions for the Live Events & Tournament Engine.
 * Covers events, tournaments, scoring, leaderboards, and rewards.
 *
 * Contract: Live Ops Contract v1.0
 */

// ============================================================
// Enums / Literal Types
// ============================================================

export type EventStatus = 'draft' | 'scheduled' | 'active' | 'ending' | 'completed' | 'archived' | 'cancelled';
export type EventType = 'daily_event' | 'weekly_event' | 'weekend_event' | 'limited_event' | 'tournament' | 'championship' | 'community_event';
export type TournamentFormat = 'score_attack' | 'head_to_head' | 'elimination' | 'bracket' | 'swiss' | 'leaderboard_tournament';
export type ScoringFormula = 'best_score' | 'total_score' | 'average_score' | 'top_n_scores' | 'points_per_win';
export type EventVisibility = 'public' | 'private' | 'invite_only';
export type AttemptConstraint = 'unlimited' | 'limited' | 'daily' | 'event';
export type ScoreValidation = 'pending' | 'validated' | 'rejected' | 'held';
export type EventRewardStatus = 'pending' | 'distributed' | 'claimed' | 'expired';

// ============================================================
// Event Types
// ============================================================

export interface Event {
  id: string;
  name: string;
  description: string;
  type: EventType;
  status: EventStatus;
  gameId: string;
  startsAt: Date;
  endsAt: Date;
  rules: EventRules;
  scoringConfig: EventScoringConfig;
  rewardConfig: EventRewardConfig;
  eligibilityConfig: EventEligibilityConfig;
  visibility: EventVisibility;
  metadata: EventMetadata;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventRules {
  /** Maximum attempts allowed (null = unlimited) */
  maxAttempts: number | null;
  /** Whether best score counts */
  bestScoreCounts: boolean;
  /** Tie-breaking method */
  tieBreak: 'earliest_timestamp' | 'latest_timestamp' | 'random';
  /** Custom rules text */
  customRules: string[];
  /** Attempt constraint type */
  attemptConstraint: AttemptConstraint;
  [key: string]: unknown;
}

export interface EventScoringConfig {
  /** Scoring formula */
  formula: ScoringFormula;
  /** Multiplier for event score */
  multiplier: number;
  /** Base points per participation */
  participationPoints: number;
  /** Bonus points for personal best */
  personalBestBonus: number;
  /** Top N scores to consider (for top_n formula) */
  topN: number;
  /** Custom scoring rules */
  customRules: Record<string, unknown>;
}

export interface EventRewardConfig {
  /** Reward tiers based on rank */
  tiers: EventRewardTier[];
  /** Participation reward */
  participationReward: EventReward;
  /** Whether rewards are claimable or auto-distributed */
  autoDistribute: boolean;
}

export interface EventRewardTier {
  /** Minimum rank (inclusive) */
  minRank: number;
  /** Maximum rank (inclusive, null = unbounded) */
  maxRank: number | null;
  /** Reward for this tier */
  reward: EventReward;
}

export interface EventReward {
  xp: number;
  badgeId: string | null;
  titleId: string | null;
  cosmeticId: string | null;
  profileFrameId: string | null;
}

export interface EventEligibilityConfig {
  /** Minimum user level */
  minLevel: number;
  /** Maximum user level (0 = no max) */
  maxLevel: number;
  /** Required game ID (null = any) */
  requiredGameId: string | null;
  /** Account age minimum (days) */
  minAccountAgeDays: number;
  /** Country restrictions (empty = all) */
  countries: string[];
  /** Season/tier eligibility */
  requiredSeasonId: string | null;
  requiredTier: string | null;
}

export interface EventMetadata {
  /** Event image URL */
  imageUrl: string | null;
  /** Event color/theme */
  color: string | null;
  /** Sponsor information (future) */
  sponsor: EventSponsor | null;
  /** Campaign ID if part of a campaign */
  campaignId: string | null;
  /** Additional metadata */
  [key: string]: unknown;
}

export interface EventSponsor {
  name: string;
  logoUrl: string;
  website: string;
  isSponsored: boolean;
}

// ============================================================
// Event Participation
// ============================================================

export interface EventParticipant {
  id: string;
  eventId: string;
  userId: string;
  status: 'joined' | 'active' | 'completed' | 'disqualified';
  joinedAt: Date;
  lastAttemptAt: Date | null;
  attemptCount: number;
  bestScore: number;
  eventScore: number;
  rank: number | null;
  metadata: Record<string, unknown>;
}

export interface EventAttempt {
  id: string;
  eventId: string;
  userId: string;
  sessionId: string;
  gameScore: number;
  eventScore: number;
  validationStatus: ScoreValidation;
  attemptNumber: number;
  isValid: boolean;
  antiCheatFlags: string[];
  submittedAt: Date;
  validatedAt: Date | null;
}

// ============================================================
// Event Leaderboard
// ============================================================

export interface EventLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  country: string;
  eventScore: number;
  bestGameScore: number;
  attemptCount: number;
  lastAttemptAt: Date;
  isCurrentUser: boolean;
}

export interface EventLeaderboardResponse {
  eventId: string;
  eventName: string;
  entries: EventLeaderboardEntry[];
  userEntry: EventLeaderboardEntry | null;
  totalParticipants: number;
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

// ============================================================
// Tournament Types
// ============================================================

export interface Tournament extends Event {
  format: TournamentFormat;
  tournamentConfig: TournamentConfig;
}

export interface TournamentConfig {
  /** Tournament format specific config */
  format: TournamentFormat;
  /** Bracket configuration (for bracket tournaments) */
  bracket: BracketConfig | null;
  /** Head-to-head configuration */
  headToHead: HeadToHeadConfig | null;
  /** Leaderboard configuration */
  leaderboard: LeaderboardConfig | null;
}

export interface BracketConfig {
  /** Bracket size (must be power of 2) */
  bracketSize: number;
  /** Current round */
  currentRound: number;
  /** Total rounds */
  totalRounds: number;
  /** Matches per round */
  matchesPerRound: number[];
}

export interface HeadToHeadConfig {
  /** Match duration (ms) */
  matchDurationMs: number;
  /** Wins needed to advance */
  winsNeeded: number;
  /** Maximum matches per round */
  maxMatchesPerRound: number;
}

export interface LeaderboardConfig {
  /** Leaderboard duration (ms) */
  durationMs: number;
  /** Update frequency (ms) */
  updateFrequencyMs: number;
  /** Show real-time updates */
  showRealTime: boolean;
}

// ============================================================
// Event Types
// ============================================================

export interface DailyEvent extends Event {
  type: 'daily_event';
  eventDate: string; // YYYY-MM-DD
}

export interface WeekendEvent extends Event {
  type: 'weekend_event';
  weekNumber: number;
  games: string[]; // Multiple games allowed
}

export interface LimitedEvent extends Event {
  type: 'limited_event';
  theme: string;
  specialRules: Record<string, unknown>;
}

// ============================================================
// Event History
// ============================================================

export interface EventHistoryEntry {
  eventId: string;
  eventName: string;
  eventType: EventType;
  gameName: string;
  rank: number;
  totalParticipants: number;
  eventScore: number;
  bestGameScore: number;
  reward: EventReward | null;
  completedAt: Date;
}

export interface EventHistoryResponse {
  entries: EventHistoryEntry[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

// ============================================================
// Event API Types
// ============================================================

export interface EventResponse {
  event: Event;
  participant: EventParticipant | null;
  isActive: boolean;
  timeRemaining: number; // ms
  userRank: number | null;
  totalParticipants: number;
}

export interface JoinEventResponse {
  success: boolean;
  participant: EventParticipant | null;
  error?: string;
}

export interface SubmitScoreRequest {
  sessionId: string;
  gameScore: number;
}

export interface SubmitScoreResponse {
  success: boolean;
  attempt: EventAttempt | null;
  eventScore: number;
  newRank: number | null;
  rankChange: number | null;
  isPersonalBest: boolean;
  error?: string;
}

export interface EventStatusResponse {
  eventId: string;
  status: EventStatus;
  isActive: boolean;
  timeRemaining: number;
  participantCount: number;
}

// ============================================================
// Event Notifications
// ============================================================

export type EventNotificationType = 'event_started' | 'event_ending_soon' | 'rank_changed' | 'event_completed' | 'reward_available';

export interface EventNotification {
  id: string;
  userId: string;
  eventId: string;
  type: EventNotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

// ============================================================
// Event Analytics Types
// ============================================================

export type EventAnalyticsEvent =
  | 'event_viewed'
  | 'event_joined'
  | 'event_started'
  | 'event_attempt_started'
  | 'event_attempt_completed'
  | 'event_score_submitted'
  | 'event_rank_changed'
  | 'event_completed'
  | 'event_reward_claimed'
  | 'event_shared'
  | 'event_challenge_created';

export interface EventAnalyticsData {
  eventName: EventAnalyticsEvent;
  userId: string;
  eventId: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================
// Event Feature Flags
// ============================================================

export interface EventFeatureFlags {
  liveEventsEnabled: boolean;
  tournamentsEnabled: boolean;
  weekendEventsEnabled: boolean;
  sponsoredEventsEnabled: boolean;
}

// ============================================================
// Scheduled Job Types
// ============================================================

export interface EventScheduledJobResult {
  jobName: string;
  startedAt: Date;
  completedAt: Date;
  success: boolean;
  details: Record<string, unknown>;
  error?: string;
}
