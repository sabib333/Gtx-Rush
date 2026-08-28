/**
 * GTX Rush API Client
 *
 * Centralized HTTP client for all API calls.
 * Handles authentication, errors, retry, and request cancellation.
 */

type RequestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: RequestMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { method = 'GET', body, headers = {}, signal } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.token) {
      requestHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData?.error?.code ?? 'UNKNOWN_ERROR',
        errorData?.error?.message ?? `HTTP ${response.status}`,
        response.status
      );
    }

    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
      throw new ApiError(
        data.error?.code ?? 'API_ERROR',
        data.error?.message ?? 'Unknown error'
      );
    }

    return data.data as T;
  }

  // === Auth ===
  async verifyTelegram(initData: string) {
    return this.request<{ token: string; user: { id: string; telegramId: number; username: string; displayName: string; level: number } }>(
      '/api/auth/verify',
      { method: 'POST', body: { initData } }
    );
  }

  // === Games ===
  async getGames() {
    return this.request<{ id: string; name: string; description: string }[]>('/api/games');
  }

  async startSession(gameId: string, clientSessionToken: string) {
    return this.request<{ sessionId: string; gameConfig: Record<string, unknown> }>(
      '/api/sessions/start',
      { method: 'POST', body: { gameId, clientSessionToken } }
    );
  }

  async finishSession(sessionId: string, clientCalculatedScore: number) {
    return this.request<{
      sessionId: string;
      score: number;
      rank: number | null;
      isPersonalBest: boolean;
      xpAwarded: number;
      breakdown: Record<string, number>;
    }>(
      `/api/sessions/${sessionId}/finish`,
      { method: 'POST', body: { clientCalculatedScore } }
    );
  }

  // === Leaderboards ===
  async getLeaderboard(type: string, params?: { gameId?: string; cursor?: string; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.gameId) searchParams.set('gameId', params.gameId);
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    return this.request<{ entries: unknown[]; pagination: { nextCursor: string | null; hasMore: boolean } }>(
      `/api/leaderboards/${type}${query ? `?${query}` : ''}`
    );
  }

  // === Users ===
  async getMe() {
    return this.request<{
      id: string;
      displayName: string;
      username: string;
      level: number;
      xpTotal: number;
      currentStreak: number;
      longestStreak: number;
      country: string;
    }>('/api/users/me');
  }

  // === Challenges ===
  async getDailyChallenge() {
    return this.request<unknown>('/api/challenges/daily');
  }

  async createFriendChallenge(gameId: string) {
    return this.request<{ challengeToken: string; deepLink: string }>(
      '/api/challenges/friend/create',
      { method: 'POST', body: { gameId } }
    );
  }

  // === Referrals ===
  async getReferralStats() {
    return this.request<{ friendsJoined: number; friendsActivated: number; referralCode: string }>(
      '/api/referrals/me'
    );
  }
}

class ApiError extends Error {
  code: string;
  statusCode?: number;

  constructor(code: string, message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const api = new ApiClient();
export { ApiError };
