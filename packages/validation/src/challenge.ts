import { z } from 'zod';

export const createFriendChallengeSchema = z.object({
  gameId: z.string().uuid(),
});

export const challengeTokenParamSchema = z.object({
  token: z.string().min(1).max(128),
});

export const dailyChallengeAttemptSchema = z.object({
  sessionId: z.string().uuid(),
});
