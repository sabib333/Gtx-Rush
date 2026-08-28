export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: Pagination;
}

export interface Pagination {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PaginatedQuery {
  cursor?: string;
  limit?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthVerifyRequest {
  initData: string;
}

export interface AuthVerifyResponse {
  token: string;
  user: {
    id: string;
    telegramId: number;
    username: string;
    displayName: string;
    level: number;
  };
}

export interface StartSessionRequest {
  gameId: string;
  clientSessionToken: string;
}

export interface StartSessionResponse {
  sessionId: string;
  gameConfig: Record<string, unknown>;
}

export interface SubmitInputRequest {
  sequence: number;
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
}

export interface FinishSessionRequest {
  clientCalculatedScore: number;
}

export interface SessionResultResponse {
  sessionId: string;
  score: number;
  rank: number | null;
  isPersonalBest: boolean;
  xpAwarded: number;
  breakdown: Record<string, number>;
}
