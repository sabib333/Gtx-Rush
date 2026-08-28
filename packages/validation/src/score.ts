import { z } from 'zod';

export const scoreQuerySchema = z.object({
  gameId: z.string().uuid().optional(),
  type: z.enum(['global', 'country', 'friends', 'weekly', 'game_specific']),
  countryCode: z.string().length(2).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const leaderboardTypeParamSchema = z.object({
  type: z.enum(['global', 'country', 'friends', 'weekly', 'game_specific']),
});
