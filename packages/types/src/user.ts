export type UserStatus = 'active' | 'suspended' | 'banned';

export interface User {
  id: string;
  telegramId: number;
  username: string;
  displayName: string;
  country: string;
  avatarUrl: string | null;
  level: number;
  xpTotal: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: Date;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  bio: string | null;
  totalGamesPlayed: number;
  totalScore: number;
  favoriteGameId: string | null;
  settings: UserSettings;
}

export interface UserSettings {
  notifications: boolean;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  analyticsOptOut: boolean;
}

export interface UserPublicProfile {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  country: string;
  totalGamesPlayed: number;
  badges: BadgeSummary[];
}

export interface BadgeSummary {
  id: string;
  slug: string;
  name: string;
  iconUrl: string;
  rarity: BadgeRarity;
}

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface UserStats {
  totalGamesPlayed: number;
  totalScore: number;
  averageScore: number;
  gamesByType: Record<string, number>;
  topScores: { gameId: string; score: number }[];
  joinDate: Date;
}

export interface AdminUser {
  id: string;
  userId: string | null;
  email: string;
  role: AdminRole;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'viewer';
