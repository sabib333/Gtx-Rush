/**
 * Bot API Client
 *
 * The bot needs to call the backend API to:
 * - Look up users by Telegram ID
 * - Create/retrieve challenges
 * - Get leaderboard data
 * - Get stats
 */

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface UserData {
  id: string;
  telegramId: number;
  username: string;
  displayName: string;
  level: number;
  xpTotal: number;
  currentStreak: number;
  longestStreak: number;
  totalGamesPlayed: number;
  totalScore: number;
}

interface ChallengeData {
  id: string;
  challengeToken: string;
  gameId: string;
  gameName: string;
  challengerId: string;
  challengerName: string;
  challengerScore: number | null;
  opponentId: string | null;
  opponentName: string | null;
  opponentScore: number | null;
  status: string;
  expiresAt: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  level: number;
}

export class BotApiClient {
  private baseUrl: string;
  private adminToken: string;

  constructor(baseUrl: string, adminToken: string) {
    this.baseUrl = baseUrl;
    this.adminToken = adminToken;
  }

  private async get<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${this.adminToken}` },
      });
      const json = (await res.json()) as ApiEnvelope<T>;
      return json.success ? (json.data ?? null) : null;
    } catch {
      return null;
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.adminToken}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiEnvelope<T>;
      return json.success ? (await Promise.resolve(json.data)) ?? null : null;
    } catch {
      return null;
    }
  }

  // === Users ===

  async getUserByTelegramId(telegramId: number): Promise<UserData | null> {
    return this.get<UserData>(`/api/admin/users/telegram/${telegramId}`);
  }

  async getUserById(userId: string): Promise<UserData | null> {
    return this.get<UserData>(`/api/admin/users/${userId}`);
  }

  // === Challenges ===

  async getChallenge(token: string): Promise<ChallengeData | null> {
    return this.get<ChallengeData>(`/api/challenges/friend/${token}`);
  }

  async createChallenge(
    challengerId: string,
    gameId: string
  ): Promise<ChallengeData | null> {
    return this.post<ChallengeData>('/api/challenges/friend/create', {
      challengerId,
      gameId,
    });
  }

  async acceptChallenge(
    token: string,
    opponentId: string
  ): Promise<ChallengeData | null> {
    return this.post<ChallengeData>(`/api/challenges/friend/${token}/accept`, {
      opponentId,
    });
  }

  // === Leaderboard ===

  async getTopPlayers(limit: number = 10): Promise<LeaderboardEntry[] | null> {
    return this.get<LeaderboardEntry[]>(
      `/api/leaderboards/global?limit=${limit}`
    );
  }

  async getUserRank(
    userId: string
  ): Promise<{ rank: number; score: number } | null> {
    return this.get<{ rank: number; score: number }>(
      `/api/leaderboards/global/rank/${userId}`
    );
  }

  // === Stats ===

  async getStats(telegramId: number): Promise<UserData | null> {
    return this.getUserByTelegramId(telegramId);
  }

  // === Referrals ===

  async getReferralStats(
    userId: string
  ): Promise<{ friendsJoined: number; friendsActivated: number; referralCode: string } | null> {
    return this.get(`/api/referrals/${userId}/stats`);
  }
}
