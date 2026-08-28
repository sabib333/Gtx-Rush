export interface Game {
  id: string;
  slug: string;
  name: string;
  description: string;
  isActive: boolean;
  config: GameConfig;
  minLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameConfig {
  maxDurationMs: number;
  inputTimeoutMs: number;
  rounds?: number;
  [key: string]: unknown;
}

export interface GameVersion {
  id: string;
  gameId: string;
  version: number;
  rules: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
}

export type GameSessionStatus = 'active' | 'completed' | 'expired' | 'disqualified';

export interface GameSession {
  id: string;
  userId: string;
  gameId: string;
  gameVersionId: string;
  status: GameSessionStatus;
  clientSessionToken: string;
  startedAt: Date;
  completedAt: Date | null;
  ipAddress: string;
  userAgent: string;
  deviceInfo: Record<string, unknown>;
}

export interface GameInput {
  sequence: number;
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
}

export interface GameResult {
  score: number;
  breakdown: Record<string, number>;
  metadata: Record<string, unknown>;
  antiCheatFlags: string[];
  durationMs: number;
  inputCount: number;
}

export interface GameScore {
  id: string;
  sessionId: string;
  userId: string;
  gameId: string;
  score: number;
  breakdown: Record<string, number>;
  isPersonalBest: boolean;
  antiCheatFlags: string[];
  validatedAt: Date;
  createdAt: Date;
}

export interface GameDefinition {
  id: string;
  name: string;
  version: number;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  sessionConfig: {
    maxDurationMs: number;
    inputTimeoutMs: number;
  };
}

export interface ScoreValidationResult {
  valid: boolean;
  score: number;
  flags: string[];
  reason?: string;
}
