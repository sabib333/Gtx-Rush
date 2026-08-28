export type AnalyticsEventName =
  | 'app_open'
  | 'onboarding_complete'
  | 'game_start'
  | 'game_complete'
  | 'score_submitted'
  | 'challenge_created'
  | 'challenge_completed'
  | 'referral_created'
  | 'referral_activated'
  | 'daily_challenge_started'
  | 'daily_challenge_completed'
  | 'daily_challenge_viewed'
  | 'daily_challenge_attempted'
  | 'daily_challenge_personal_best'
  | 'daily_challenge_shared'
  | 'friend_challenge_created'
  | 'friend_challenge_opened'
  | 'friend_challenge_started'
  | 'friend_challenge_completed'
  | 'friend_challenge_won'
  | 'friend_challenge_lost'
  | 'friend_challenge_shared'
  | 'challenge_expired'
  | 'challenge_abuse_detected'
  | 'purchase_started'
  | 'purchase_completed'
  | 'ad_impression'
  | 'ad_completed'
  | 'streak_started'
  | 'streak_extended'
  | 'badge_unlocked'
  | 'leaderboard_rank_changed'
  | 'share_score';

export interface AnalyticsEvent {
  eventName: AnalyticsEventName;
  userId: string | null;
  properties: Record<string, unknown>;
  sessionId: string;
  timestamp: Date;
}

export interface AnalyticsBatch {
  events: AnalyticsEvent[];
}

export interface AnalyticsQuery {
  eventName?: AnalyticsEventName;
  startDate: Date;
  endDate: Date;
  groupBy?: 'day' | 'week' | 'month';
  userId?: string;
}

export interface AnalyticsAggregate {
  date: string;
  count: number;
  uniqueUsers: number;
  properties?: Record<string, unknown>;
}
