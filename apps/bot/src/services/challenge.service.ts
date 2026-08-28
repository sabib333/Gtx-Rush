/**
 * Bot Challenge Service
 *
 * Manages the challenge flow:
 * 1. User A creates challenge → bot generates token + link
 * 2. User A shares link with User B
 * 3. User B opens link → bot shows challenge message
 * 4. User B accepts → Mini App opens for gameplay
 * 5. Both play → results compared → winner announced
 */

import { nanoid } from 'nanoid';
import { BotApiClient } from '@gtx-rush/telegram';

export interface PendingChallenge {
  token: string;
  gameId: string;
  gameName: string;
  challengerId: number;
  challengerName: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ChallengeResult {
  token: string;
  challengerName: string;
  challengerScore: number;
  opponentName: string;
  opponentScore: number;
  winner: 'challenger' | 'opponent' | 'tie';
}

// In-memory challenge store for the bot
// In production, this would be backed by the database via API
const pendingChallenges = new Map<string, PendingChallenge>();
const completedChallenges = new Map<string, ChallengeResult>();

const GAME_NAMES: Record<string, string> = {
  'reaction-rush': 'Reaction Rush',
  'tap-rush': 'Tap Rush',
  'quiz-rush': 'Quiz Rush',
};

export class ChallengeService {
  private api: BotApiClient;

  constructor(api: BotApiClient) {
    this.api = api;
  }

  /**
   * Create a new challenge.
   * Returns the token and generates a shareable link.
   */
  createChallenge(
    challengerId: number,
    challengerName: string,
    gameId: string
  ): PendingChallenge {
    const token = nanoid(12);
    const gameName = GAME_NAMES[gameId] ?? gameId;

    const challenge: PendingChallenge = {
      token,
      gameId,
      gameName,
      challengerId,
      challengerName,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
    };

    pendingChallenges.set(token, challenge);

    // Schedule cleanup
    setTimeout(() => {
      pendingChallenges.delete(token);
    }, 48 * 60 * 60 * 1000);

    return challenge;
  }

  /**
   * Get a pending challenge by token.
   */
  getChallenge(token: string): PendingChallenge | null {
    return pendingChallenges.get(token) ?? null;
  }

  /**
   * Check if a challenge has expired.
   */
  isExpired(token: string): boolean {
    const challenge = pendingChallenges.get(token);
    if (!challenge) return true;
    return Date.now() > challenge.expiresAt.getTime();
  }

  /**
   * Record a completed challenge result.
   */
  recordResult(
    token: string,
    challengerName: string,
    challengerScore: number,
    opponentName: string,
    opponentScore: number
  ): ChallengeResult {
    const winner =
      challengerScore > opponentScore
        ? 'challenger'
        : opponentScore > challengerScore
          ? 'opponent'
          : 'tie';

    const result: ChallengeResult = {
      token,
      challengerName,
      challengerScore,
      opponentName,
      opponentScore,
      winner,
    };

    completedChallenges.set(token, result);
    pendingChallenges.delete(token);

    return result;
  }

  /**
   * Get a completed challenge result.
   */
  getResult(token: string): ChallengeResult | null {
    return completedChallenges.get(token) ?? null;
  }

  /**
   * Get pending challenge count for a user.
   */
  getPendingCount(userId: number): number {
    let count = 0;
    for (const challenge of pendingChallenges.values()) {
      if (challenge.challengerId === userId) count++;
    }
    return count;
  }
}
