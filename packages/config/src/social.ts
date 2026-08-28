/**
 * GTX Rush — Social & Community Configuration v1.0
 *
 * Configuration for friends, teams, feeds, and community features.
 * All values are configurable and version-controlled.
 *
 * Contract: Social Engine Contract v1.0
 */

import type {
  TeamRole,
  TeamPrivacy,
  TeamLevel,
  TeamXpSource,
  ReactionType,
  ReportReason,
  SocialFeatureFlags,
  TeamSettings,
} from '@gtx-rush/types';

// ============================================================
// Feature Flags (Default Values)
// ============================================================

export const DEFAULT_SOCIAL_FEATURE_FLAGS: SocialFeatureFlags = {
  friendsEnabled: true,
  teamsEnabled: true,
  feedEnabled: true,
  reactionsEnabled: true,
  reportsEnabled: true,
  teamEventsEnabled: true,
};

// ============================================================
// Friend System Configuration
// ============================================================

export const FRIEND_CONFIG = {
  /** Maximum friends per user */
  maxFriends: 200,
  /** Maximum pending friend requests */
  maxPendingRequests: 50,
  /** Friend request expiration (days) */
  requestExpirationDays: 30,
  /** Maximum friend requests per day */
  maxRequestsPerDay: 20,
  /** Enable friend search */
  enableSearch: true,
};

// ============================================================
// Team Configuration
// ============================================================

export const TEAM_CONFIG = {
  /** Default maximum team members */
  defaultMaxMembers: 30,
  /** Minimum team name length */
  minNameLength: 3,
  /** Maximum team name length */
  maxNameLength: 32,
  /** Minimum team tag length */
  minTagLength: 2,
  /** Maximum team tag length */
  maxTagLength: 6,
  /** Maximum team description length */
  maxDescriptionLength: 256,
  /** Team invite expiration (days) */
  inviteExpirationDays: 7,
  /** Maximum invites per day */
  maxInvitesPerDay: 10,
  /** Team join request expiration (days) */
  joinRequestExpirationDays: 7,
};

// ============================================================
// Team Roles & Permissions
// ============================================================

export const TEAM_ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  owner: [
    'edit_team',
    'invite_members',
    'remove_members',
    'promote_admin',
    'demote_admin',
    'transfer_ownership',
    'disband_team',
    'manage_settings',
    'manage_join_requests',
  ],
  admin: [
    'invite_members',
    'remove_members',
    'manage_join_requests',
    'edit_team',
  ],
  member: [
    'leave_team',
    'view_members',
    'contribute_xp',
  ],
};

// ============================================================
// Team XP Configuration
// ============================================================

export const TEAM_XP_CONFIG: Record<TeamXpSource, {
  xpAmount: number;
  dailyLimit: number;
  description: string;
}> = {
  game_play: { xpAmount: 5, dailyLimit: 50, description: 'Playing games' },
  game_win: { xpAmount: 10, dailyLimit: 100, description: 'Winning games' },
  event_participation: { xpAmount: 25, dailyLimit: 100, description: 'Event participation' },
  event_win: { xpAmount: 50, dailyLimit: 200, description: 'Winning events' },
  mission_complete: { xpAmount: 15, dailyLimit: 75, description: 'Completing missions' },
  challenge_win: { xpAmount: 20, dailyLimit: 100, description: 'Winning challenges' },
  daily_login: { xpAmount: 5, dailyLimit: 5, description: 'Daily login' },
};

// ============================================================
// Team Levels
// ============================================================

export const TEAM_LEVELS: TeamLevel[] = [
  { level: 1, xpRequired: 0, title: 'New Team', rewards: { themes: [], badges: [], customization: [] } },
  { level: 2, xpRequired: 500, title: 'Growing Team', rewards: { themes: ['theme_basic'], badges: [], customization: ['frame_bronze'] } },
  { level: 3, xpRequired: 1500, title: 'Active Team', rewards: { themes: [], badges: ['team_active'], customization: [] } },
  { level: 4, xpRequired: 3000, title: 'Strong Team', rewards: { themes: ['theme_silver'], badges: [], customization: ['frame_silver'] } },
  { level: 5, xpRequired: 5000, title: 'Elite Team', rewards: { themes: [], badges: ['team_elite'], customization: [] } },
  { level: 6, xpRequired: 8000, title: 'Champion Team', rewards: { themes: ['theme_gold'], badges: [], customization: ['frame_gold'] } },
  { level: 7, xpRequired: 12000, title: 'Master Team', rewards: { themes: [], badges: ['team_master'], customization: [] } },
  { level: 8, xpRequired: 18000, title: 'Legendary Team', rewards: { themes: ['theme_legendary'], badges: ['team_legendary'], customization: ['frame_legendary'] } },
];

// ============================================================
// Team Badge Templates
// ============================================================

export const TEAM_BADGE_TEMPLATES = [
  { id: 'team_active', name: 'Active Team', description: 'Reached Level 3', rarity: 'common' as const },
  { id: 'team_elite', name: 'Elite Team', description: 'Reached Level 5', rarity: 'rare' as const },
  { id: 'team_master', name: 'Master Team', description: 'Reached Level 7', rarity: 'epic' as const },
  { id: 'team_legendary', name: 'Legendary Team', description: 'Reached Level 8', rarity: 'legendary' as const },
  { id: 'team_event_winner', name: 'Event Champions', description: 'Won a team event', rarity: 'epic' as const },
  { id: 'team_social_butterfly', name: 'Social Butterflies', description: '50+ connected teams', rarity: 'rare' as const },
];

// ============================================================
// Social Feed Configuration
// ============================================================

export const FEED_CONFIG = {
  /** Maximum feed events to keep per user */
  maxFeedEvents: 100,
  /** Feed event expiration (days) */
  feedEventExpirationDays: 30,
  /** Maximum reactions per event */
  maxReactionsPerEvent: 100,
  /** Reactions per user per event */
  maxReactionsPerUserPerEvent: 1,
  /** Feed page size */
  defaultPageSize: 20,
};

// ============================================================
// Reaction Configuration
// ============================================================

export const REACTION_CONFIG: Record<ReactionType, {
  emoji: string;
  name: string;
  cooldownMs: number;
}> = {
  fire: { emoji: '🔥', name: 'Fire', cooldownMs: 1000 },
  lightning: { emoji: '⚡', name: 'Lightning', cooldownMs: 1000 },
  trophy: { emoji: '🏆', name: 'Trophy', cooldownMs: 1000 },
  clap: { emoji: '👏', name: 'Clap', cooldownMs: 1000 },
  heart: { emoji: '❤️', name: 'Heart', cooldownMs: 1000 },
  rocket: { emoji: '🚀', name: 'Rocket', cooldownMs: 1000 },
};

// ============================================================
// Report Configuration
// ============================================================

export const REPORT_CONFIG = {
  /** Maximum reports per user per day */
  maxReportsPerDay: 10,
  /** Report expiration for review (days) */
  reviewExpirationDays: 7,
  /** Auto-dismiss reports older than this (days) */
  autoDismissDays: 30,
};

// ============================================================
// Notification Configuration
// ============================================================

export const SOCIAL_NOTIFICATION_CONFIG = {
  /** Maximum notifications per day */
  maxPerDay: 20,
  /** Notification expiration (days) */
  expirationDays: 7,
  /** Cooldown between similar notifications (minutes) */
  cooldownMinutes: 30,
};

// ============================================================
// Anti-Spam Configuration
// ============================================================

export const ANTI_SPAM_CONFIG = {
  /** Maximum friend requests per hour */
  maxFriendRequestsPerHour: 10,
  /** Maximum team invites per hour */
  maxTeamInvitesPerHour: 10,
  /** Maximum reactions per minute */
  maxReactionsPerMinute: 20,
  /** Maximum feed posts per hour (for future use) */
  maxFeedPostsPerHour: 10,
  /** Block duration for spam (minutes) */
  spamBlockDurationMinutes: 30,
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get team level from XP.
 */
export function getTeamLevelFromXp(xp: number): TeamLevel {
  for (let i = TEAM_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= TEAM_LEVELS[i]!.xpRequired) {
      return TEAM_LEVELS[i]!;
    }
  }
  return TEAM_LEVELS[0]!;
}

/**
 * Get XP needed for next team level.
 */
export function getTeamXpToNextLevel(currentXp: number): {
  currentLevel: TeamLevel;
  nextLevel: TeamLevel | null;
  xpNeeded: number;
  progress: number;
} {
  const currentLevel = getTeamLevelFromXp(currentXp);
  const nextLevelIndex = TEAM_LEVELS.findIndex((l) => l.level === currentLevel.level) + 1;
  const nextLevel = nextLevelIndex < TEAM_LEVELS.length ? TEAM_LEVELS[nextLevelIndex]! : null;

  if (!nextLevel) {
    return { currentLevel, nextLevel: null, xpNeeded: 0, progress: 100 };
  }

  const xpInCurrentLevel = currentXp - currentLevel.xpRequired;
  const xpNeeded = nextLevel.xpRequired - currentLevel.xpRequired;
  const progress = Math.min(100, Math.round((xpInCurrentLevel / xpNeeded) * 100));

  return { currentLevel, nextLevel, xpNeeded, progress };
}

/**
 * Check if user has permission.
 */
export function hasTeamPermission(role: TeamRole, permission: string): boolean {
  return TEAM_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Generate team invite code.
 */
export function generateTeamInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Get notification cooldown key.
 */
export function getNotificationCooldownKey(type: string, userId: string, referenceId: string): string {
  return `${type}:${userId}:${referenceId}`;
}
