/**
 * GTX Rush — Social & Community Types v1.0
 *
 * Type definitions for the Social & Community Engine.
 * Covers friends, teams, feeds, reactions, and community features.
 *
 * Contract: Social Engine Contract v1.0
 */

// ============================================================
// Enums / Literal Types
// ============================================================

export type FriendStatus = 'none' | 'requested' | 'connected' | 'blocked';
export type TeamRole = 'owner' | 'admin' | 'member';
export type TeamPrivacy = 'public' | 'private' | 'invite_only';
export type TeamJoinMethod = 'invite' | 'join_request' | 'public' | 'code' | 'link';
export type TeamStatus = 'active' | 'disbanded' | 'pending';
export type ReportReason = 'harassment' | 'spam' | 'impersonation' | 'inappropriate_content' | 'cheating' | 'other';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';
export type FeedEventType = 'level_up' | 'rank_change' | 'challenge_won' | 'team_achievement' | 'badge_unlocked' | 'event_completed';
export type NotificationType = 'friend_challenge' | 'challenge_accepted' | 'challenge_result' | 'friend_rank_change' | 'team_invite' | 'team_event_started' | 'team_mission_completed' | 'team_achievement' | 'feed_reaction' | 'system_announcement';
export type ReactionType = 'fire' | 'lightning' | 'trophy' | 'clap' | 'heart' | 'rocket';

// ============================================================
// Friend System Types
// ============================================================

export interface FriendRelationship {
  id: string;
  userId: string;
  friendId: string;
  status: FriendStatus;
  requestedBy: string;
  createdAt: Date;
  acceptedAt: Date | null;
  blockedAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  message: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  expiresAt: Date;
}

export interface FriendWithProfile {
  id: string;
  userId: string;
  friendId: string;
  status: FriendStatus;
  profile: FriendProfile;
  connectedAt: Date | null;
}

export interface FriendProfile {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  globalRank: number | null;
  seasonRank: number | null;
  tier: string | null;
  title: string | null;
  badges: FriendBadge[];
  bestScore: number;
  currentStreak: number;
  teamId: string | null;
  teamName: string | null;
}

export interface FriendBadge {
  id: string;
  slug: string;
  name: string;
  iconUrl: string;
  rarity: string;
}

// ============================================================
// Block System Types
// ============================================================

export interface Block {
  id: string;
  userId: string;
  blockedUserId: string;
  reason: string | null;
  createdAt: Date;
}

// ============================================================
// Team Types
// ============================================================

export interface Team {
  id: string;
  name: string;
  tag: string;
  description: string;
  avatarUrl: string | null;
  ownerId: string;
  privacy: TeamPrivacy;
  status: TeamStatus;
  maxMembers: number;
  currentMembers: number;
  teamLevel: number;
  teamXp: number;
  teamRank: number | null;
  seasonRank: number | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: TeamMetadata;
}

export interface TeamMetadata {
  theme: string | null;
  badges: string[];
  settings: TeamSettings;
  [key: string]: unknown;
}

export interface TeamSettings {
  allowJoinRequests: boolean;
  requireApproval: boolean;
  defaultRole: TeamRole;
  maxInvites: number;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  contributionXp: number;
  contributionGames: number;
  contributionEvents: number;
  joinedAt: Date;
  lastActiveAt: Date;
  status: 'active' | 'inactive' | 'pending';
}

export interface TeamMemberWithProfile extends TeamMember {
  profile: FriendProfile;
}

export interface TeamInvite {
  id: string;
  teamId: string;
  invitedBy: string;
  invitedUserId: string | null;
  inviteCode: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  message: string | null;
  createdAt: Date;
  expiresAt: Date;
  respondedAt: Date | null;
}

export interface TeamJoinRequest {
  id: string;
  teamId: string;
  userId: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  respondedAt: Date | null;
}

// ============================================================
// Team XP & Leveling
// ============================================================

export interface TeamXpTransaction {
  id: string;
  teamId: string;
  userId: string;
  amount: number;
  source: TeamXpSource;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: Date;
}

export type TeamXpSource = 'game_play' | 'game_win' | 'event_participation' | 'event_win' | 'mission_complete' | 'challenge_win' | 'daily_login';

export interface TeamLevel {
  level: number;
  xpRequired: number;
  title: string;
  rewards: TeamLevelRewards;
}

export interface TeamLevelRewards {
  themes: string[];
  badges: string[];
  customization: string[];
}

// ============================================================
// Social Feed Types
// ============================================================

export interface FeedEvent {
  id: string;
  type: FeedEventType;
  userId: string;
  teamId: string | null;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  reactions: FeedReaction[];
  reactionCount: number;
  createdAt: Date;
}

export interface FeedReaction {
  id: string;
  feedEventId: string;
  userId: string;
  type: ReactionType;
  createdAt: Date;
}

export interface FeedEventWithUser extends FeedEvent {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
  };
}

// ============================================================
// Report Types
// ============================================================

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string | null;
  reportedTeamId: string | null;
  reportedFeedEventId: string | null;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  resolvedAt: Date | null;
}

// ============================================================
// Social Notification Types
// ============================================================

export interface SocialNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

// ============================================================
// Social Analytics Types
// ============================================================

export type SocialAnalyticsEvent =
  | 'friend_profile_viewed'
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'friend_challenge_created'
  | 'friend_challenge_completed'
  | 'team_viewed'
  | 'team_created'
  | 'team_joined'
  | 'team_left'
  | 'team_invited'
  | 'team_event_joined'
  | 'feed_viewed'
  | 'feed_reaction'
  | 'report_created';

export interface SocialAnalyticsData {
  eventName: SocialAnalyticsEvent;
  userId: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================
// Social API Types
// ============================================================

export interface FriendsListResponse {
  friends: FriendWithProfile[];
  totalCount: number;
  pendingRequests: FriendRequest[];
}

export interface FriendRequestsResponse {
  sent: FriendRequest[];
  received: FriendRequest[];
}

export interface TeamListResponse {
  teams: Team[];
  totalCount: number;
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface TeamDetailResponse {
  team: Team;
  members: TeamMemberWithProfile[];
  isMember: boolean;
  userRole: TeamRole | null;
  recentActivity: FeedEvent[];
  leaderboard: TeamLeaderboardEntry[];
}

export interface TeamLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  contributionXp: number;
  contributionGames: number;
  contributionEvents: number;
  isCurrentUser: boolean;
}

export interface FeedResponse {
  events: FeedEventWithUser[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface SocialDashboardResponse {
  friends: FriendWithProfile[];
  teams: Team[];
  recentFeed: FeedEvent[];
  notifications: SocialNotification[];
  pendingFriendRequests: number;
  pendingTeamInvites: number;
}

// ============================================================
// Social Feature Flags
// ============================================================

export interface SocialFeatureFlags {
  friendsEnabled: boolean;
  teamsEnabled: boolean;
  feedEnabled: boolean;
  reactionsEnabled: boolean;
  reportsEnabled: boolean;
  teamEventsEnabled: boolean;
}
