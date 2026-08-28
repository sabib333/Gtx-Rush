export type XPSource =
  | 'game_play'
  | 'game_win'
  | 'daily_challenge'
  | 'streak'
  | 'friend_challenge'
  | 'achievement'
  | 'purchase'
  | 'admin_adjustment'
  | 'mission_reward'
  | 'streak_milestone'
  | 'level_up_bonus'
  | 'daily_rush_reward'
  | 'retention_bonus';

export interface XPTransaction {
  id: string;
  userId: string;
  amount: number;
  source: XPSource;
  referenceId: string | null;
  referenceType: string | null;
  balanceAfter: number;
  createdAt: Date;
}

export interface LevelDefinition {
  level: number;
  xpRequired: number;
  title: string;
  rewards: LevelRewards;
}

export interface LevelRewards {
  badges?: string[];
  cosmetics?: string[];
  features?: string[];
}

export interface UserProgression {
  userId: string;
  level: number;
  xpTotal: number;
  xpToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: Date | null;
  nextLevel: LevelDefinition | null;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: Date | null;
  canRecover: boolean;
  recoveryUsedThisMonth: boolean;
}

export interface XPSourceConfig {
  source: XPSource;
  xpAmount: number;
  dailyLimit?: number;
}

export interface XPAwardResult {
  xpAwarded: number;
  newTotal: number;
  level: number;
  levelUp: boolean;
  newLevel?: LevelDefinition;
}
