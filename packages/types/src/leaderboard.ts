export type LeaderboardType = 'global' | 'country' | 'friends' | 'weekly' | 'game_specific' | 'season';

export interface Leaderboard {
  id: string;
  gameId: string | null;
  type: LeaderboardType;
  countryCode: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface LeaderboardEntry {
  id: string;
  leaderboardId: string;
  userId: string;
  score: number;
  rank: number;
  entryCount: number;
  lastScoreAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaderboardEntryWithUser extends LeaderboardEntry {
  user: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
    level: number;
    country: string;
  };
}

export interface LeaderboardResponse {
  entries: LeaderboardEntryWithUser[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
  userRank?: LeaderboardEntryWithUser;
}

export interface LeaderboardQuery {
  type: LeaderboardType;
  gameId?: string;
  countryCode?: string;
  cursor?: string;
  limit?: number;
}
