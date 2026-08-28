import type { GameInput, GameResult, ScoreValidationResult } from '@gtx-rush/types';

export interface GameSessionData {
  id: string;
  gameId: string;
  userId: string;
  status: 'active' | 'completed' | 'expired' | 'disqualified';
  startedAt: Date;
  inputs: GameInput[];
  result?: GameResult;
}

export interface AntiCheatRule {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (session: GameSessionData, inputs: GameInput[]) => AntiCheatResult;
}

export interface AntiCheatResult {
  passed: boolean;
  flag?: string;
  details?: Record<string, unknown>;
}

export interface GameEngine {
  gameId: string;

  /** Calculate score server-side from raw inputs */
  calculateScore(inputs: GameInput[]): GameResult;

  /** Validate a score against anti-cheat rules */
  validateScore(session: GameSessionData): ScoreValidationResult;

  /** Get anti-cheat rules for this game */
  getAntiCheatRules(): AntiCheatRule[];

  /** Get game configuration */
  getConfig(): Record<string, unknown>;
}
